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

// --- Score Normalization ---

export type NormalizationMethod = "percentile" | "z-score" | "min-max";

export interface NormalizedScore {
  readonly leadId: string;
  readonly rawScore: number;
  readonly normalizedScore: number;
  readonly method: NormalizationMethod;
}

export function normalizeScores(state: EngineState, method: NormalizationMethod): readonly NormalizedScore[] {
  const leadIds = Object.keys(state.leads).sort();
  const scores = leadIds.map(id => ({ leadId: id, rawScore: state.scores[id] ?? 0 }));
  
  if (scores.length === 0) return [];
  
  switch (method) {
    case "min-max": {
      const min = scores.reduce((m, s) => Math.min(m, s.rawScore), Infinity);
      const max = scores.reduce((m, s) => Math.max(m, s.rawScore), -Infinity);
      const range = max - min;
      return scores.map(s => ({
        ...s, method,
        normalizedScore: range === 0 ? 0.5 : (s.rawScore - min) / range,
      }));
    }
    
    case "z-score": {
      const n = scores.length;
      const mean = scores.reduce((sum, s) => sum + s.rawScore, 0) / n;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s.rawScore - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      return scores.map(s => ({
        ...s, method,
        normalizedScore: stdDev === 0 ? 0 : (s.rawScore - mean) / stdDev,
      }));
    }
    
    case "percentile": {
      const sorted = [...scores].sort((a, b) => a.rawScore - b.rawScore);
      const rankMap = new Map<string, number>();
      for (let i = 0; i < sorted.length; i++) {
        // Average rank for ties
        let j = i;
        while (j < sorted.length - 1 && sorted[j + 1]!.rawScore === sorted[i]!.rawScore) j++;
        const avgRank = (i + j) / 2;
        for (let k = i; k <= j; k++) {
          rankMap.set(sorted[k]!.leadId, avgRank);
        }
        i = j;
      }
      return scores.map(s => ({
        ...s, method,
        normalizedScore: sorted.length <= 1 ? 0.5 : rankMap.get(s.leadId)! / (sorted.length - 1),
      }));
    }
  }
}

// --- Score Volatility Analysis ---

export interface ScoreVolatility {
  readonly leadId: string;
  readonly totalChanges: number;
  readonly averageDelta: number;
  readonly maxPositiveDelta: number;
  readonly maxNegativeDelta: number;
  readonly standardDeviation: number;
  readonly coefficientOfVariation: number;
  readonly isVolatile: boolean;
}

export function analyzeScoreVolatility(state: EngineState, leadId: string, volatilityThreshold: number = 0.5): ScoreVolatility {
  const history = state.scoreHistory[leadId] ?? [];
  if (history.length === 0) {
    return { leadId, totalChanges: 0, averageDelta: 0, maxPositiveDelta: 0, maxNegativeDelta: 0, standardDeviation: 0, coefficientOfVariation: 0, isVolatile: false };
  }
  
  const deltas = history.filter(h => h.reason === "scored").map(h => h.appliedDelta);
  if (deltas.length === 0) {
    return { leadId, totalChanges: 0, averageDelta: 0, maxPositiveDelta: 0, maxNegativeDelta: 0, standardDeviation: 0, coefficientOfVariation: 0, isVolatile: false };
  }
  
  const n = deltas.length;
  const mean = deltas.reduce((sum, d) => sum + d, 0) / n;
  const variance = deltas.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const maxPos = deltas.reduce((m, d) => Math.max(m, d), 0);
  const maxNeg = deltas.reduce((m, d) => Math.min(m, d), 0);
  const cv = mean === 0 ? 0 : stdDev / Math.abs(mean);
  
  return {
    leadId,
    totalChanges: n,
    averageDelta: mean,
    maxPositiveDelta: maxPos,
    maxNegativeDelta: maxNeg,
    standardDeviation: stdDev,
    coefficientOfVariation: cv,
    isVolatile: cv > volatilityThreshold,
  };
}

// --- Score Plateau Detection ---

export interface ScorePlateau {
  readonly leadId: string;
  readonly plateauStart: number;
  readonly plateauEnd: number;
  readonly durationMs: number;
  readonly score: number;
  readonly eventsDuringPlateau: number;
}

export function detectScorePlateaus(state: EngineState, leadId: string, minDurationMs: number): readonly ScorePlateau[] {
  const history = state.scoreHistory[leadId] ?? [];
  if (history.length < 2) return [];
  
  const sorted = [...history].sort((a, b) => a.occurredAt - b.occurredAt);
  const plateaus: ScorePlateau[] = [];
  
  let plateauStartIdx = 0;
  let currentScore = sorted[0]!.nextScore;
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.nextScore !== currentScore) {
      const startTime = sorted[plateauStartIdx]!.occurredAt;
      const endTime = sorted[i]!.occurredAt;
      const duration = endTime - startTime;
      
      if (duration >= minDurationMs) {
        plateaus.push({
          leadId,
          plateauStart: startTime,
          plateauEnd: endTime,
          durationMs: duration,
          score: currentScore,
          eventsDuringPlateau: i - plateauStartIdx,
        });
      }
      
      plateauStartIdx = i;
      currentScore = sorted[i]!.nextScore;
    }
  }
  
  return plateaus;
}

// --- Score Linear Forecast ---

export interface ScoreForecast {
  readonly leadId: string;
  readonly currentScore: number;
  readonly forecastedScore: number;
  readonly slope: number;
  readonly intercept: number;
  readonly rSquared: number;
  readonly forecastAt: number;
  readonly confidence: "high" | "medium" | "low";
}

export function forecastScore(state: EngineState, leadId: string, forecastAt: number): ScoreForecast {
  const history = state.scoreHistory[leadId] ?? [];
  const currentScore = state.scores[leadId] ?? 0;
  
  if (history.length < 2) {
    return { leadId, currentScore, forecastedScore: currentScore, slope: 0, intercept: currentScore, rSquared: 0, forecastAt, confidence: "low" };
  }
  
  const scored = history.filter(h => h.reason === "scored");
  if (scored.length < 2) {
    return { leadId, currentScore, forecastedScore: currentScore, slope: 0, intercept: currentScore, rSquared: 0, forecastAt, confidence: "low" };
  }
  
  // Linear regression on (occurredAt, nextScore)
  const xs = scored.map(h => h.occurredAt);
  const ys = scored.map(h => h.nextScore);
  const n = xs.length;
  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i]!, 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { leadId, currentScore, forecastedScore: currentScore, slope: 0, intercept: currentScore, rSquared: 0, forecastAt, confidence: "low" };
  }
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // R-squared
  const yMean = sumY / n;
  const ssTotal = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
  const ssResidual = ys.reduce((s, y, i) => {
    const predicted = slope * xs[i]! + intercept;
    return s + Math.pow(y - predicted, 2);
  }, 0);
  const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
  
  const forecastedScore = Math.round(slope * forecastAt + intercept);
  const confidence = rSquared > 0.7 ? "high" : rSquared > 0.3 ? "medium" : "low";
  
  return { leadId, currentScore, forecastedScore, slope, intercept, rSquared, forecastAt, confidence };
}

// --- Weighted Dimensional Aggregation ---

export interface DimensionWeightConfig {
  readonly dimensionId: string;
  readonly weight: number;
}

export function computeWeightedDimensionalScore(projection: ScoreProjection, weights: readonly DimensionWeightConfig[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const config of weights) {
    const value = projection.dimensions[config.dimensionId] ?? 0;
    weightedSum += value * config.weight;
    totalWeight += config.weight;
  }
  
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}

// --- Score Comparison ---

export interface ScoreComparison {
  readonly leadId: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly absoluteDelta: number;
  readonly percentDelta: number;
  readonly direction: "increased" | "decreased" | "unchanged";
  readonly ruleContributions: readonly { readonly ruleId: string; readonly totalDelta: number }[];
}

export function compareScoresBetweenTimestamps(state: EngineState, leadId: string, fromTs: number, toTs: number): ScoreComparison {
  const history = state.scoreHistory[leadId] ?? [];
  const inRange = history.filter(h => h.occurredAt >= fromTs && h.occurredAt <= toTs);
  
  // Find score at fromTs (last known score before or at fromTs)
  const beforeHistory = history.filter(h => h.occurredAt <= fromTs);
  const scoreBefore = beforeHistory.length > 0 ? beforeHistory[beforeHistory.length - 1]!.nextScore : 0;
  
  // Find score at toTs
  const afterHistory = history.filter(h => h.occurredAt <= toTs);
  const scoreAfter = afterHistory.length > 0 ? afterHistory[afterHistory.length - 1]!.nextScore : scoreBefore;
  
  const absoluteDelta = scoreAfter - scoreBefore;
  const percentDelta = scoreBefore === 0 ? (scoreAfter === 0 ? 0 : 100) : (absoluteDelta / Math.abs(scoreBefore)) * 100;
  
  // Aggregate rule contributions
  const ruleDeltas = new Map<string, number>();
  for (const entry of inRange) {
    for (const ruleId of entry.ruleIds) {
      ruleDeltas.set(ruleId, (ruleDeltas.get(ruleId) ?? 0) + entry.appliedDelta / Math.max(1, entry.ruleIds.length));
    }
  }
  
  const ruleContributions = [...ruleDeltas.entries()]
    .map(([ruleId, totalDelta]) => ({ ruleId, totalDelta }))
    .sort((a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta) || a.ruleId.localeCompare(b.ruleId));
  
  return {
    leadId,
    scoreBefore,
    scoreAfter,
    absoluteDelta,
    percentDelta,
    direction: absoluteDelta > 0 ? "increased" : absoluteDelta < 0 ? "decreased" : "unchanged",
    ruleContributions,
  };
}

// --- Score Distribution ---

export function computeScoreDistribution(state: EngineState): import("./contracts.js").ScoreDistribution {
  const scores = Object.values(state.leads).map(l => state.scores[l.id] ?? 0);
  
  if (scores.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, standardDeviation: 0, percentiles: {} };
  }
  
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  const mean = sum / n;
  const variance = sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
  
  const percentileAt = (p: number) => {
    const idx = Math.ceil(p / 100 * n) - 1;
    return sorted[Math.max(0, Math.min(idx, n - 1))]!;
  };
  
  return {
    min: sorted[0]!,
    max: sorted[n - 1]!,
    mean,
    median: n % 2 === 1 ? sorted[Math.floor(n / 2)]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2,
    standardDeviation: Math.sqrt(variance),
    percentiles: {
      p10: percentileAt(10),
      p25: percentileAt(25),
      p50: percentileAt(50),
      p75: percentileAt(75),
      p90: percentileAt(90),
      p95: percentileAt(95),
      p99: percentileAt(99),
    },
  };
}
