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
  let prevEventWithLocation = events.find(e => e.metadata?.lat && e.metadata?.lon);
  if (prevEventWithLocation) {
    for (let i = events.indexOf(prevEventWithLocation) + 1; i < events.length; i++) {
      const e = events[i]!;
      if (e.metadata?.lat && e.metadata?.lon) {
        const timeDiffSec = (e.occurredAt - prevEventWithLocation.occurredAt) / 1000;
        if (timeDiffSec > 0) {
          // Haversine mock distance
          const lat1 = Number(prevEventWithLocation.metadata.lat);
          const lon1 = Number(prevEventWithLocation.metadata.lon);
          const lat2 = Number(e.metadata.lat);
          const lon2 = Number(e.metadata.lon);
          
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
