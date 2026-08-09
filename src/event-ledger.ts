import type { CreateEventInput, DomainEvent, EngineState, EventCategory, Outcome, Timestamp } from "./contracts.js";
import { compareEvents, createEvent } from "./events.js";
import { failure, success } from "./validation.js";

export interface EventQuery {
  readonly leadId?: string;
  readonly type?: string;
  readonly category?: DomainEvent["category"];
  readonly from?: number;
  readonly to?: number;
}

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

export function appendEvent(state: EngineState, input: CreateEventInput): Outcome<{ readonly state: EngineState; readonly event: DomainEvent; readonly duplicate: boolean }> {
  const eventResult = createEvent(input);
  if (!eventResult.ok) return eventResult;
  const event = eventResult.value;
  if (!state.leads[event.leadId]) return failure(`lead '${event.leadId}' does not exist`);
  const existing = state.events[event.id];
  if (existing) {
    const same = JSON.stringify(existing) === JSON.stringify(event);
    return same ? success({ state, event: existing, duplicate: true }) : failure(`event id '${event.id}' conflicts with an existing event`);
  }
  const previousIds = state.eventIdsByLead[event.leadId] ?? [];
  const ids = [...previousIds, event.id].sort((left, right) => compareEvents(eventFor(state, event, left), eventFor(state, event, right)));
  return success({
    state: {
      ...state,
      events: { ...state.events, [event.id]: event },
      eventIdsByLead: { ...state.eventIdsByLead, [event.leadId]: ids },
    },
    event,
    duplicate: false,
  });
}

function eventFor(state: EngineState, newEvent: DomainEvent, id: string): DomainEvent {
  return id === newEvent.id ? newEvent : state.events[id]!;
}

export function getLeadEvents(state: EngineState, leadId: string): readonly DomainEvent[] {
  return (state.eventIdsByLead[leadId] ?? []).map((id) => state.events[id]!).sort(compareEvents);
}

export function queryEvents(state: EngineState, query: EventQuery = {}): readonly DomainEvent[] {
  return Object.values(state.events).filter((event) =>
    (query.leadId === undefined || event.leadId === query.leadId) &&
    (query.type === undefined || event.type === query.type) &&
    (query.category === undefined || event.category === query.category) &&
    (query.from === undefined || event.occurredAt >= query.from) &&
    (query.to === undefined || event.occurredAt <= query.to),
  ).sort(compareEvents);
}

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
