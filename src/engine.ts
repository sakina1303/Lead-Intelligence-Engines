import type { CreateEventInput, CreateLeadInput, EngineConfig, EngineState, EventProcessResult, InvariantKind, ScoringRule, StateAuditResult, StateInvariantViolation, Timestamp } from "./contracts.js";
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

/**
 * Audits the denormalised parts of EngineState.  The event ledger is the source
 * of truth; indexes, scores, projections, qualifications, and segments are all
 * derived views and are checked against it without changing the input state.
 */
export function auditEngineState(state: EngineState): StateAuditResult {
  const violations: StateInvariantViolation[] = [];
  const add = (kind: InvariantKind, entityId: string, entityType: StateInvariantViolation["entityType"], message: string, severity: StateInvariantViolation["severity"] = "error") => {
    violations.push({ kind, entityId, entityType, message, severity });
  };
  const indexed = new Set<string>();

  for (const [leadId, eventIds] of Object.entries(state.eventIdsByLead)) {
    if (!state.leads[leadId]) add("missing-lead-events-index", leadId, "lead", "event index exists for a missing lead");
    let previous: import("./contracts.js").DomainEvent | undefined;
    for (const eventId of eventIds) {
      if (indexed.has(eventId)) add("duplicate-event-id", eventId, "event", "event appears more than once in the lead index");
      indexed.add(eventId);
      const event = state.events[eventId];
      if (!event) {
        add("orphaned-event", eventId, "event", "event index references an event that is absent from the ledger");
        continue;
      }
      if (event.leadId !== leadId) add("orphaned-event", eventId, "event", "event is indexed under a different lead");
      if (previous && (event.occurredAt < previous.occurredAt || (event.occurredAt === previous.occurredAt && event.sequence < previous.sequence))) {
        add("event-order-violation", leadId, "event", "events are not ordered by occurredAt and sequence", "warning");
      }
      previous = event;
    }
  }
  for (const event of Object.values(state.events)) {
    if (!state.leads[event.leadId]) add("orphaned-event", event.id, "event", "ledger event belongs to a missing lead");
    if (!indexed.has(event.id)) add("missing-lead-events-index", event.id, "event", "ledger event is absent from the lead index");
  }
  for (const leadId of Object.keys(state.leads)) {
    if (!state.eventIdsByLead[leadId]) add("missing-lead-events-index", leadId, "lead", "lead has no event index");
    const score = state.scores[leadId];
    if (score !== undefined && score < state.config.scorePolicy.floor) add("negative-score-below-floor", leadId, "score", "score is below the configured floor");
    if (score !== undefined && score > state.config.scorePolicy.cap) add("score-above-cap", leadId, "score", "score is above the configured cap");
    const projection = state.scoreProjections[leadId];
    if (projection && projection.total !== (score ?? 0)) add("score-projection-stale", leadId, "score", "score projection total differs from current score");
    const history = state.scoreHistory[leadId] ?? [];
    if (history.length > 0 && history[history.length - 1]!.nextScore !== (score ?? 0)) add("score-history-mismatch", leadId, "history", "last score history entry differs from current score");
  }
  for (const leadId of Object.keys(state.scores)) if (!state.leads[leadId]) add("orphaned-score", leadId, "score", "score belongs to a missing lead");
  for (const leadId of Object.keys(state.profiles)) if (!state.leads[leadId]) add("profile-orphaned", leadId, "profile", "profile belongs to a missing lead");
  for (const leadId of Object.keys(state.leadHistory)) if (!state.leads[leadId]) add("history-orphaned", leadId, "history", "lead history belongs to a missing lead");

  const summary = {} as Record<InvariantKind, number>;
  for (const violation of violations) summary[violation.kind] = (summary[violation.kind] ?? 0) + 1;
  return { violations, auditedLeads: Object.keys(state.leads).length, auditedEvents: Object.keys(state.events).length, isConsistent: violations.every((item) => item.severity !== "error"), summary };
}

/** Rebuilds score-dependent views from the ledger, retaining only valid events. */
export function reconcileEngineState(state: EngineState, rules: readonly ScoringRule[], evaluatedAt: Timestamp): EngineState {
  const events = Object.fromEntries(Object.values(state.events).filter((event) => state.leads[event.leadId]).map((event) => [event.id, event]));
  const eventIdsByLead: Record<string, string[]> = Object.fromEntries(Object.keys(state.leads).map((leadId) => [leadId, []]));
  for (const event of Object.values(events)) eventIdsByLead[event.leadId]!.push(event.id);
  for (const ids of Object.values(eventIdsByLead)) ids.sort((left, right) => {
    const a = events[left]!; const b = events[right]!;
    return a.occurredAt - b.occurredAt || a.sequence - b.sequence || a.id.localeCompare(b.id);
  });
  let next: EngineState = { ...state, events, eventIdsByLead, scores: {}, scoreHistory: {}, scoreProjections: {}, qualifications: {}, segments: {} };
  for (const leadId of Object.keys(next.leads).sort()) {
    const replayed = replayLeadScoring(next, leadId, rules);
    if (replayed.ok) next = replayed.value.state;
    const refreshed = refreshLeadIntelligence(next, leadId, evaluatedAt);
    if (refreshed.outcome === "accepted") next = refreshed.state;
  }
  return next;
}

/** Removes derived intelligence for selected leads, leaving the append-only lead and event records intact. */
export function resetLeadIntelligence(state: EngineState, leadIds: readonly string[]): EngineState {
  const selected = new Set(leadIds.filter((leadId) => state.leads[leadId]));
  const without = <T>(source: Readonly<Record<string, T>>): Record<string, T> => Object.fromEntries(Object.entries(source).filter(([id]) => !selected.has(id)));
  return { ...state, scores: without(state.scores), scoreHistory: without(state.scoreHistory), scoreProjections: without(state.scoreProjections), qualifications: without(state.qualifications), segments: without(state.segments) };
}

export interface BulkProcessResult {
  readonly state: EngineState;
  readonly accepted: readonly string[];
  readonly duplicates: readonly string[];
  readonly rejected: readonly { readonly eventId: string; readonly errors: readonly string[] }[];
}

/** Processes a caller-ordered batch. A rejection is isolated; accepted events remain durable in the returned state. */
export function processEventsInOrder(state: EngineState, events: readonly CreateEventInput[], rules: readonly ScoringRule[], evaluatedAt: Timestamp): BulkProcessResult {
  let next = state;
  const accepted: string[] = []; const duplicates: string[] = []; const rejected: { eventId: string; errors: readonly string[] }[] = [];
  for (const event of events) {
    const result = processEvent(next, event, rules, evaluatedAt);
    if (result.outcome === "accepted") { next = result.state; accepted.push(event.id); }
    else if (result.outcome === "duplicate") { next = result.state; duplicates.push(event.id); }
    else rejected.push({ eventId: event.id, errors: result.errors ?? ["event rejected"] });
  }
  return { state: next, accepted, duplicates, rejected };
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
  
  const locationOf = (event: import("./contracts.js").DomainEvent): { latitude: number; longitude: number } | undefined => {
    const latitude = event.attributes["latitude"];
    const longitude = event.attributes["longitude"];
    return typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude } : undefined;
  };
  let prevEventWithLocation = events.find((event) => locationOf(event) !== undefined);
  if (prevEventWithLocation) {
    for (let i = events.indexOf(prevEventWithLocation) + 1; i < events.length; i++) {
      const e = events[i]!;
      const previousLocation = locationOf(prevEventWithLocation);
      const currentLocation = locationOf(e);
      if (previousLocation && currentLocation) {
        const timeDiffSec = (e.occurredAt - prevEventWithLocation.occurredAt) / 1000;
        if (timeDiffSec > 0) {
          const latitudeDelta = currentLocation.latitude - previousLocation.latitude;
          const longitudeDelta = currentLocation.longitude - previousLocation.longitude;
          const distMeters = Math.sqrt(latitudeDelta ** 2 + longitudeDelta ** 2) * 111000;
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
): { readonly result: T; readonly state: EngineState; readonly committed: true } | { readonly state: EngineState; readonly committed: false; readonly error: string } {
  const tx = beginTransaction(state);
  try {
    const result = operation(tx);
    const nextState = commitTransaction(tx);
    return { result, state: nextState, committed: true };
  } catch (error) {
    return { state: rollbackTransaction(tx), committed: false, error: error instanceof Error ? error.message : String(error) };
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
