import type { DomainEvent, EngineState, ScoreExplanation, ScoringRule } from "./contracts.js";
import { matchingRules, selectRules } from "./rule-evaluation.js";

export function clampScore(score: number, floor: number, cap: number): number {
  return Math.min(cap, Math.max(floor, score));
}

export function scoreEvent(state: EngineState, event: DomainEvent, rules: readonly ScoringRule[]): { readonly state: EngineState; readonly explanation: ScoreExplanation } {
  const lead = state.leads[event.leadId]!;
  const previousScore = state.scores[event.leadId] ?? 0;
  const selected = selectRules(matchingRules(rules, event, lead), state.config.scorePolicy.conflictMode);
  const requestedDelta = selected.reduce((total, rule) => total + rule.delta, 0);
  const nextScore = clampScore(previousScore + requestedDelta, state.config.scorePolicy.floor, state.config.scorePolicy.cap);
  const explanation: ScoreExplanation = {
    eventId: event.id,
    leadId: event.leadId,
    occurredAt: event.occurredAt,
    previousScore,
    nextScore,
    requestedDelta,
    appliedDelta: nextScore - previousScore,
    ruleIds: selected.map((rule) => rule.id),
    reason: selected.length === 0 ? "no-match" : "scored",
  };
  return {
    state: {
      ...state,
      scores: { ...state.scores, [event.leadId]: nextScore },
      scoreHistory: { ...state.scoreHistory, [event.leadId]: [...(state.scoreHistory[event.leadId] ?? []), explanation] },
    },
    explanation,
  };
}

export function scoreForLead(state: EngineState, leadId: string): number {
  return state.scores[leadId] ?? 0;
}
