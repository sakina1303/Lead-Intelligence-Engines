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

  return success({ state: next, history: next.scoreHistory[leadId] ?? [], impactAnalysis });
}
