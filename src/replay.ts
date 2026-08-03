import type { EngineState, Outcome, ScoreExplanation, ScoringRule } from "./contracts.js";
import { getLeadEvents } from "./event-ledger.js";
import { scoreEvent } from "./scoring.js";
import { failure, success } from "./validation.js";

export interface ReplayResult {
  readonly state: EngineState;
  readonly history: readonly ScoreExplanation[];
}

export function replayLeadScoring(state: EngineState, leadId: string, rules: readonly ScoringRule[]): Outcome<ReplayResult> {
  if (!state.leads[leadId]) return failure(`lead '${leadId}' does not exist`);
  let next: EngineState = {
    ...state,
    scores: { ...state.scores, [leadId]: 0 },
    scoreHistory: { ...state.scoreHistory, [leadId]: [] },
  };
  for (const event of getLeadEvents(next, leadId)) next = scoreEvent(next, event, rules).state;
  return success({ state: next, history: next.scoreHistory[leadId] ?? [] });
}
