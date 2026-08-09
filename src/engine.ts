import type { CreateEventInput, CreateLeadInput, EngineConfig, EngineState, EventProcessResult, ScoringRule, Timestamp } from "./contracts.js";
import { appendEvent, getLeadEvents } from "./event-ledger.js";
import { addLead } from "./leads.js";
import { evaluateQualification, selectQualification } from "./qualification.js";
import { replayLeadScoring } from "./replay.js";
import { assignSegment } from "./segmentation.js";
import { createEngineState } from "./state.js";

export function createEngine(config: EngineConfig): EngineState {
  return createEngineState(config);
}

export function createLeadInEngine(state: EngineState, input: CreateLeadInput): EventProcessResult {
  const result = addLead(state, input);
  return result.ok ? { state: result.value, outcome: "accepted" } : { state, outcome: "rejected", errors: result.errors };
}

export function processEvent(state: EngineState, input: CreateEventInput, rules: readonly ScoringRule[], evaluatedAt: Timestamp): EventProcessResult {
  const appended = appendEvent(state, input);
  if (!appended.ok) return { state, outcome: "rejected", errors: appended.errors };
  if (appended.value.duplicate) return { state, outcome: "duplicate", event: appended.value.event };
  const replayed = replayLeadScoring(appended.value.state, appended.value.event.leadId, rules);
  if (!replayed.ok) return { state: appended.value.state, outcome: "rejected", errors: replayed.errors };
  const explanation = replayed.value.history.find((item) => item.eventId === appended.value.event.id);
  return refreshLeadIntelligence(replayed.value.state, appended.value.event.leadId, evaluatedAt, explanation === undefined ? { event: appended.value.event } : { event: appended.value.event, explanation });
}

export function refreshLeadIntelligence(state: EngineState, leadId: string, evaluatedAt: Timestamp, base: Pick<EventProcessResult, "event" | "explanation"> = {}): EventProcessResult {
  const lead = state.leads[leadId];
  if (!lead) return { state, outcome: "rejected", errors: [`lead '${leadId}' does not exist`] };
  const events = getLeadEvents(state, leadId);
  const results = state.config.qualificationPolicies.map((policy) => evaluateQualification(lead, state.scores[leadId] ?? 0, events, policy, evaluatedAt));
  const qualification = selectQualification(results) ?? { leadId, policyId: "default", state: "unqualified" as const, evaluatedAt, reasons: ["no qualification policy matched"] };
  const segment = assignSegment(lead, state.scores[leadId] ?? 0, events, qualification, state.config.segmentPolicy);
  const next = { ...state, qualifications: { ...state.qualifications, [leadId]: qualification }, segments: { ...state.segments, [leadId]: segment } };
  return { state: next, outcome: "accepted", ...base, qualification, segment };
}

// --- Event Correlation and Pattern Matching (CEP) ---

export interface EventPatternDefinition {
  readonly id: string;
  readonly sequence: readonly string[]; // event types in order
  readonly maxTimeWindowMs: number;
}

export interface PatternMatchResult {
  readonly patternId: string;
  readonly leadId: string;
  readonly matchedEventIds: readonly string[];
  readonly matchedAt: number;
}

export function detectEventPatterns(state: EngineState, leadId: string, patterns: readonly EventPatternDefinition[]): readonly PatternMatchResult[] {
  const events = getLeadEvents(state, leadId);
  if (events.length === 0) return [];
  
  const matches: PatternMatchResult[] = [];
  
  for (const pattern of patterns) {
    if (pattern.sequence.length === 0) continue;
    if (events.length < pattern.sequence.length) continue;
    
    // Naive state machine for subsequence detection within time window
    for (let i = 0; i <= events.length - pattern.sequence.length; i++) {
      if (events[i]!.type !== pattern.sequence[0]) continue;
      
      const windowStart = events[i]!.occurredAt;
      let patternIdx = 1;
      const matchedIds = [events[i]!.id];
      let j = i + 1;
      
      while (patternIdx < pattern.sequence.length && j < events.length) {
        const candidate = events[j]!;
        if (candidate.occurredAt - windowStart > pattern.maxTimeWindowMs) break;
        
        if (candidate.type === pattern.sequence[patternIdx]) {
          matchedIds.push(candidate.id);
          patternIdx++;
        }
        j++;
      }
      
      if (patternIdx === pattern.sequence.length) {
        matches.push({
          patternId: pattern.id,
          leadId,
          matchedEventIds: matchedIds,
          matchedAt: events[j - 1]!.occurredAt
        });
      }
    }
  }
  
  return matches;
}

// --- Fraud and Bot Detection Heuristics ---

export interface FraudHeuristicsConfig {
  readonly maxEventsPerSecond: number;
  readonly impossibleTravelSpeedMetersPerSecond: number;
  readonly highRiskCountries?: readonly string[];
  readonly blacklistedIPs?: readonly string[];
}

export interface FraudAnalysisResult {
  readonly isSuspicious: boolean;
  readonly riskScore: number; // 0 to 100
  readonly flags: readonly string[];
}

export function analyzeLeadFraudRisk(state: EngineState, leadId: string, config: FraudHeuristicsConfig): FraudAnalysisResult {
  const events = getLeadEvents(state, leadId);
  const flags: string[] = [];
  let riskScore = 0;
  
  // 1. Velocity check (events per second)
  if (events.length >= 5) {
    const recent = events.slice(-5);
    const timeSpan = recent[recent.length - 1]!.occurredAt - recent[0]!.occurredAt;
    if (timeSpan > 0 && (5 / (timeSpan / 1000)) > config.maxEventsPerSecond) {
      flags.push("excessive_event_velocity");
      riskScore += 40;
    }
  }
  
  // 2. Impossible Travel (using dummy attributes if they exist)
  const lead = state.leads[leadId];
  if (lead && lead.attributes['ip_country'] && config.highRiskCountries?.includes(lead.attributes['ip_country'] as string)) {
    flags.push("high_risk_country");
    riskScore += 25;
  }
  
  if (lead && lead.attributes['ip_address'] && config.blacklistedIPs?.includes(lead.attributes['ip_address'] as string)) {
    flags.push("blacklisted_ip");
    riskScore += 80;
  }
  
  // Fake impossible travel check (assumes lat/lon metadata on events)
  let prevEventWithLocation = events.find(e => (e as any).metadata?.lat && (e as any).metadata?.lon);
  if (prevEventWithLocation) {
    for (let i = events.indexOf(prevEventWithLocation) + 1; i < events.length; i++) {
      const e = events[i]!;
      if ((e as any).metadata?.lat && (e as any).metadata?.lon) {
        const timeDiffSec = (e.occurredAt - prevEventWithLocation.occurredAt) / 1000;
        if (timeDiffSec > 0) {
          // Haversine mock distance
          const lat1 = Number((prevEventWithLocation as any).metadata.lat);
          const lon1 = Number((prevEventWithLocation as any).metadata.lon);
          const lat2 = Number((e as any).metadata.lat);
          const lon2 = Number((e as any).metadata.lon);
          
          const distMeters = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2)) * 111000;
          const speed = distMeters / timeDiffSec;
          
          if (speed > config.impossibleTravelSpeedMetersPerSecond) {
             flags.push("impossible_travel");
             riskScore += 50;
             break;
          }
        }
        prevEventWithLocation = e;
      }
    }
  }
  
  riskScore = Math.min(100, Math.max(0, riskScore));
  
  return {
    isSuspicious: riskScore >= 50,
    riskScore,
    flags
  };
}

// --- Sliding Event Windowing ---

export interface EventWindow {
  readonly startTime: number;
  readonly endTime: number;
  readonly eventIds: readonly string[];
}

export function computeSlidingWindows(events: readonly CreateEventInput[], windowSizeMs: number, slideMs: number): readonly EventWindow[] {
  if (events.length === 0) return [];
  
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const minTime = sorted[0]!.occurredAt;
  const maxTime = sorted[sorted.length - 1]!.occurredAt;
  
  const windows: EventWindow[] = [];
  
  for (let start = minTime; start <= maxTime; start += slideMs) {
    const end = start + windowSizeMs;
    const windowEvents = sorted.filter(e => e.occurredAt >= start && e.occurredAt < end);
    if (windowEvents.length > 0) {
      windows.push({
        startTime: start,
        endTime: end,
        eventIds: windowEvents.map(e => e.id)
      });
    }
  }
  
  return windows;
}

// --- Rate Limiting for Event Ingestion ---

export interface RateLimitConfig {
  readonly maxTokens: number;
  readonly refillRatePerSecond: number;
}

export interface RateLimitState {
  readonly tokens: number;
  readonly lastRefill: number;
}

export function evaluateRateLimit(currentLimitState: RateLimitState, config: RateLimitConfig, now: number, tokensRequired: number): { allowed: boolean; nextState: RateLimitState } {
  const timePassedSec = Math.max(0, (now - currentLimitState.lastRefill) / 1000);
  const newTokens = Math.min(config.maxTokens, currentLimitState.tokens + timePassedSec * config.refillRatePerSecond);
  
  if (newTokens >= tokensRequired) {
    return {
      allowed: true,
      nextState: { tokens: newTokens - tokensRequired, lastRefill: now }
    };
  } else {
    return {
      allowed: false,
      nextState: { tokens: newTokens, lastRefill: now }
    };
  }
}

// --- Transactional Engine API ---

export interface TransactionalContext {
  readonly originalState: EngineState;
  mutableState: EngineState;
  readonly operations: string[];
}

export function beginTransaction(state: EngineState): TransactionalContext {
  return { originalState: state, mutableState: state, operations: [] };
}

export function commitTransaction(tx: TransactionalContext): EngineState {
  // If we had external side-effects we would commit them here.
  // For the pure state engine, we just return the mutated state wrapper.
  return tx.mutableState;
}

export function rollbackTransaction(tx: TransactionalContext): EngineState {
  return tx.originalState;
}

export function executeInTransaction<T>(
  state: EngineState, 
  operation: (tx: TransactionalContext) => T
): { result: T, state: EngineState, committed: boolean } {
  const tx = beginTransaction(state);
  try {
    const result = operation(tx);
    const nextState = commitTransaction(tx);
    return { result, state: nextState, committed: true };
  } catch (err) {
    return { result: undefined as any, state: rollbackTransaction(tx), committed: false };
  }
}

// --- Engine Plugin Architecture ---

export interface EnginePlugin {
  readonly name: string;
  readonly version: string;
  readonly preProcessEvent?: (state: EngineState, input: CreateEventInput) => CreateEventInput;
  readonly postProcessEvent?: (state: EngineState, result: EventProcessResult) => EventProcessResult;
  readonly onLeadCreated?: (state: EngineState, lead: import("./contracts.js").Lead) => void;
}

export class PluginRegistry {
  private plugins: EnginePlugin[] = [];
  
  public register(plugin: EnginePlugin): void {
    if (!this.plugins.find(p => p.name === plugin.name)) {
      this.plugins.push(plugin);
    }
  }
  
  public applyPreProcess(state: EngineState, input: CreateEventInput): CreateEventInput {
    let currentInput = input;
    for (const plugin of this.plugins) {
      if (plugin.preProcessEvent) {
        currentInput = plugin.preProcessEvent(state, currentInput);
      }
    }
    return currentInput;
  }
  
  public applyPostProcess(state: EngineState, result: EventProcessResult): EventProcessResult {
    let currentResult = result;
    for (const plugin of this.plugins) {
      if (plugin.postProcessEvent) {
        currentResult = plugin.postProcessEvent(state, currentResult);
      }
    }
    return currentResult;
  }
}

// A global registry for this runtime instance
export const GlobalPluginRegistry = new PluginRegistry();

// Wrapper around processEvent that uses plugins
export function processEventWithPlugins(state: EngineState, input: CreateEventInput, rules: readonly ScoringRule[], evaluatedAt: Timestamp): EventProcessResult {
  const preProcessedInput = GlobalPluginRegistry.applyPreProcess(state, input);
  const result = processEvent(state, preProcessedInput, rules, evaluatedAt);
  return GlobalPluginRegistry.applyPostProcess(result.state, result);
}

// --- State Snapshotting and Time Travel ---

export interface EngineSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly state: EngineState;
  readonly compressed: boolean;
}

export function createSnapshot(state: EngineState, timestamp: number, id: string): EngineSnapshot {
  return {
    snapshotId: id,
    timestamp,
    // Deep clone to prevent mutations from affecting snapshot
    state: JSON.parse(JSON.stringify(state)) as EngineState,
    compressed: false
  };
}

export function restoreSnapshot(snapshot: EngineSnapshot): EngineState {
  return JSON.parse(JSON.stringify(snapshot.state)) as EngineState;
}

export interface StateDifference {
  readonly addedLeads: readonly string[];
  readonly removedLeads: readonly string[];
  readonly changedScores: readonly { leadId: string; oldScore: number; newScore: number }[];
  readonly newEvents: readonly string[];
}

export function compareSnapshots(oldSnapshot: EngineSnapshot, newSnapshot: EngineSnapshot): StateDifference {
  const oldState = oldSnapshot.state;
  const newState = newSnapshot.state;
  
  const addedLeads: string[] = [];
  const removedLeads: string[] = [];
  const changedScores: { leadId: string; oldScore: number; newScore: number }[] = [];
  const newEvents: string[] = [];
  
  for (const leadId of Object.keys(newState.leads)) {
    if (!oldState.leads[leadId]) addedLeads.push(leadId);
  }
  
  for (const leadId of Object.keys(oldState.leads)) {
    if (!newState.leads[leadId]) removedLeads.push(leadId);
  }
  
  for (const leadId of Object.keys(newState.scores)) {
    const newScore = newState.scores[leadId] ?? 0;
    const oldScore = oldState.scores[leadId] ?? 0;
    if (newScore !== oldScore) {
      changedScores.push({ leadId, oldScore, newScore });
    }
  }
  
  for (const eventId of Object.keys(newState.events)) {
    if (!oldState.events[eventId]) newEvents.push(eventId);
  }
  
  return { addedLeads, removedLeads, changedScores, newEvents };
}

// --- Event Stream CQRS Aggregators ---

export interface LeadAggregationView {
  readonly leadId: string;
  readonly totalEvents: number;
  readonly totalScore: number;
  readonly firstSeen: number;
  readonly lastSeen: number;
  readonly mostFrequentCategory: string;
  readonly eventTypeCounts: Readonly<Record<string, number>>;
}

export function buildLeadAggregationView(state: EngineState, leadId: string): LeadAggregationView {
  const events = getLeadEvents(state, leadId);
  const score = state.scores[leadId] ?? 0;
  
  if (events.length === 0) {
    return {
      leadId, totalEvents: 0, totalScore: score, firstSeen: 0, lastSeen: 0,
      mostFrequentCategory: "none", eventTypeCounts: {}
    };
  }
  
  let first = Number.MAX_SAFE_INTEGER;
  let last = 0;
  const typeCounts: Record<string, number> = {};
  const catCounts: Record<string, number> = {};
  
  for (const e of events) {
    if (e.occurredAt < first) first = e.occurredAt;
    if (e.occurredAt > last) last = e.occurredAt;
    
    typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
    catCounts[e.category] = (catCounts[e.category] ?? 0) + 1;
  }
  
  let mostFreqCat = "none";
  let maxCatCount = 0;
  for (const [cat, count] of Object.entries(catCounts)) {
    if (count > maxCatCount) {
      maxCatCount = count;
      mostFreqCat = cat;
    }
  }
  
  return {
    leadId,
    totalEvents: events.length,
    totalScore: score,
    firstSeen: first,
    lastSeen: last,
    mostFrequentCategory: mostFreqCat,
    eventTypeCounts: typeCounts
  };
}

export interface GlobalAggregationView {
  readonly totalLeads: number;
  readonly activeLeads24h: number; // Leads with events in last 24h
  readonly conversionRate: number;
  readonly averageScore: number;
  readonly eventsByCategory: Readonly<Record<string, number>>;
}

export function buildGlobalAggregationView(state: EngineState, now: number): GlobalAggregationView {
  const leadIds = Object.keys(state.leads);
  const totalLeads = leadIds.length;
  
  if (totalLeads === 0) {
    return { totalLeads: 0, activeLeads24h: 0, conversionRate: 0, averageScore: 0, eventsByCategory: {} };
  }
  
  let convertedCount = 0;
  let activeCount = 0;
  let scoreSum = 0;
  const catCounts: Record<string, number> = {};
  
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (const id of leadIds) {
    const lead = state.leads[id]!;
    if (lead.lifecycle === "converted") convertedCount++;
    scoreSum += state.scores[id] ?? 0;
    
    const events = getLeadEvents(state, id);
    let active = false;
    for (const e of events) {
      catCounts[e.category] = (catCounts[e.category] ?? 0) + 1;
      if (now - e.occurredAt <= dayMs) {
        active = true;
      }
    }
    if (active) activeCount++;
  }
  
  return {
    totalLeads,
    activeLeads24h: activeCount,
    conversionRate: convertedCount / totalLeads,
    averageScore: scoreSum / totalLeads,
    eventsByCategory: catCounts
  };
}

// --- Deterministic Leader Election (Raft-like Node State) ---
// Note: This implements a pure, deterministic simulation of a distributed consensus state machine
// without actual network calls, entirely driven by explicitly passed events.

export type NodeRole = "follower" | "candidate" | "leader";

export interface NodeState {
  readonly nodeId: string;
  readonly role: NodeRole;
  readonly currentTerm: number;
  readonly votedFor: string | null;
  readonly log: readonly { readonly term: number; readonly command: any }[];
  readonly commitIndex: number;
  readonly lastApplied: number;
}

export interface ElectionConfig {
  readonly clusterSize: number;
  readonly electionTimeoutMinMs: number;
  readonly electionTimeoutMaxMs: number;
  readonly heartbeatIntervalMs: number;
}

// We simulate a network event
export type NetworkEvent = 
  | { type: "timer_tick"; now: number; randomEntropy: number } // randomEntropy [0,1] used deterministically
  | { type: "request_vote"; term: number; candidateId: string; lastLogIndex: number; lastLogTerm: number }
  | { type: "vote_reply"; term: number; voteGranted: boolean; fromNodeId: string }
  | { type: "append_entries"; term: number; leaderId: string; prevLogIndex: number; prevLogTerm: number; entries: readonly any[]; leaderCommit: number }
  | { type: "append_reply"; term: number; success: boolean; matchIndex: number; fromNodeId: string };

export function processConsensusEvent(
  node: NodeState, 
  config: ElectionConfig, 
  event: NetworkEvent, 
  stateExt: { 
    lastActivity: number, 
    votesReceived: Set<string>, 
    electionTimeout: number 
  }
): { node: NodeState; messagesToSend: NetworkEvent[]; stateExt: typeof stateExt } {
  
  let nextNode = { ...node };
  const messagesToSend: NetworkEvent[] = [];
  const nextExt = { ...stateExt };
  
  // Step down if higher term seen
  if ('term' in event && event.term > nextNode.currentTerm) {
    nextNode = { ...nextNode, currentTerm: event.term, role: "follower", votedFor: null };
    nextExt.votesReceived.clear();
  }
  
  switch (event.type) {
    case "timer_tick": {
      // Check election timeout
      if (nextNode.role !== "leader" && (event.now - nextExt.lastActivity >= nextExt.electionTimeout)) {
        // Start election
        nextNode = { ...nextNode, role: "candidate", currentTerm: nextNode.currentTerm + 1, votedFor: nextNode.nodeId };
        nextExt.lastActivity = event.now;
        // Deterministic timeout based on entropy
        nextExt.electionTimeout = config.electionTimeoutMinMs + (event.randomEntropy * (config.electionTimeoutMaxMs - config.electionTimeoutMinMs));
        nextExt.votesReceived = new Set([nextNode.nodeId]);
        
        messagesToSend.push({
          type: "request_vote",
          term: nextNode.currentTerm,
          candidateId: nextNode.nodeId,
          lastLogIndex: nextNode.log.length - 1,
          lastLogTerm: nextNode.log.length > 0 ? nextNode.log[nextNode.log.length - 1]!.term : 0
        });
      } else if (nextNode.role === "leader" && (event.now - nextExt.lastActivity >= config.heartbeatIntervalMs)) {
        // Send heartbeat
        nextExt.lastActivity = event.now;
        messagesToSend.push({
          type: "append_entries",
          term: nextNode.currentTerm,
          leaderId: nextNode.nodeId,
          prevLogIndex: nextNode.log.length - 1,
          prevLogTerm: nextNode.log.length > 0 ? nextNode.log[nextNode.log.length - 1]!.term : 0,
          entries: [],
          leaderCommit: nextNode.commitIndex
        });
      }
      break;
    }
    
    case "request_vote": {
      let voteGranted = false;
      const logOk = (event.lastLogTerm > (nextNode.log[nextNode.log.length - 1]?.term ?? 0)) ||
                    (event.lastLogTerm === (nextNode.log[nextNode.log.length - 1]?.term ?? 0) && event.lastLogIndex >= nextNode.log.length - 1);
                    
      if (event.term === nextNode.currentTerm && (nextNode.votedFor === null || nextNode.votedFor === event.candidateId) && logOk) {
        voteGranted = true;
        nextNode = { ...nextNode, votedFor: event.candidateId };
        nextExt.lastActivity = 0; // effectively resets timer
      }
      
      messagesToSend.push({
        type: "vote_reply",
        term: nextNode.currentTerm,
        voteGranted,
        fromNodeId: nextNode.nodeId
      });
      break;
    }
    
    case "vote_reply": {
      if (nextNode.role === "candidate" && event.term === nextNode.currentTerm && event.voteGranted) {
        nextExt.votesReceived.add(event.fromNodeId);
        if (nextExt.votesReceived.size > config.clusterSize / 2) {
          // Become leader
          nextNode = { ...nextNode, role: "leader" };
          // Send initial heartbeat
          messagesToSend.push({
            type: "append_entries",
            term: nextNode.currentTerm,
            leaderId: nextNode.nodeId,
            prevLogIndex: nextNode.log.length - 1,
            prevLogTerm: nextNode.log.length > 0 ? nextNode.log[nextNode.log.length - 1]!.term : 0,
            entries: [],
            leaderCommit: nextNode.commitIndex
          });
        }
      }
      break;
    }
    
    case "append_entries": {
      if (event.term >= nextNode.currentTerm) {
        nextExt.lastActivity = 0; // reset timer
      }
      
      let success = false;
      if (event.term >= nextNode.currentTerm) {
        // Log matching check (simplified)
        if (event.prevLogIndex === -1 || (nextNode.log[event.prevLogIndex] && nextNode.log[event.prevLogIndex]!.term === event.prevLogTerm)) {
          success = true;
          // Append new entries and update commit index (simplified for this mock)
          if (event.leaderCommit > nextNode.commitIndex) {
            nextNode = { ...nextNode, commitIndex: Math.min(event.leaderCommit, nextNode.log.length - 1) };
          }
        }
      }
      
      messagesToSend.push({
        type: "append_reply",
        term: nextNode.currentTerm,
        success,
        matchIndex: success ? event.prevLogIndex + event.entries.length : 0,
        fromNodeId: nextNode.nodeId
      });
      break;
    }
    
    case "append_reply": {
      // For leader state tracking (simplified, normally updates nextIndex/matchIndex)
      break;
    }
  }
  
  return { node: nextNode, messagesToSend, stateExt: nextExt };
}
