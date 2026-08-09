import type { DomainEvent, EngineState, ScoreExplanation, ScoreProjection, ScoringRule } from "./contracts.js";
import { matchingRules, selectRules } from "./rule-evaluation.js";

// --- Advanced Multi-Dimensional Scoring ---
export type ScoreDimension = "fit" | "intent" | "engagement" | "budget" | "authority" | "timing";

export interface DimensionalScore {
  readonly fit: number;
  readonly intent: number;
  readonly engagement: number;
  readonly budget: number;
  readonly authority: number;
  readonly timing: number;
  readonly aggregate: number;
  readonly lastUpdated: number;
}

export interface ScoreTransition {
  readonly previous: DimensionalScore;
  readonly next: DimensionalScore;
  readonly appliedRules: readonly string[];
  readonly transitionTimestamp: number;
}

export function createEmptyScore(timestamp: number): DimensionalScore {
  return { fit: 0, intent: 0, engagement: 0, budget: 0, authority: 0, timing: 0, aggregate: 0, lastUpdated: timestamp };
}

export function applyScoreDelta(base: DimensionalScore, delta: Partial<Record<ScoreDimension, number>>, aggregateDelta: number, timestamp: number, bounds?: { min: number; max: number }): DimensionalScore {
  const min = bounds?.min ?? -1000;
  const max = bounds?.max ?? 1000;
  const clamp = (val: number) => Math.max(min, Math.min(max, val));
  
  return {
    fit: clamp(base.fit + (delta.fit ?? 0)),
    intent: clamp(base.intent + (delta.intent ?? 0)),
    engagement: clamp(base.engagement + (delta.engagement ?? 0)),
    budget: clamp(base.budget + (delta.budget ?? 0)),
    authority: clamp(base.authority + (delta.authority ?? 0)),
    timing: clamp(base.timing + (delta.timing ?? 0)),
    aggregate: clamp(base.aggregate + aggregateDelta),
    lastUpdated: timestamp
  };
}

// --- Time Decay Models ---
export type DecayFunctionType = "linear" | "exponential" | "step" | "halflife" | "logarithmic" | "none";

export interface DecayPolicy {
  readonly type: DecayFunctionType;
  readonly dimension: ScoreDimension | "aggregate";
  readonly parameters: {
    readonly ratePerDay?: number;
    readonly halfLifeMs?: number;
    readonly stepDrops?: ReadonlyArray<{ readonly afterMs: number; readonly dropBy: number }>;
    readonly floor?: number;
    readonly ceiling?: number;
    readonly logBase?: number;
  };
}

export function calculateDecayForDimension(baseValue: number, lastUpdateAt: number, evaluateAt: number, policy: DecayPolicy): number {
  if (evaluateAt <= lastUpdateAt) return baseValue;
  if (baseValue === 0 && (policy.parameters.floor === undefined || policy.parameters.floor <= 0)) return 0;
  
  const deltaMs = evaluateAt - lastUpdateAt;
  const floor = policy.parameters.floor ?? 0;
  const days = deltaMs / (1000 * 60 * 60 * 24);
  let decayed = baseValue;

  switch (policy.type) {
    case "linear": {
      const rate = policy.parameters.ratePerDay ?? 0;
      const drop = Math.floor(days * rate);
      decayed = baseValue > 0 ? baseValue - drop : baseValue + drop;
      break;
    }
    case "exponential": {
      const hl = policy.parameters.halfLifeMs ?? (1000 * 60 * 60 * 24 * 30);
      const periods = deltaMs / hl;
      decayed = Math.round(baseValue * Math.pow(0.5, periods));
      break;
    }
    case "step": {
      let current = baseValue;
      for (const step of (policy.parameters.stepDrops ?? [])) {
        if (deltaMs >= step.afterMs) {
          current = current > 0 ? current - step.dropBy : current + step.dropBy;
        }
      }
      decayed = current;
      break;
    }
    case "logarithmic": {
      const logBase = policy.parameters.logBase ?? 10;
      const severity = Math.max(0, Math.log(days + 1) / Math.log(logBase));
      const drop = Math.floor(baseValue * (severity / 100));
      decayed = baseValue > 0 ? baseValue - drop : baseValue + drop;
      break;
    }
    case "halflife": {
      const hl = policy.parameters.halfLifeMs ?? (1000 * 60 * 60 * 24 * 7);
      const halflifes = Math.floor(deltaMs / hl);
      decayed = Math.floor(baseValue / Math.pow(2, halflifes));
      break;
    }
    case "none":
      return baseValue;
  }

  if (baseValue > 0) return Math.max(floor, decayed);
  if (baseValue < 0) return Math.min(-floor, decayed);
  return decayed;
}

export function projectDecayedScore(score: DimensionalScore, evaluateAt: number, policies: readonly DecayPolicy[]): DimensionalScore {
  let fit = score.fit;
  let intent = score.intent;
  let engagement = score.engagement;
  let budget = score.budget;
  let authority = score.authority;
  let timing = score.timing;
  let aggregate = score.aggregate;

  for (const policy of policies) {
    switch (policy.dimension) {
      case "fit": fit = calculateDecayForDimension(fit, score.lastUpdated, evaluateAt, policy); break;
      case "intent": intent = calculateDecayForDimension(intent, score.lastUpdated, evaluateAt, policy); break;
      case "engagement": engagement = calculateDecayForDimension(engagement, score.lastUpdated, evaluateAt, policy); break;
      case "budget": budget = calculateDecayForDimension(budget, score.lastUpdated, evaluateAt, policy); break;
      case "authority": authority = calculateDecayForDimension(authority, score.lastUpdated, evaluateAt, policy); break;
      case "timing": timing = calculateDecayForDimension(timing, score.lastUpdated, evaluateAt, policy); break;
      case "aggregate": aggregate = calculateDecayForDimension(aggregate, score.lastUpdated, evaluateAt, policy); break;
    }
  }

  return { fit, intent, engagement, budget, authority, timing, aggregate, lastUpdated: evaluateAt };
}

// --- Historical Projector ---
export function projectScoreTimeline(baseScore: DimensionalScore, policies: readonly DecayPolicy[], intervals: readonly number[]): ReadonlyArray<{ timestamp: number; projectedScore: DimensionalScore }> {
  return intervals.map(ts => ({
    timestamp: ts,
    projectedScore: projectDecayedScore(baseScore, ts, policies)
  }));
}

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
  
  for (const rule of selected) {
    for (const [dimensionId, delta] of Object.entries(rule.dimensionDeltas ?? {})) {
      const definition = state.config.scorePolicy.dimensions?.find((item) => item.id === dimensionId);
      const prior = dimensions[dimensionId] ?? 0;
      dimensions[dimensionId] = definition === undefined ? prior + delta : clampScore(prior + delta, definition.floor, definition.cap);
    }
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
