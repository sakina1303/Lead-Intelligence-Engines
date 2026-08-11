import type { EngineState, Outcome, ScoreExplanation, ScoringRule } from "../contracts.js";
import { getLeadEvents } from "../event-ledger.js";
import { scoreEvent } from "./projection.js";
import { failure, success } from "../validation.js";

export interface ReplayResult {
  readonly state: EngineState;
  readonly history: readonly ScoreExplanation[];
  readonly impactAnalysis?: ImpactAnalysis;
}

export interface ImpactAnalysis {
  readonly originalTotalScore: number;
  readonly replayedTotalScore: number;
  readonly scoreDelta: number;
  readonly newlyMatchedRules: readonly string[];
  readonly droppedRules: readonly string[];
}

export function replayLeadScoring(state: EngineState, leadId: string, rules: readonly ScoringRule[], originalRules?: readonly ScoringRule[]): Outcome<ReplayResult> {
  if (!state.leads[leadId]) return failure(`lead '${leadId}' does not exist`);
  
  let next: EngineState = {
    ...state,
    scores: { ...state.scores, [leadId]: 0 },
    scoreHistory: { ...state.scoreHistory, [leadId]: [] },
    scoreProjections: { ...state.scoreProjections, [leadId]: { leadId, total: 0, dimensions: {}, updatedAt: 0 } }
  };
  
  const events = getLeadEvents(next, leadId);
  const replayedRuleIds = new Set<string>();
  
  for (const event of events) {
    const res = scoreEvent(next, event, rules);
    next = res.state;
    res.explanation.ruleIds.forEach(id => replayedRuleIds.add(id));
  }
  
  let impactAnalysis: ImpactAnalysis | undefined = undefined;
  
  if (originalRules) {
    const originalTotalScore = state.scores[leadId] ?? 0;
    const replayedTotalScore = next.scores[leadId] ?? 0;
    
    const originalHistory = state.scoreHistory[leadId] ?? [];
    const originalRuleIds = new Set<string>();
    originalHistory.forEach(exp => exp.ruleIds.forEach(id => originalRuleIds.add(id)));
    
    const newlyMatchedRules = [...replayedRuleIds].filter(id => !originalRuleIds.has(id));
    const droppedRules = [...originalRuleIds].filter(id => !replayedRuleIds.has(id));
    
    impactAnalysis = {
      originalTotalScore,
      replayedTotalScore,
      scoreDelta: replayedTotalScore - originalTotalScore,
      newlyMatchedRules,
      droppedRules
    };
  }

  return success<ReplayResult>({ state: next, history: next.scoreHistory[leadId] ?? [], ...(impactAnalysis ? { impactAnalysis } : {}) });
}

// --- Snapshot Isolation and Shadow Execution ---

export interface ShadowExecutionResult {
  readonly shadowState: EngineState;
  readonly baseScore: number;
  readonly shadowScore: number;
  readonly scoreDelta: number;
  readonly newlyQualified: boolean;
  readonly disqualified: boolean;
}

export function runShadowPolicyExecution(
  state: EngineState,
  leadId: string,
  shadowRules: readonly ScoringRule[],
  shadowQualificationPolicies: readonly import("../contracts.js").QualificationPolicy[],
  evaluatedAt: number,
  shadowConfig?: { cap?: number; floor?: number }
): Outcome<ShadowExecutionResult> {
  
  if (!state.leads[leadId]) return failure(`lead '${leadId}' does not exist`);
  
  const baseScore = state.scores[leadId] ?? 0;
  const baseQual = state.qualifications[leadId]?.state ?? "unqualified";
  
  const replayResult = replayLeadScoring(state, leadId, shadowRules);
  if (!replayResult.ok) return replayResult;
  
  let shadowState = replayResult.value.state;
  let shadowScore = shadowState.scores[leadId] ?? 0;
  
  if (shadowConfig?.cap !== undefined) shadowScore = Math.min(shadowScore, shadowConfig.cap);
  if (shadowConfig?.floor !== undefined) shadowScore = Math.max(shadowScore, shadowConfig.floor);
  
  // Re-evaluate qualification based on shadow rules and score
  let shadowQualState: string = "unqualified";
  const sortedQualPolicies = [...shadowQualificationPolicies].sort((a, b) => (b.minimumScore ?? 0) - (a.minimumScore ?? 0));
  
  for (const policy of sortedQualPolicies) {
    if (shadowScore >= (policy.minimumScore ?? 0)) {
       shadowQualState = policy.qualification;
       break;
    }
  }
  
  return success({
    shadowState: {
      ...shadowState,
      scores: { ...shadowState.scores, [leadId]: shadowScore },
      qualifications: { 
        ...shadowState.qualifications, 
        [leadId]: { leadId, policyId: "shadow", state: shadowQualState as import("../contracts.js").QualificationState, evaluatedAt, reasons: ["evaluated against supplied shadow policy"] } 
      }
    },
    baseScore,
    shadowScore,
    scoreDelta: shadowScore - baseScore,
    newlyQualified: baseQual === "unqualified" && shadowQualState !== "unqualified",
    disqualified: baseQual !== "unqualified" && shadowQualState === "unqualified",
  });
}

// --- Point-in-Time Recovery and Time-Travel Queries ---

export interface TimeTravelContext {
  readonly stateAtTime: EngineState;
  readonly eventsDiscarded: number;
  readonly restoredScore: number;
}

export function getStateAtTimestamp(state: EngineState, timestamp: number): TimeTravelContext {
  const timeTravelLeads: Record<string, import("../contracts.js").Lead> = {};
  const timeTravelEvents: Record<string, import("../contracts.js").DomainEvent> = {};
  const timeTravelScores: Record<string, number> = {};
  const timeTravelEventIdsByLead: Record<string, string[]> = {};
  const timeTravelScoreHistory: Record<string, import("../contracts.js").ScoreExplanation[]> = {};
  
  let eventsDiscarded = 0;
  
  // 1. Rebuild Leads
  for (const [id, lead] of Object.entries(state.leads)) {
    if (lead.createdAt <= timestamp) {
      timeTravelLeads[id] = lead;
      timeTravelScores[id] = 0;
      timeTravelEventIdsByLead[id] = [];
      timeTravelScoreHistory[id] = [];
    }
  }
  
  // 2. Rebuild Events
  const sortedEvents = Object.values(state.events).sort((a, b) => a.occurredAt - b.occurredAt);
  for (const event of sortedEvents) {
    if (event.occurredAt <= timestamp) {
      if (timeTravelLeads[event.leadId]) {
         timeTravelEvents[event.id] = event;
         timeTravelEventIdsByLead[event.leadId]!.push(event.id);
      }
    } else {
      eventsDiscarded++;
    }
  }
  
  const timeTravelState: EngineState = {
    config: state.config,
    leads: timeTravelLeads,
    events: timeTravelEvents,
    scores: timeTravelScores,
    eventIdsByLead: timeTravelEventIdsByLead,
    scoreHistory: timeTravelScoreHistory,
    scoreProjections: {},
    qualifications: {},
    segments: {},
    profiles: {},
    leadHistory: {},
  };
  
  return {
    stateAtTime: timeTravelState,
    eventsDiscarded,
    restoredScore: 0
  };
}

export function replayLeadToTimestamp(state: EngineState, leadId: string, timestamp: number, rules: readonly ScoringRule[]): Outcome<number> {
  const timeTravelCtx = getStateAtTimestamp(state, timestamp);
  const timeTravelState = timeTravelCtx.stateAtTime;
  
  if (!timeTravelState.leads[leadId]) return failure(`lead '${leadId}' did not exist at timestamp ${timestamp}`);
  
  const replayResult = replayLeadScoring(timeTravelState, leadId, rules);
  if (!replayResult.ok) return replayResult;
  
  return success(replayResult.value.state.scores[leadId] ?? 0);
}

// --- Deterministic Policy Backtesting ---

export interface BacktestConfig {
  readonly baselineRules: readonly ScoringRule[];
  readonly experimentalRules: readonly ScoringRule[];
  readonly targetLeadIds?: readonly string[];
  readonly startTime?: number;
  readonly endTime?: number;
}

export interface LeadBacktestResult {
  readonly leadId: string;
  readonly baselineScore: number;
  readonly experimentalScore: number;
  readonly scoreDelta: number;
  readonly baselineQualified: boolean;
  readonly experimentalQualified: boolean;
  readonly newlyQualified: boolean;
  readonly disqualified: boolean;
}

export interface BacktestSummary {
  readonly totalLeadsEvaluated: number;
  readonly averageBaselineScore: number;
  readonly averageExperimentalScore: number;
  readonly meanScoreDelta: number;
  readonly totalNewlyQualified: number;
  readonly totalDisqualified: number;
  readonly results: readonly LeadBacktestResult[];
}

export function runPolicyBacktest(
  state: EngineState,
  config: BacktestConfig,
  qualificationPolicies: readonly import("../contracts.js").QualificationPolicy[]
): Outcome<BacktestSummary> {
  const leadIds = config.targetLeadIds ?? Object.keys(state.leads);
  const results: LeadBacktestResult[] = [];
  
  let totalBaseline = 0;
  let totalExperimental = 0;
  let newlyQualifiedCount = 0;
  let disqualifiedCount = 0;
  
  const sortedQualPolicies = [...qualificationPolicies].sort((a, b) => (b.minimumScore ?? 0) - (a.minimumScore ?? 0));
  
  for (const leadId of leadIds) {
    if (!state.leads[leadId]) continue;
    
    // Evaluate Baseline
    const baselineRes = replayLeadScoring(state, leadId, config.baselineRules);
    if (!baselineRes.ok) continue;
    const baselineScore = baselineRes.value.state.scores[leadId] ?? 0;
    
    // Evaluate Experimental
    const experimentalRes = replayLeadScoring(state, leadId, config.experimentalRules);
    if (!experimentalRes.ok) continue;
    const experimentalScore = experimentalRes.value.state.scores[leadId] ?? 0;
    
    let baseQual = false;
    let expQual = false;
    
    for (const policy of sortedQualPolicies) {
      if (!baseQual && baselineScore >= (policy.minimumScore ?? 0)) {
        baseQual = true;
      }
      if (!expQual && experimentalScore >= (policy.minimumScore ?? 0)) {
        expQual = true;
      }
    }
    
    const newlyQualified = !baseQual && expQual;
    const disqualified = baseQual && !expQual;
    
    if (newlyQualified) newlyQualifiedCount++;
    if (disqualified) disqualifiedCount++;
    
    totalBaseline += baselineScore;
    totalExperimental += experimentalScore;
    
    results.push({
      leadId,
      baselineScore,
      experimentalScore,
      scoreDelta: experimentalScore - baselineScore,
      baselineQualified: baseQual,
      experimentalQualified: expQual,
      newlyQualified,
      disqualified
    });
  }
  
  const totalLeadsEvaluated = results.length;
  if (totalLeadsEvaluated === 0) return failure("No leads evaluated in backtest");
  
  return success({
    totalLeadsEvaluated,
    averageBaselineScore: totalBaseline / totalLeadsEvaluated,
    averageExperimentalScore: totalExperimental / totalLeadsEvaluated,
    meanScoreDelta: (totalExperimental - totalBaseline) / totalLeadsEvaluated,
    totalNewlyQualified: newlyQualifiedCount,
    totalDisqualified: disqualifiedCount,
    results
  });
}

// --- What-If Deterministic Modeling ---

export interface WhatIfScenario {
  readonly id: string;
  readonly name: string;
  readonly eventsToInject: readonly import("../contracts.js").CreateEventInput[];
  readonly eventsToDrop: readonly string[]; // eventIds
  readonly ruleOverrides: readonly ScoringRule[]; // Replaces existing rules with same ID
}

export interface WhatIfResult {
  readonly scenarioId: string;
  readonly leadId: string;
  readonly projectedScore: number;
  readonly projectedQualification: string;
  readonly scoreDeltaFromCurrent: number;
}

export function evaluateWhatIfScenario(
  state: EngineState,
  leadId: string,
  scenario: WhatIfScenario,
  currentRules: readonly ScoringRule[],
  qualificationPolicies: readonly import("../contracts.js").QualificationPolicy[]
): Outcome<WhatIfResult> {
  if (!state.leads[leadId]) return failure(`lead '${leadId}' does not exist`);
  
  const currentScore = state.scores[leadId] ?? 0;
  
  // 1. Build modified rule set
  const overrideMap = new Map<string, ScoringRule>();
  for (const r of scenario.ruleOverrides) overrideMap.set(r.id, r);
  
  const modifiedRules = currentRules.map(r => overrideMap.get(r.id) ?? r);
  for (const r of scenario.ruleOverrides) {
    if (!currentRules.find(cr => cr.id === r.id)) {
      modifiedRules.push(r);
    }
  }
  
  // 2. Build a complete, ordered event stream for this lead. Scenario events
  // are already domain events, so no synthetic identifiers or categories are
  // invented here.
  const currentEvents = getLeadEvents(state, leadId);
  const dropSet = new Set(scenario.eventsToDrop);
  const keptEvents = currentEvents.filter(e => !dropSet.has(e.id));
  const injectedEvents = scenario.eventsToInject;
  for (const injected of injectedEvents) {
    if (injected.leadId !== leadId) return failure(`injected event '${injected.id}' belongs to '${injected.leadId}', not '${leadId}'`);
    if (state.events[injected.id] && !dropSet.has(injected.id)) return failure(`injected event '${injected.id}' conflicts with an existing ledger event`);
  }
  const allEvents = [...keptEvents, ...injectedEvents].sort((a, b) => a.occurredAt - b.occurredAt || a.sequence - b.sequence || a.id.localeCompare(b.id));
  if (new Set(allEvents.map((event) => event.id)).size !== allEvents.length) return failure("scenario produces duplicate event identifiers");

  const scenarioEvents = { ...state.events } as Record<string, import("../contracts.js").DomainEvent>;
  for (const event of currentEvents) delete scenarioEvents[event.id];
  for (const event of allEvents) scenarioEvents[event.id] = event;
  const scenarioIndex = { ...state.eventIdsByLead, [leadId]: allEvents.map((event) => event.id) };
  let scenarioState: EngineState = {
    ...state,
    scores: { ...state.scores, [leadId]: 0 },
    scoreHistory: { ...state.scoreHistory, [leadId]: [] },
    scoreProjections: { ...state.scoreProjections, [leadId]: { leadId, total: 0, dimensions: {}, updatedAt: 0 } },
    events: scenarioEvents,
    eventIdsByLead: scenarioIndex
  };
  
  for (const event of allEvents) {
    const res = scoreEvent(scenarioState, event, modifiedRules);
    scenarioState = res.state;
  }
  
  const projectedScore = scenarioState.scores[leadId] ?? 0;
  
  // 4. Qualification
  let projectedQualification = "unqualified";
  const sortedQualPolicies = [...qualificationPolicies].sort((a, b) => (b.minimumScore ?? 0) - (a.minimumScore ?? 0));
  
  for (const policy of sortedQualPolicies) {
    if (projectedScore >= (policy.minimumScore ?? 0)) {
       projectedQualification = policy.qualification;
       break;
    }
  }
  
  return success({
    scenarioId: scenario.id,
    leadId,
    projectedScore,
    projectedQualification,
    scoreDeltaFromCurrent: projectedScore - currentScore
  });
}

// --- Causality Trees for Event Scoring ---

export interface CausalityNode {
  readonly eventId: string;
  readonly eventType: string;
  readonly ruleId: string;
  readonly scoreImpact: number;
  readonly dependencies: readonly CausalityNode[];
}

export function buildScoringCausalityTree(
  state: EngineState,
  leadId: string,
  targetEventId: string
): Outcome<CausalityNode> {
  const history = state.scoreHistory[leadId] ?? [];
  const targetExp = history.find(h => h.eventId === targetEventId);
  
  if (!targetExp) return failure(`Event '${targetEventId}' not found in score history for lead '${leadId}'`);
  
  const event = state.events[targetEventId];
  if (!event) return failure(`Event '${targetEventId}' not found in event ledger`);
  
  // In a purely functional append-only system without explicit event dependencies,
  // we infer causality based on time-window proximity and shared attributes.
  
  const priorEvents = history.filter(h => h.occurredAt < targetExp.occurredAt);
  
  // Find potential causes (events within last 24h that share attributes)
  const windowMs = 24 * 60 * 60 * 1000;
  const potentialCauses = priorEvents.filter(h => targetExp.occurredAt - h.occurredAt <= windowMs);
  
  const dependencies: CausalityNode[] = [];
  
  // Deterministic dependency extraction
  for (const cause of potentialCauses.slice(-3)) { // Max 3 dependencies to prevent explosion
    const causeEvent = state.events[cause.eventId];
    if (causeEvent) {
      // Very naive dependency link: just temporal precedence
      dependencies.push({
        eventId: cause.eventId,
        eventType: causeEvent.type,
        ruleId: cause.ruleIds[0] ?? "unknown",
        scoreImpact: cause.appliedDelta,
        dependencies: [] // We could recurse here, but keep it shallow for this module
      });
    }
  }
  
  return success({
    eventId: targetEventId,
    eventType: event.type,
    ruleId: targetExp.ruleIds[0] ?? "unknown",
    scoreImpact: targetExp.appliedDelta,
    dependencies
  });
}

// --- Variance Analysis ---

export interface VarianceReport {
  readonly leadId: string;
  readonly scoreVariance: number;
  readonly highImpactEventsCount: number;
  readonly volatilityIndex: number;
  readonly expectedScoreGivenHistory: number;
}

export function calculateScoreVariance(state: EngineState, leadId: string): Outcome<VarianceReport> {
  const history = state.scoreHistory[leadId] ?? [];
  if (history.length === 0) return failure("No score history available for variance analysis");
  
  const scores = history.map(h => h.nextScore);
  const n = scores.length;
  
  const mean = scores.reduce((s, v) => s + v, 0) / n;
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
  
  let highImpactEventsCount = 0;
  for (const h of history) {
    if (Math.abs(h.appliedDelta) >= 15) {
      highImpactEventsCount++;
    }
  }
  
  const stdDev = Math.sqrt(variance);
  const volatilityIndex = mean === 0 ? 0 : stdDev / Math.abs(mean);
  
  // Simple moving average for expected next score
  const recentScores = scores.slice(-3);
  const expectedScoreGivenHistory = recentScores.length > 0 
    ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length 
    : mean;
  
  return success({
    leadId,
    scoreVariance: variance,
    highImpactEventsCount,
    volatilityIndex,
    expectedScoreGivenHistory: Math.round(expectedScoreGivenHistory)
  });
}

// --- Rule Permutation Sensitivity ---

export interface RuleSensitivity {
  readonly ruleId: string;
  readonly removalImpactOnTotalScore: number;
  readonly removalImpactOnQualification: "none" | "disqualified" | "downgraded";
}

export function analyzeRuleSensitivity(
  state: EngineState, 
  leadId: string, 
  _currentRules: readonly ScoringRule[],
  qualificationPolicies: readonly import("../contracts.js").QualificationPolicy[]
): Outcome<readonly RuleSensitivity[]> {
  const baseScore = state.scores[leadId] ?? 0;
  const sensitivities: RuleSensitivity[] = [];
  
  const sortedQualPolicies = [...qualificationPolicies].sort((a, b) => (b.minimumScore ?? 0) - (a.minimumScore ?? 0));
  let baseQual = "unqualified";
  for (const p of sortedQualPolicies) {
    if (baseScore >= (p.minimumScore ?? 0)) {
      baseQual = p.qualification;
      break;
    }
  }
  
  // O(N) where N is number of rules that applied to this lead.
  // Find which rules actually applied first
  const history = state.scoreHistory[leadId] ?? [];
  const appliedRuleIds = new Set<string>();
  for (const h of history) {
    for (const rid of h.ruleIds) appliedRuleIds.add(rid);
  }
  
  for (const ruleId of appliedRuleIds) {
    
    // We can optimize this by just subtracting the known impacts of this rule from the history
    // instead of a full replay, because our engine is additive and commutative (mostly).
    let simulatedScore = baseScore;
    for (const h of history) {
      if (h.ruleIds.includes(ruleId)) {
        // If it was the only rule, subtract its full impact
        if (h.ruleIds.length === 1) simulatedScore -= h.appliedDelta;
        // If it was one of many, subtract proportional impact
        else simulatedScore -= (h.appliedDelta / h.ruleIds.length);
      }
    }
    
    let simQual = "unqualified";
    for (const p of sortedQualPolicies) {
      if (simulatedScore >= (p.minimumScore ?? 0)) {
        simQual = p.qualification;
        break;
      }
    }
    
    let qualImpact: "none" | "disqualified" | "downgraded" = "none";
    if (baseQual !== "unqualified" && simQual === "unqualified") {
      qualImpact = "disqualified";
    } else if (baseQual !== simQual && baseQual !== "unqualified") {
      // Naive downgrade check
      qualImpact = "downgraded";
    }
    
    sensitivities.push({
      ruleId,
      removalImpactOnTotalScore: simulatedScore - baseScore,
      removalImpactOnQualification: qualImpact
    });
  }
  
  return success(sensitivities.sort((a, b) => Math.abs(b.removalImpactOnTotalScore) - Math.abs(a.removalImpactOnTotalScore)));
}
