import type { AnalyticsSummary, EngineState, EventCategory, LifecycleState, QualificationState } from "./contracts.js";

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
