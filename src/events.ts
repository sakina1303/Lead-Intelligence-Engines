import type { CreateEventInput, DomainEvent, Outcome } from "./contracts.js";
import { failure, success, validId, validSequence, validTimestamp, validateAttributes } from "./validation.js";

export function compareEvents(left: DomainEvent, right: DomainEvent): number {
  return left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id);
}

export function createEvent(input: CreateEventInput): Outcome<DomainEvent> {
  const errors = [
    ...(!validId(input.id) ? ["event id is required"] : []),
    ...(!validId(input.leadId) ? ["event leadId is required"] : []),
    ...(!validId(input.type) ? ["event type is required"] : []),
    ...(!validTimestamp(input.occurredAt) ? ["event occurredAt must be valid"] : []),
    ...(!validSequence(input.sequence) ? ["event sequence must be valid"] : []),
    ...validateAttributes(input.attributes),
  ];
  return errors.length === 0 ? success({ ...input, type: input.type.trim(), attributes: { ...input.attributes } }) : failure(...errors);
}

export function eventMatchesType(event: DomainEvent, types: readonly string[]): boolean {
  return types.includes(event.type);
}

export * from "./event/payloads.js";
export * from "./event/causality.js";
export * from "./event/correlation.js";
export * from "./event/normalization.js";
export * from "./event/patterns.js";
