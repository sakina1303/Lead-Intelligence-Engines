import type { CreateEventInput, DomainEvent, EngineState, Outcome } from "./contracts.js";
import { compareEvents, createEvent } from "./events.js";
import { failure, success } from "./validation.js";

export interface EventQuery {
  readonly leadId?: string;
  readonly type?: string;
  readonly category?: DomainEvent["category"];
  readonly from?: number;
  readonly to?: number;
}

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
