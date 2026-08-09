import type { DomainEvent, EngineState, ScoreExplanation, ScoreProjection, ScoringRule } from "./contracts.js";
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
  const priorProjection = state.scoreProjections[event.leadId] ?? { leadId: event.leadId, total: previousScore, dimensions: {}, updatedAt: event.occurredAt };
  const dimensions = { ...priorProjection.dimensions };
  for (const rule of selected) for (const [dimensionId, delta] of Object.entries(rule.dimensionDeltas ?? {})) {
    const definition = state.config.scorePolicy.dimensions?.find((item) => item.id === dimensionId);
    const prior = dimensions[dimensionId] ?? 0;
    dimensions[dimensionId] = definition === undefined ? prior + delta : clampScore(prior + delta, definition.floor, definition.cap);
  }
  return {
    state: {
      ...state,
      scores: { ...state.scores, [event.leadId]: nextScore },
      scoreProjections: { ...state.scoreProjections, [event.leadId]: { leadId: event.leadId, total: nextScore, dimensions, updatedAt: event.occurredAt } },
      scoreHistory: { ...state.scoreHistory, [event.leadId]: [...(state.scoreHistory[event.leadId] ?? []), explanation] },
    },
    explanation,
  };
}

export function scoreForLead(state: EngineState, leadId: string): number {
  return state.scores[leadId] ?? 0;
}

export function scoreProjectionForLead(state: EngineState, leadId: string): ScoreProjection {
  return state.scoreProjections[leadId] ?? { leadId, total: scoreForLead(state, leadId), dimensions: {}, updatedAt: 0 };
}

// Score Decay Projections
export type DecayFunctionType = "linear" | "exponential" | "step";
export interface DecayPolicy { readonly type: DecayFunctionType; readonly halfLifeMs?: number; readonly linearRatePerDay?: number; readonly stepDrops?: ReadonlyArray<{ readonly afterMs: number; readonly dropBy: number }>; }
export function calculateDecayedScore(baseScore: number, lastUpdateAt: number, evaluateAt: number, policy: DecayPolicy): number {
    if (evaluateAt <= lastUpdateAt) return baseScore;
    if (baseScore === 0) return 0;
    const deltaMs = evaluateAt - lastUpdateAt;
    switch (policy.type) {
        case "linear": {
            const rate = policy.linearRatePerDay ?? 0;
            const days = deltaMs / (1000 * 60 * 60 * 24);
            const drop = Math.floor(days * rate);
            return baseScore > 0 ? Math.max(0, baseScore - drop) : Math.min(0, baseScore + drop);
        }
        case "exponential": {
            const hl = policy.halfLifeMs ?? (1000 * 60 * 60 * 24 * 30);
            const periods = deltaMs / hl;
            return Math.round(baseScore * Math.pow(0.5, periods));
        }
        case "step": {
            let current = baseScore;
            for (const step of (policy.stepDrops ?? [])) {
                if (deltaMs >= step.afterMs) {
                    current = current > 0 ? Math.max(0, current - step.dropBy) : Math.min(0, current + step.dropBy);
                }
            }
            return current;
        }
    }
    return baseScore;
}
export function projectScoreTimeline(baseScore: number, lastUpdateAt: number, policy: DecayPolicy, intervals: readonly number[]): ReadonlyArray<{ timestamp: number; projectedScore: number }> {
    return intervals.map(ts => ({ timestamp: ts, projectedScore: calculateDecayedScore(baseScore, lastUpdateAt, ts, policy) }));
}
