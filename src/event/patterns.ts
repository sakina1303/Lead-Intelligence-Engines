import type { DomainEvent } from "../contracts.js";

export interface EventPattern { readonly id: string; readonly name: string; readonly steps: readonly EventPatternStep[]; readonly maxWindowMs: number; }
export interface EventPatternStep { readonly eventType: string; readonly category?: string; readonly requiredAttributes?: Readonly<Record<string, string | number | boolean>>; readonly optional?: boolean; }
export interface PatternMatch { readonly patternId: string; readonly leadId: string; readonly matchedEventIds: readonly string[]; readonly startedAt: number; readonly completedAt: number; readonly windowMs: number; readonly skippedOptionalSteps: readonly string[]; }
export interface FrequencyBucket { readonly label: string; readonly count: number; readonly proportion: number; }

export function matchEventPattern(events: readonly DomainEvent[], leadId: string, pattern: EventPattern): PatternMatch | null {
  const leadEvents = events.filter((event) => event.leadId === leadId).sort((left, right) => left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id));
  for (let start = 0; start < leadEvents.length; start += 1) {
    const startEvent = leadEvents[start]!;
    const matched: DomainEvent[] = [];
    const skipped: string[] = [];
    let stepIndex = 0;
    let eventIndex = start;
    while (stepIndex < pattern.steps.length && eventIndex < leadEvents.length) {
      const step = pattern.steps[stepIndex]!;
      const event = leadEvents[eventIndex]!;
      if (event.occurredAt - startEvent.occurredAt > pattern.maxWindowMs) {
        if (step.optional) { skipped.push(step.eventType); stepIndex += 1; continue; }
        break;
      }
      const matches = event.type === step.eventType && (step.category === undefined || event.category === step.category) && (step.requiredAttributes === undefined || Object.entries(step.requiredAttributes).every(([key, value]) => event.attributes[key] === value));
      if (matches) { matched.push(event); stepIndex += 1; eventIndex += 1; }
      else if (step.optional) { skipped.push(step.eventType); stepIndex += 1; }
      else eventIndex += 1;
    }
    while (stepIndex < pattern.steps.length && pattern.steps[stepIndex]!.optional) { skipped.push(pattern.steps[stepIndex]!.eventType); stepIndex += 1; }
    if (stepIndex === pattern.steps.length && matched.length > 0) {
      const completed = matched.at(-1)!;
      return { patternId: pattern.id, leadId, matchedEventIds: matched.map((event) => event.id), startedAt: startEvent.occurredAt, completedAt: completed.occurredAt, windowMs: completed.occurredAt - startEvent.occurredAt, skippedOptionalSteps: skipped };
    }
  }
  return null;
}

export function computeEventFrequencyDistribution(events: readonly DomainEvent[], bucketField: "type" | "category"): readonly FrequencyBucket[] {
  const counts = new Map<string, number>();
  for (const event of events) { const key = bucketField === "type" ? event.type : event.category; counts.set(key, (counts.get(key) ?? 0) + 1); }
  return [...counts.entries()].map(([label, count]) => ({ label, count, proportion: events.length === 0 ? 0 : count / events.length })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function computeTemporalDistribution(events: readonly DomainEvent[], bucketSizeMs: number): readonly { readonly bucketStart: number; readonly bucketEnd: number; readonly count: number }[] {
  if (events.length === 0 || bucketSizeMs <= 0) return [];
  const ordered = [...events].sort((left, right) => left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id));
  const first = ordered[0]!.occurredAt;
  const count = Math.ceil((ordered.at(-1)!.occurredAt - first + 1) / bucketSizeMs);
  return Array.from({ length: count }, (_, index) => {
    const bucketStart = first + index * bucketSizeMs;
    const bucketEnd = bucketStart + bucketSizeMs - 1;
    return { bucketStart, bucketEnd, count: ordered.filter((event) => event.occurredAt >= bucketStart && event.occurredAt <= bucketEnd).length };
  });
}
