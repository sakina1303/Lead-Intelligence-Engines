import type { DomainEvent, EngineState, EventCategory, Timestamp } from "./contracts.js";
import { compareEvents } from "./events.js";

export interface EventQueryFilter {
  readonly leadIds?: readonly string[];
  readonly types?: readonly string[];
  readonly categories?: readonly EventCategory[];
  readonly from?: Timestamp;
  readonly to?: Timestamp;
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
  readonly limit?: number;
}

export interface EventWindow {
  readonly from: Timestamp;
  readonly to: Timestamp;
}

export interface EventTypeSummary {
  readonly type: string;
  readonly count: number;
  readonly firstOccurredAt: Timestamp;
  readonly lastOccurredAt: Timestamp;
  readonly leadIds: readonly string[];
}

export interface EventEvidence {
  readonly leadId: string;
  readonly window: EventWindow;
  readonly eventCount: number;
  readonly distinctTypes: readonly string[];
  readonly categories: Readonly<Record<EventCategory, number>>;
  readonly firstOccurredAt?: Timestamp;
  readonly lastOccurredAt?: Timestamp;
}

const allCategories: readonly EventCategory[] = ["engagement", "intent", "profile", "commercial", "support", "custom"];

function matchesAttributes(event: DomainEvent, expected: Readonly<Record<string, string | number | boolean>>): boolean {
  return Object.entries(expected).every(([key, value]) => event.attributes[key] === value);
}

export function queryEventLedger(state: EngineState, filter: EventQueryFilter = {}): readonly DomainEvent[] {
  const candidates = Object.values(state.events).filter((event) =>
    (filter.leadIds === undefined || filter.leadIds.includes(event.leadId)) &&
    (filter.types === undefined || filter.types.includes(event.type)) &&
    (filter.categories === undefined || filter.categories.includes(event.category)) &&
    (filter.from === undefined || event.occurredAt >= filter.from) &&
    (filter.to === undefined || event.occurredAt <= filter.to) &&
    (filter.attributes === undefined || matchesAttributes(event, filter.attributes)),
  ).sort(compareEvents);
  return filter.limit === undefined ? candidates : candidates.slice(0, Math.max(0, filter.limit));
}

export function eventsInWindow(state: EngineState, leadId: string, window: EventWindow): readonly DomainEvent[] {
  return queryEventLedger(state, { leadIds: [leadId], from: window.from, to: window.to });
}

export function summarizeEventTypes(events: readonly DomainEvent[]): readonly EventTypeSummary[] {
  const summaries = new Map<string, { count: number; firstOccurredAt: Timestamp; lastOccurredAt: Timestamp; leadIds: Set<string> }>();
  for (const event of [...events].sort(compareEvents)) {
    const existing = summaries.get(event.type);
    if (existing) {
      existing.count += 1;
      existing.lastOccurredAt = event.occurredAt;
      existing.leadIds.add(event.leadId);
    } else {
      summaries.set(event.type, { count: 1, firstOccurredAt: event.occurredAt, lastOccurredAt: event.occurredAt, leadIds: new Set([event.leadId]) });
    }
  }
  return [...summaries.entries()].map(([type, summary]) => ({ type, count: summary.count, firstOccurredAt: summary.firstOccurredAt, lastOccurredAt: summary.lastOccurredAt, leadIds: [...summary.leadIds].sort((left, right) => left.localeCompare(right)) })).sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
}

export function collectEventEvidence(state: EngineState, leadId: string, window: EventWindow): EventEvidence {
  const events = eventsInWindow(state, leadId, window);
  const categories = Object.fromEntries(allCategories.map((category) => [category, 0])) as Record<EventCategory, number>;
  for (const event of events) categories[event.category] += 1;
  return {
    leadId,
    window,
    eventCount: events.length,
    distinctTypes: [...new Set(events.map((event) => event.type))].sort((left, right) => left.localeCompare(right)),
    categories,
    ...(events.length === 0 ? {} : { firstOccurredAt: events[0]!.occurredAt, lastOccurredAt: events[events.length - 1]!.occurredAt }),
  };
}

export function countEventsByLead(state: EngineState, filter: Omit<EventQueryFilter, "leadIds" | "limit"> = {}): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const event of queryEventLedger(state, filter)) counts[event.leadId] = (counts[event.leadId] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}
