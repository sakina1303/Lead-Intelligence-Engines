import type { EngineState, Outcome, ScoreExplanation, ScoringRule } from "./contracts.js";
import { getLeadEvents } from "./event-ledger.js";
import { scoreEvent } from "./scoring.js";
import { failure, success } from "./validation.js";

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
  shadowQualificationPolicies: readonly import("./contracts.js").QualificationPolicy[],
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
        [leadId]: { leadId, policyId: "shadow", state: shadowQualState as any, evaluatedAt: Date.now(), reasons: [] } 
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
  const timeTravelLeads: Record<string, import("./contracts.js").Lead> = {};
  const timeTravelEvents: Record<string, import("./contracts.js").DomainEvent> = {};
  const timeTravelScores: Record<string, number> = {};
  const timeTravelEventIdsByLead: Record<string, string[]> = {};
  const timeTravelScoreHistory: Record<string, import("./contracts.js").ScoreExplanation[]> = {};
  
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
