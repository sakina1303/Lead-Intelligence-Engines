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
