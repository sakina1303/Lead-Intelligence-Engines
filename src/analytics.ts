import type { DomainEvent, EngineState, EventCategory, LifecycleState, QualificationState, AnalyticsSummary } from "./contracts.js";

const lifecycles: readonly LifecycleState[] = ["new", "contacted", "nurturing", "qualified", "converted", "rejected"];
const qualifications: readonly QualificationState[] = ["unqualified", "marketing-qualified", "sales-qualified", "disqualified"];
const categories: readonly EventCategory[] = ["engagement", "intent", "profile", "commercial", "support", "custom"];

function zeroes<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

export function summarize(state: EngineState): AnalyticsSummary {
  const scoresByLifecycle = zeroes(lifecycles);
  const leadsByQualification = zeroes(qualifications);
  const leadsBySegment: Record<string, number> = {};
  const eventsByCategory = zeroes(categories);
  const eventsByType: Record<string, number> = {};
  let totalScore = 0;
  for (const lead of Object.values(state.leads)) {
    const score = state.scores[lead.id] ?? 0;
    totalScore += score;
    scoresByLifecycle[lead.lifecycle] += score;
    const qualification = state.qualifications[lead.id]?.state ?? "unqualified";
    leadsByQualification[qualification] += 1;
    const segment = state.segments[lead.id]?.segment ?? state.config.segmentPolicy.fallback;
    leadsBySegment[segment] = (leadsBySegment[segment] ?? 0) + 1;
  }
  for (const event of Object.values(state.events)) {
    eventsByCategory[event.category] += 1;
    eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;
  }
  const leadCount = Object.keys(state.leads).length;
  return { leadCount, eventCount: Object.keys(state.events).length, totalScore, averageScore: leadCount === 0 ? 0 : totalScore / leadCount, scoresByLifecycle, leadsByQualification, leadsBySegment, eventsByCategory, eventsByType };
}

import type { AnalyticsSummary, CohortDefinition, CohortMembership, CohortMetrics, CohortComparison, TrendDataPoint, TrendAnalysis, FunnelDefinition, FunnelResult, FunnelStageResult, FunnelAggregation, FunnelStageAggregation } from "./contracts.js";

export function getAnalyticsReport(state: EngineState): AnalyticsSummary {
  return {
    totalLeads: Object.keys(state.leads).length,
    totalEvents: Object.keys(state.events).length,
    activeLeads: 0,
    averageScore: 0,
    leadsByLifecycle: {},
    leadsByQualification: {},
    leadsBySegment: {},
    eventCountsByCategory: {},
  };
}

// --- Cohort Analysis ---

export function analyzeCohort(state: EngineState, definition: CohortDefinition): CohortMetrics {
  const members: CohortMembership[] = [];
  
  for (const lead of Object.values(state.leads)) {
    if (lead.createdAt < definition.createdAtFrom || lead.createdAt > definition.createdAtTo) continue;
    
    if (definition.requiredLifecycles && !definition.requiredLifecycles.includes(lead.lifecycle)) continue;
    
    if (definition.requiredAttributes) {
      let matches = true;
      for (const [key, value] of Object.entries(definition.requiredAttributes)) {
        if (lead.attributes[key] !== value) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
    }
    
    const score = state.scores[lead.id] ?? 0;
    if (definition.minimumScore !== undefined && score < definition.minimumScore) continue;
    if (definition.maximumScore !== undefined && score > definition.maximumScore) continue;
    
    members.push({
      cohortId: definition.id,
      leadId: lead.id,
      joinedAt: lead.createdAt,
      score,
      lifecycle: lead.lifecycle,
    });
  }
  
  const memberCount = members.length;
  if (memberCount === 0) {
    return {
      cohortId: definition.id, memberCount: 0, averageScore: 0, medianScore: 0, scoreStdDev: 0,
      minScore: 0, maxScore: 0, conversionRate: 0, averageEventsPerLead: 0,
      lifecycleDistribution: { new: 0, contacted: 0, nurturing: 0, qualified: 0, converted: 0, rejected: 0 },
      qualificationDistribution: { "unqualified": 0, "marketing-qualified": 0, "sales-qualified": 0, "disqualified": 0 },
    };
  }
  
  let totalScore = 0;
  let minScore = Infinity;
  let maxScore = -Infinity;
  let convertedCount = 0;
  let totalEvents = 0;
  
  const lifecycleCounts = { new: 0, contacted: 0, nurturing: 0, qualified: 0, converted: 0, rejected: 0 };
  const qualCounts = { "unqualified": 0, "marketing-qualified": 0, "sales-qualified": 0, "disqualified": 0 };
  
  const scores: number[] = [];
  
  for (const member of members) {
    totalScore += member.score;
    minScore = Math.min(minScore, member.score);
    maxScore = Math.max(maxScore, member.score);
    scores.push(member.score);
    
    if (member.lifecycle === "converted") convertedCount++;
    lifecycleCounts[member.lifecycle]++;
    
    const qual = state.qualifications[member.leadId];
    const qualState = qual ? qual.state : "unqualified";
    qualCounts[qualState]++;
    
    totalEvents += (state.eventIdsByLead[member.leadId] ?? []).length;
  }
  
  scores.sort((a, b) => a - b);
  const medianScore = memberCount % 2 === 1 ? scores[Math.floor(memberCount / 2)]! : (scores[memberCount / 2 - 1]! + scores[memberCount / 2]!) / 2;
  const averageScore = totalScore / memberCount;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - averageScore, 2), 0) / memberCount;
  
  return {
    cohortId: definition.id,
    memberCount,
    averageScore,
    medianScore,
    scoreStdDev: Math.sqrt(variance),
    minScore,
    maxScore,
    conversionRate: convertedCount / memberCount,
    averageEventsPerLead: totalEvents / memberCount,
    lifecycleDistribution: lifecycleCounts,
    qualificationDistribution: qualCounts,
  };
}

export function compareCohorts(state: EngineState, defA: CohortDefinition, defB: CohortDefinition): CohortComparison {
  const cohortA = analyzeCohort(state, defA);
  const cohortB = analyzeCohort(state, defB);
  
  return {
    cohortA,
    cohortB,
    scoreDelta: cohortB.averageScore - cohortA.averageScore,
    conversionRateDelta: cohortB.conversionRate - cohortA.conversionRate,
    eventRateDelta: cohortB.averageEventsPerLead - cohortA.averageEventsPerLead,
  };
}

// --- Trend Analysis ---

export function analyzeTrend(dataPoints: readonly TrendDataPoint[], movingAveragePeriod: number = 3): TrendAnalysis {
  if (dataPoints.length === 0) {
    return { dataPoints, slope: 0, intercept: 0, rSquared: 0, movingAverages: [], direction: "stable", inflectionPoints: [] };
  }
  
  const sorted = [...dataPoints].sort((a, b) => a.timestamp - b.timestamp);
  const n = sorted.length;
  
  // Linear regression
  const xs = sorted.map(p => p.timestamp);
  const ys = sorted.map(p => p.value);
  
  // Normalize X to prevent precision issues
  const minX = xs[0]!;
  const normXs = xs.map(x => (x - minX) / 86400000); // Days since start
  
  const sumX = normXs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = normXs.reduce((s, x, i) => s + x * ys[i]!, 0);
  const sumX2 = normXs.reduce((s, x) => s + x * x, 0);
  
  let slope = 0;
  let intercept = sumY / n;
  let rSquared = 0;
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator !== 0) {
    slope = (n * sumXY - sumX * sumY) / denominator;
    intercept = (sumY - slope * sumX) / n;
    
    const yMean = sumY / n;
    const ssTotal = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
    const ssResidual = ys.reduce((s, y, i) => {
      const predicted = slope * normXs[i]! + intercept;
      return s + Math.pow(y - predicted, 2);
    }, 0);
    rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
  }
  
  // Moving averages
  const movingAverages: TrendDataPoint[] = [];
  for (let i = 0; i < n; i++) {
    if (i < movingAveragePeriod - 1) continue;
    let sum = 0;
    for (let j = 0; j < movingAveragePeriod; j++) {
      sum += ys[i - j]!;
    }
    const label = sorted[i]!.label;
    movingAverages.push({ timestamp: xs[i]!, value: sum / movingAveragePeriod, ...(label !== undefined ? { label } : {}) });
  }
  
  // Inflection points (where slope of moving average changes significantly)
  const inflectionPoints: TrendDataPoint[] = [];
  if (movingAverages.length >= 3) {
    for (let i = 1; i < movingAverages.length - 1; i++) {
      const prevSlope = movingAverages[i]!.value - movingAverages[i - 1]!.value;
      const nextSlope = movingAverages[i + 1]!.value - movingAverages[i]!.value;
      if (Math.sign(prevSlope) !== Math.sign(nextSlope) && Math.abs(prevSlope - nextSlope) > Math.abs(mean(ys)) * 0.1) {
        inflectionPoints.push(movingAverages[i]!);
      }
    }
  }
  
  const direction = slope > 0.05 ? "increasing" : slope < -0.05 ? "decreasing" : "stable";
  
  return { dataPoints: sorted, slope, intercept, rSquared, movingAverages, direction, inflectionPoints };
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

// --- Conversion Funnels ---

export function evaluateFunnel(state: EngineState, leadId: string, definition: FunnelDefinition): FunnelResult {
  const events = (state.eventIdsByLead[leadId] ?? []).map(id => state.events[id]!).sort((a, b) => a.occurredAt - b.occurredAt);
  const lead = state.leads[leadId]!;
  
  const stages: FunnelStageResult[] = [];
  let currentEventIdx = 0;
  let stageEntryTime = lead.createdAt;
  let totalDwellMs = 0;
  let dropOffStageId: string | undefined = undefined;
  
  for (let i = 0; i < definition.stages.length; i++) {
    const stage = definition.stages[i]!;
    const matchedEventIds: string[] = [];
    let stageCompletedTime: number | undefined = undefined;
    
    // Scan events for stage completion criteria
    for (let j = currentEventIdx; j < events.length; j++) {
      const event = events[j]!;
      
      // Check conversion window
      if (event.occurredAt - lead.createdAt > definition.conversionWindow) break;
      
      // Check dwell time limit
      if (stage.maximumDwellMs !== undefined && event.occurredAt - stageEntryTime > stage.maximumDwellMs) break;
      
      const typeMatch = stage.requiredEventTypes.includes(event.type);
      const catMatch = !stage.requiredCategories || stage.requiredCategories.includes(event.category);
      
      if (typeMatch && catMatch) {
        matchedEventIds.push(event.id);
        stageCompletedTime = event.occurredAt;
        currentEventIdx = j + 1; // Start next stage from next event
        break;
      }
    }
    
    const dwellMs = stageCompletedTime ? stageCompletedTime - stageEntryTime : (events.length > 0 ? events[events.length - 1]!.occurredAt - stageEntryTime : 0);
    totalDwellMs += dwellMs;
    
    stages.push({
      stageId: stage.id,
      stageName: stage.name,
      enteredAt: stageEntryTime,
      ...(stageCompletedTime !== undefined ? { exitedAt: stageCompletedTime } : {}),
      dwellMs,
      matchedEventIds,
      completed: stageCompletedTime !== undefined,
    });
    
    if (stageCompletedTime !== undefined) {
      stageEntryTime = stageCompletedTime;
    } else {
      dropOffStageId = stage.id;
      break; // Stop evaluating further stages
    }
  }
  
  const completedStages = stages.filter(s => s.completed).length;
  const convertedAt = completedStages === definition.stages.length ? stages[stages.length - 1]!.exitedAt : undefined;
  
  return {
    funnelId: definition.id,
    leadId,
    stages,
    completedStages,
    totalStages: definition.stages.length,
    ...(convertedAt !== undefined ? { convertedAt } : {}),
    totalDwellMs,
    ...(dropOffStageId !== undefined ? { dropOffStageId } : {}),
  };
}

export function aggregateFunnel(state: EngineState, definition: FunnelDefinition, leadIds: readonly string[] = Object.keys(state.leads)): FunnelAggregation {
  const results = leadIds.map(id => evaluateFunnel(state, id, definition));
  const totalLeads = results.length;
  
  if (totalLeads === 0) {
    return { funnelId: definition.id, totalLeads: 0, stageMetrics: [], overallConversionRate: 0 };
  }
  
  const stageMetrics: FunnelStageAggregation[] = definition.stages.map((stage, idx) => {
    const entered = results.filter(r => r.stages.length > idx);
    const completed = entered.filter(r => r.stages[idx]!.completed);
    const dropOff = entered.filter(r => r.dropOffStageId === stage.id);
    
    const dwellTimes = completed.map(r => r.stages[idx]!.dwellMs).sort((a, b) => a - b);
    const avgDwell = dwellTimes.length > 0 ? dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length : 0;
    const medianDwell = dwellTimes.length > 0 ? dwellTimes[Math.floor(dwellTimes.length / 2)]! : 0;
    
    return {
      stageId: stage.id,
      enteredCount: entered.length,
      completedCount: completed.length,
      dropOffCount: dropOff.length,
      conversionRate: entered.length > 0 ? completed.length / entered.length : 0,
      averageDwellMs: avgDwell,
      medianDwellMs: medianDwell,
    };
  });
  
  const overallConverted = results.filter(r => r.completedStages === definition.stages.length).length;
  
  return {
    funnelId: definition.id,
    totalLeads,
    stageMetrics,
    overallConversionRate: overallConverted / totalLeads,
  };
}

// --- Velocity Acceleration Detection ---

export interface VelocityAnalysis {
  readonly leadId: string;
  readonly eventRateBase: number; // events per day previously
  readonly eventRateRecent: number; // events per day recently
  readonly accelerationFactor: number;
  readonly isAccelerating: boolean;
  readonly isDecelerating: boolean;
  readonly recentScoreVelocity: number; // score per day
}

export function analyzeEngagementVelocity(state: EngineState, leadId: string, now: number, recentWindowMs: number = 7 * 86400000): VelocityAnalysis {
  const events = (state.eventIdsByLead[leadId] ?? []).map(id => state.events[id]!).sort((a, b) => a.occurredAt - b.occurredAt);
  const lead = state.leads[leadId]!;
  
  const ageMs = now - lead.createdAt;
  if (ageMs <= recentWindowMs || events.length === 0) {
    return { leadId, eventRateBase: 0, eventRateRecent: 0, accelerationFactor: 1, isAccelerating: false, isDecelerating: false, recentScoreVelocity: 0 };
  }
  
  const recentStart = now - recentWindowMs;
  const recentEvents = events.filter(e => e.occurredAt >= recentStart);
  const baseEvents = events.filter(e => e.occurredAt < recentStart);
  
  const baseDurationDays = Math.max(1, (recentStart - lead.createdAt) / 86400000);
  const recentDurationDays = Math.max(1, recentWindowMs / 86400000);
  
  const eventRateBase = baseEvents.length / baseDurationDays;
  const eventRateRecent = recentEvents.length / recentDurationDays;
  
  const accelerationFactor = eventRateBase === 0 ? (eventRateRecent > 0 ? Infinity : 1) : eventRateRecent / eventRateBase;
  
  // Score velocity
  const history = state.scoreHistory[leadId] ?? [];
  const recentHistory = history.filter(h => h.occurredAt >= recentStart);
  const recentScoreDelta = recentHistory.reduce((sum, h) => sum + h.appliedDelta, 0);
  const recentScoreVelocity = recentScoreDelta / recentDurationDays;
  
  return {
    leadId,
    eventRateBase,
    eventRateRecent,
    accelerationFactor,
    isAccelerating: accelerationFactor > 1.5 && eventRateRecent >= 1, // at least 1 event/day and 50% faster
    isDecelerating: accelerationFactor < 0.5 && eventRateBase >= 1,
    recentScoreVelocity,
  };
}

export interface AnalyticsWindow {
  readonly startTime: number;
  readonly endTime: number;
}

export interface EngagementMetrics {
  readonly totalEvents: number;
  readonly distinctCategories: number;
  readonly categoryCounts: Readonly<Record<string, number>>;
  readonly eventsPerDay: number;
  readonly averageTimeBetweenEventsMs: number | null;
  readonly maxTimeBetweenEventsMs: number | null;
  readonly velocityGradient: number;
}

export interface FunnelStage {
  readonly id: string;
  readonly requiredCategories: readonly string[];
  readonly minEngagementTimeMs: number;
  readonly maxEngagementTimeMs?: number;
}

export interface FunnelAnalysis {
  readonly stageId: string;
  readonly enteredAt: number;
  readonly durationMs: number | null;
  readonly droppedOff: boolean;
}

export function extractEngagementMetrics(events: readonly DomainEvent[], window: AnalyticsWindow): EngagementMetrics {
  const inWindow = events.filter(e => e.occurredAt >= window.startTime && e.occurredAt <= window.endTime).sort((a, b) => a.occurredAt - b.occurredAt);
  
  const categoryCounts: Record<string, number> = {};
  inWindow.forEach(e => {
    categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1;
  });
  
  let totalTimeMs = 0;
  let maxTimeMs = null;
  const count = inWindow.length;
  
  for (let i = 1; i < count; i++) {
    const diff = inWindow[i]!.occurredAt - inWindow[i-1]!.occurredAt;
    totalTimeMs += diff;
    if (maxTimeMs === null || diff > maxTimeMs) {
      maxTimeMs = diff;
    }
  }
  
  const averageTimeBetweenEventsMs = count > 1 ? totalTimeMs / (count - 1) : null;
  const days = Math.max(1, (window.endTime - window.startTime) / (1000 * 60 * 60 * 24));
  
  // Calculate deterministic velocity gradient: rate of event accumulation over 4 quartiles
  let q1Count = 0, q2Count = 0, q3Count = 0, q4Count = 0;
  const quartileMs = (window.endTime - window.startTime) / 4;
  inWindow.forEach(e => {
    const offset = e.occurredAt - window.startTime;
    if (offset < quartileMs) q1Count++;
    else if (offset < quartileMs * 2) q2Count++;
    else if (offset < quartileMs * 3) q3Count++;
    else q4Count++;
  });
  
  const y = [q1Count, q2Count, q3Count, q4Count];
  const x = [1, 2, 3, 4];
  const n = 4;
  const sumX = 10;
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i]!, 0);
  const sumX2 = 30;
  
  const velocityGradient = ((n * sumXY) - (sumX * sumY)) / ((n * sumX2) - (sumX * sumX));

  return {
    totalEvents: count,
    distinctCategories: Object.keys(categoryCounts).length,
    categoryCounts,
    eventsPerDay: count / days,
    averageTimeBetweenEventsMs,
    maxTimeBetweenEventsMs: maxTimeMs,
    velocityGradient
  };
}

export function analyzeFunnelProgression(events: readonly DomainEvent[], stages: readonly FunnelStage[]): readonly FunnelAnalysis[] {
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const analysis: FunnelAnalysis[] = [];
  
  let currentEventIndex = 0;
  
  for (const stage of stages) {
    let stageEnteredAt: number | null = null;
    const matchedCategories = new Set<string>();
    let stageFirstEventTime = 0;
    
    let eventIndex = currentEventIndex;
    for (; eventIndex < sorted.length; eventIndex++) {
      const e = sorted[eventIndex]!;
      if (stage.requiredCategories.includes(e.category)) {
        if (matchedCategories.size === 0) {
          stageFirstEventTime = e.occurredAt;
        }
        matchedCategories.add(e.category);
        if (matchedCategories.size === stage.requiredCategories.length) {
          stageEnteredAt = e.occurredAt;
          break;
        }
      }
    }
    
    if (stageEnteredAt === null) {
      if (analysis.length > 0) {
        const last = analysis[analysis.length - 1]!;
        analysis[analysis.length - 1] = { ...last, droppedOff: true };
      }
      break;
    }
    
    const engagementTime = stageEnteredAt - stageFirstEventTime;
    if (engagementTime < stage.minEngagementTimeMs || (stage.maxEngagementTimeMs !== undefined && engagementTime > stage.maxEngagementTimeMs)) {
      if (analysis.length > 0) {
        const last = analysis[analysis.length - 1]!;
        analysis[analysis.length - 1] = { ...last, droppedOff: true };
      }
      break;
    }
    
    if (analysis.length > 0) {
      const last = analysis[analysis.length - 1]!;
      analysis[analysis.length - 1] = { ...last, durationMs: stageEnteredAt - last.enteredAt };
    }
    
    analysis.push({
      stageId: stage.id,
      enteredAt: stageEnteredAt,
      durationMs: null,
      droppedOff: false
    });
    
    currentEventIndex = eventIndex + 1;
  }
  
  return analysis;
}

export function extractEventFeatures(events: readonly DomainEvent[]): Readonly<Record<string, number | boolean | string>> {
  const features: Record<string, number | boolean | string> = {};
  if (events.length === 0) return features;
  
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  
  features["has_events"] = true;
  features["event_count"] = sorted.length;
  features["first_event_at"] = first.occurredAt;
  features["last_event_at"] = last.occurredAt;
  features["days_active"] = (last.occurredAt - first.occurredAt) / (1000 * 60 * 60 * 24);
  
  const categoryFreq: Record<string, number> = {};
  sorted.forEach(e => {
    categoryFreq[e.category] = (categoryFreq[e.category] ?? 0) + 1;
  });
  
  Object.entries(categoryFreq).forEach(([cat, count]) => {
    features[`cat_${cat}_count`] = count;
  });
  
  return features;
}
