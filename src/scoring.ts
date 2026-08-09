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

// --- Multi-Touch Attribution (MTA) ---

export interface AttributedEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly contributionScore: number;
  readonly percentage: number;
}

export type AttributionModel = "first-touch" | "last-touch" | "linear" | "time-decay" | "u-shaped" | "markov" | "shapley";

export function calculateEventAttribution(
  events: readonly DomainEvent[], 
  totalScore: number, 
  model: AttributionModel
): readonly AttributedEvent[] {
  if (events.length === 0 || totalScore === 0) return [];
  
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const n = sorted.length;
  
  const results: AttributedEvent[] = [];
  
  switch (model) {
    case "first-touch": {
      results.push({ eventId: sorted[0]!.id, eventType: sorted[0]!.type, contributionScore: totalScore, percentage: 1.0 });
      break;
    }
    case "last-touch": {
      results.push({ eventId: sorted[n - 1]!.id, eventType: sorted[n - 1]!.type, contributionScore: totalScore, percentage: 1.0 });
      break;
    }
    case "linear": {
      const share = totalScore / n;
      const pct = 1.0 / n;
      for (const e of sorted) {
        results.push({ eventId: e.id, eventType: e.type, contributionScore: share, percentage: pct });
      }
      break;
    }
    case "time-decay": {
      // Exponential decay based on time difference from last event
      const lastTime = sorted[n - 1]!.occurredAt;
      const halfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      const weights = sorted.map(e => {
        const diffMs = lastTime - e.occurredAt;
        return Math.pow(0.5, diffMs / halfLifeMs);
      });
      
      const totalWeight = weights.reduce((s, w) => s + w, 0);
      
      for (let i = 0; i < n; i++) {
        const pct = weights[i]! / totalWeight;
        results.push({ eventId: sorted[i]!.id, eventType: sorted[i]!.type, contributionScore: totalScore * pct, percentage: pct });
      }
      break;
    }
    case "u-shaped": {
      // 40% first, 40% last, 20% middle
      if (n === 1) {
        results.push({ eventId: sorted[0]!.id, eventType: sorted[0]!.type, contributionScore: totalScore, percentage: 1.0 });
      } else if (n === 2) {
        results.push({ eventId: sorted[0]!.id, eventType: sorted[0]!.type, contributionScore: totalScore * 0.5, percentage: 0.5 });
        results.push({ eventId: sorted[1]!.id, eventType: sorted[1]!.type, contributionScore: totalScore * 0.5, percentage: 0.5 });
      } else {
        const middleShare = 0.2 / (n - 2);
        for (let i = 0; i < n; i++) {
          let pct = 0;
          if (i === 0) pct = 0.4;
          else if (i === n - 1) pct = 0.4;
          else pct = middleShare;
          
          results.push({ eventId: sorted[i]!.id, eventType: sorted[i]!.type, contributionScore: totalScore * pct, percentage: pct });
        }
      }
      break;
    }
    case "markov": {
      // Simplified deterministic Markov Chain approximation
      // We calculate removal effect for each event type in the path
      const removalEffects = new Map<string, number>();
      
      // Calculate default probability (simplified base rate)
      const baseProb = 1.0; 
      
      // Calculate removal effect for each unique event type in path
      const uniqueTypes = new Set(sorted.map(e => e.type));
      for (const t of uniqueTypes) {
        // If we remove this type, what's the path probability?
        // Simplified: removing a type decreases probability proportional to its frequency in the path
        const count = sorted.filter(e => e.type === t).length;
        const probWithout = Math.pow(0.5, count); 
        const removalEffect = baseProb - probWithout;
        removalEffects.set(t, removalEffect);
      }
      
      const totalEffect = [...removalEffects.values()].reduce((s, e) => s + e, 0);
      
      for (const e of sorted) {
        // Distribute the type's removal effect equally among its occurrences
        const count = sorted.filter(x => x.type === e.type).length;
        const typeEffect = removalEffects.get(e.type) ?? 0;
        const pct = totalEffect === 0 ? (1 / n) : (typeEffect / count) / totalEffect;
        
        results.push({ eventId: e.id, eventType: e.type, contributionScore: totalScore * pct, percentage: pct });
      }
      break;
    }
    case "shapley": {
      // Simplified Shapley Value approximation
      // Evaluating all 2^N subsets is too slow for large N, we use a deterministic heuristic
      
      // Assign intrinsic value to each event type based on a pseudo-random hash to make it deterministic but varied
      const intrinsicValues = new Map<string, number>();
      for (const e of sorted) {
        if (!intrinsicValues.has(e.type)) {
          let hash = 0;
          for (let i = 0; i < e.type.length; i++) {
            hash = ((hash << 5) - hash) + e.type.charCodeAt(i);
          }
          intrinsicValues.set(e.type, Math.abs(hash % 100) / 100.0);
        }
      }
      
      // Calculate marginal contributions (simplified)
      const weights = sorted.map((e, idx) => {
        const val = intrinsicValues.get(e.type) ?? 0.5;
        // Position factor: events closer to the end get a slight boost in Shapley approximations for conversion
        const posFactor = 1.0 + (idx / n) * 0.5; 
        return val * posFactor;
      });
      
      const totalWeight = weights.reduce((s, w) => s + w, 0);
      
      for (let i = 0; i < n; i++) {
        const pct = totalWeight === 0 ? (1 / n) : weights[i]! / totalWeight;
        results.push({ eventId: sorted[i]!.id, eventType: sorted[i]!.type, contributionScore: totalScore * pct, percentage: pct });
      }
      break;
    }
  }
  
  return results;
}

// --- Dynamic Score Thresholds (Self-Calibrating) ---

export interface DynamicThresholds {
  readonly marketingQualifiedThreshold: number;
  readonly salesQualifiedThreshold: number;
  readonly lastCalibratedAt: number;
  readonly calibrationMethod: "percentile" | "kmeans" | "stddev";
}

export function calibrateThresholds(
  state: EngineState, 
  method: "percentile" | "kmeans" | "stddev",
  evaluatedAt: number,
  targetMQLPercentile: number = 75,
  targetSQLPercentile: number = 90
): DynamicThresholds {
  const scores = Object.values(state.leads).map(l => state.scores[l.id] ?? 0).filter(s => s > 0);
  
  if (scores.length < 10) {
    // Fallback to static defaults if not enough data
    return { marketingQualifiedThreshold: 50, salesQualifiedThreshold: 80, lastCalibratedAt: evaluatedAt, calibrationMethod: method };
  }
  
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  
  let mql = 50;
  let sql = 80;
  
  switch (method) {
    case "percentile": {
      mql = sorted[Math.min(n - 1, Math.floor(n * (targetMQLPercentile / 100)))]!;
      sql = sorted[Math.min(n - 1, Math.floor(n * (targetSQLPercentile / 100)))]!;
      break;
    }
    case "stddev": {
      const sum = sorted.reduce((s, v) => s + v, 0);
      const mean = sum / n;
      const variance = sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      
      mql = Math.round(mean + stdDev * 0.5); // Half a standard deviation above mean
      sql = Math.round(mean + stdDev * 1.5); // 1.5 standard deviations above mean
      break;
    }
    case "kmeans": {
      // 1D K-means for 3 clusters: Low, Medium (MQL), High (SQL)
      let c1 = sorted[Math.floor(n * 0.2)]!;
      let c2 = sorted[Math.floor(n * 0.6)]!;
      let c3 = sorted[Math.floor(n * 0.9)]!;
      
      for (let iter = 0; iter < 10; iter++) {
        const cl1: number[] = [];
        const cl2: number[] = [];
        const cl3: number[] = [];
        
        for (const s of sorted) {
          const d1 = Math.abs(s - c1);
          const d2 = Math.abs(s - c2);
          const d3 = Math.abs(s - c3);
          
          if (d1 <= d2 && d1 <= d3) cl1.push(s);
          else if (d2 <= d1 && d2 <= d3) cl2.push(s);
          else cl3.push(s);
        }
        
        const newC1 = cl1.length > 0 ? cl1.reduce((a, b) => a + b, 0) / cl1.length : c1;
        const newC2 = cl2.length > 0 ? cl2.reduce((a, b) => a + b, 0) / cl2.length : c2;
        const newC3 = cl3.length > 0 ? cl3.reduce((a, b) => a + b, 0) / cl3.length : c3;
        
        if (Math.abs(c1 - newC1) < 1 && Math.abs(c2 - newC2) < 1 && Math.abs(c3 - newC3) < 1) break;
        
        c1 = newC1;
        c2 = newC2;
        c3 = newC3;
      }
      
      // MQL is the threshold between low and medium
      mql = Math.round((c1 + c2) / 2);
      // SQL is the threshold between medium and high
      sql = Math.round((c2 + c3) / 2);
      break;
    }
  }
  
  return {
    marketingQualifiedThreshold: Math.max(1, mql),
    salesQualifiedThreshold: Math.max(mql + 1, sql),
    lastCalibratedAt: evaluatedAt,
    calibrationMethod: method
  };
}

// --- Ensemble Scoring Models ---

export interface EnsembleScoringConfig {
  readonly ruleEngineWeight: number;
  readonly mlModelWeight: number;
  readonly similarityModelWeight: number;
  readonly minConfidenceRequired: number;
}

export interface EnsembleScoreResult {
  readonly leadId: string;
  readonly finalScore: number;
  readonly components: {
    readonly ruleEngineScore: number;
    readonly mlModelScore: number;
    readonly similarityModelScore: number;
  };
  readonly confidence: number;
}

export function calculateEnsembleScore(
  state: EngineState,
  leadId: string,
  mlScores: Readonly<Record<string, number>>,
  similarityScores: Readonly<Record<string, number>>,
  config: EnsembleScoringConfig
): EnsembleScoreResult {
  
  const ruleScore = state.scores[leadId] ?? 0;
  const mlScore = mlScores[leadId] ?? ruleScore; // Fallback to rule score if ML missing
  const simScore = similarityScores[leadId] ?? ruleScore;
  
  const totalWeight = config.ruleEngineWeight + config.mlModelWeight + config.similarityModelWeight;
  
  const weightedScore = (
    ruleScore * config.ruleEngineWeight + 
    mlScore * config.mlModelWeight + 
    simScore * config.similarityModelWeight
  ) / totalWeight;
  
  // Calculate confidence based on agreement between models
  const maxScore = Math.max(ruleScore, mlScore, simScore);
  const minScore = Math.min(ruleScore, mlScore, simScore);
  const range = maxScore - minScore;
  const maxPossibleRange = Math.max(100, maxScore); // Assume scale is roughly 0-100 or relative to max
  
  // High agreement (small range) = high confidence
  const agreementConfidence = 1.0 - Math.min(1.0, range / maxPossibleRange);
  
  // Data volume confidence (more events = higher confidence)
  const eventCount = (state.eventIdsByLead[leadId] ?? []).length;
  const dataConfidence = Math.min(1.0, eventCount / 10); // Cap at 10 events
  
  const overallConfidence = (agreementConfidence + dataConfidence) / 2;
  
  return {
    leadId,
    finalScore: overallConfidence >= config.minConfidenceRequired ? Math.round(weightedScore) : ruleScore,
    components: {
      ruleEngineScore: ruleScore,
      mlModelScore: mlScore,
      similarityModelScore: simScore
    },
    confidence: overallConfidence
  };
}

// --- Deep Scoring Explanations ---

export interface ScoreDriver {
  readonly factor: string;
  readonly impact: number;
  readonly percentage: number;
  readonly description: string;
}

export interface DeepScoreExplanation {
  readonly leadId: string;
  readonly totalScore: number;
  readonly primaryDrivers: readonly ScoreDriver[];
  readonly detractors: readonly ScoreDriver[];
  readonly trajectory: "rising_rapidly" | "rising" | "stable" | "falling" | "falling_rapidly";
  readonly nextBestAction: string;
}

export function generateDeepScoreExplanation(
  state: EngineState,
  leadId: string,
  rules: readonly ScoringRule[]
): DeepScoreExplanation {
  const score = state.scores[leadId] ?? 0;
  const history = state.scoreHistory[leadId] ?? [];
  
  // 1. Analyze Trajectory
  let trajectory: DeepScoreExplanation["trajectory"] = "stable";
  if (history.length >= 2) {
    const recent = history.slice(-5); // Look at last 5 events
    const firstScore = recent[0]!.previousScore;
    const lastScore = recent[recent.length - 1]!.nextScore;
    const delta = lastScore - firstScore;
    
    if (delta > 20) trajectory = "rising_rapidly";
    else if (delta > 5) trajectory = "rising";
    else if (delta < -20) trajectory = "falling_rapidly";
    else if (delta < -5) trajectory = "falling";
  }
  
  // 2. Identify Drivers and Detractors
  const ruleImpacts = new Map<string, number>();
  
  for (const h of history) {
    if (h.reason === "scored") {
      const avgImpact = h.appliedDelta / Math.max(1, h.ruleIds.length);
      for (const ruleId of h.ruleIds) {
        ruleImpacts.set(ruleId, (ruleImpacts.get(ruleId) ?? 0) + avgImpact);
      }
    }
  }
  
  const drivers: ScoreDriver[] = [];
  const detractors: ScoreDriver[] = [];
  
  let totalPositive = 0;
  let totalNegative = 0;
  
  for (const [ruleId, impact] of ruleImpacts.entries()) {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) continue;
    
    if (impact > 0) {
      totalPositive += impact;
      drivers.push({
        factor: rule.name,
        impact,
        percentage: 0, // Calculated later
        description: `Positive impact from: ${rule.name}`
      });
    } else if (impact < 0) {
      totalNegative += Math.abs(impact);
      detractors.push({
        factor: rule.name,
        impact,
        percentage: 0, // Calculated later
        description: `Negative impact from: ${rule.name}`
      });
    }
  }
  
  // Calculate percentages and sort
  for (let i = 0; i < drivers.length; i++) {
    const d = drivers[i]!;
    drivers[i] = { ...d, percentage: totalPositive > 0 ? (d.impact / totalPositive) * 100 : 0 };
  }
  drivers.sort((a, b) => b.impact - a.impact);
  
  for (let i = 0; i < detractors.length; i++) {
    const d = detractors[i]!;
    detractors[i] = { ...d, percentage: totalNegative > 0 ? (Math.abs(d.impact) / totalNegative) * 100 : 0 };
  }
  detractors.sort((a, b) => a.impact - b.impact); // sort by lowest (most negative) first
  
  // 3. Determine Next Best Action
  let nba = "Continue Nurturing";
  
  const lead = state.leads[leadId];
  if (lead) {
    if (lead.lifecycle === "qualified") nba = "Assign to Sales Representative immediately";
    else if (score > 80 && lead.lifecycle !== "converted") nba = "Trigger High-Intent Outreach Playbook";
    else if (trajectory === "falling_rapidly") nba = "Enroll in Re-engagement Campaign";
    else if (history.length > 0) {
      const lastEvent = state.events[history[history.length - 1]!.eventId];
      if (lastEvent && lastEvent.category === "support") {
        nba = "Resolve support ticket before selling";
      }
    }
  }
  
  return {
    leadId,
    totalScore: score,
    primaryDrivers: drivers.slice(0, 3), // Top 3 drivers
    detractors: detractors.slice(0, 3), // Top 3 detractors
    trajectory,
    nextBestAction: nba
  };
}
