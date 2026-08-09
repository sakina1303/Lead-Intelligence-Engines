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

// --- Extended Domain Event Typing ---
export interface DomainEventPayload { readonly kind: string; }

export interface PageViewPayload extends DomainEventPayload {
  readonly kind: "page-view";
  readonly url: string;
  readonly referrer?: string;
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
  readonly durationMs?: number;
}

export interface FormSubmitPayload extends DomainEventPayload {
  readonly kind: "form-submit";
  readonly formId: string;
  readonly submissionData: Readonly<Record<string, string | boolean | number>>;
  readonly ipAddress?: string;
}

export interface EmailOpenPayload extends DomainEventPayload {
  readonly kind: "email-open";
  readonly campaignId: string;
  readonly messageId: string;
  readonly client?: string;
  readonly deviceType?: "mobile" | "desktop" | "tablet" | "unknown";
}

export interface EmailClickPayload extends DomainEventPayload {
  readonly kind: "email-click";
  readonly campaignId: string;
  readonly messageId: string;
  readonly linkUrl: string;
}

export interface WebinarRegisterPayload extends DomainEventPayload {
  readonly kind: "webinar-register";
  readonly webinarId: string;
  readonly title: string;
  readonly role?: string;
}

export interface WebinarAttendPayload extends DomainEventPayload {
  readonly kind: "webinar-attend";
  readonly webinarId: string;
  readonly durationMinutes: number;
  readonly pollResponses?: Readonly<Record<string, string>>;
}

export interface DemoRequestPayload extends DomainEventPayload {
  readonly kind: "demo-request";
  readonly requestedDate: string;
  readonly comments?: string;
  readonly useCase?: string;
}

export interface ContractSignedPayload extends DomainEventPayload {
  readonly kind: "contract-signed";
  readonly contractId: string;
  readonly valueCents: number;
  readonly termMonths: number;
}

export interface SupportTicketOpenedPayload extends DomainEventPayload {
  readonly kind: "support-ticket-opened";
  readonly ticketId: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly category: string;
}

export type TypedDomainEventPayload =
  | PageViewPayload
  | FormSubmitPayload
  | EmailOpenPayload
  | EmailClickPayload
  | WebinarRegisterPayload
  | WebinarAttendPayload
  | DemoRequestPayload
  | ContractSignedPayload
  | SupportTicketOpenedPayload;

export interface TypedDomainEvent extends DomainEvent {
  readonly payload?: TypedDomainEventPayload;
}

// Deep payload validation
export function validateEventPayload(payload: TypedDomainEventPayload): Outcome<TypedDomainEventPayload> {
  const errors: string[] = [];
  
  if (!payload.kind) return failure("Payload kind is missing");
  
  switch (payload.kind) {
    case "page-view":
      if (!payload.url || typeof payload.url !== 'string') errors.push("Page view url is required");
      if (payload.durationMs !== undefined && (typeof payload.durationMs !== 'number' || payload.durationMs < 0)) errors.push("Duration must be a positive number");
      break;
    case "form-submit":
      if (!payload.formId || typeof payload.formId !== 'string') errors.push("Form id is required");
      if (!payload.submissionData || typeof payload.submissionData !== 'object') errors.push("Submission data must be an object");
      break;
    case "email-open":
      if (!payload.campaignId || typeof payload.campaignId !== 'string') errors.push("Campaign id is required");
      if (!payload.messageId || typeof payload.messageId !== 'string') errors.push("Message id is required");
      break;
    case "email-click":
      if (!payload.campaignId || typeof payload.campaignId !== 'string') errors.push("Campaign id is required");
      if (!payload.messageId || typeof payload.messageId !== 'string') errors.push("Message id is required");
      if (!payload.linkUrl || typeof payload.linkUrl !== 'string') errors.push("Link url is required");
      break;
    case "webinar-register":
      if (!payload.webinarId || typeof payload.webinarId !== 'string') errors.push("Webinar id is required");
      if (!payload.title || typeof payload.title !== 'string') errors.push("Webinar title is required");
      break;
    case "webinar-attend":
      if (!payload.webinarId || typeof payload.webinarId !== 'string') errors.push("Webinar id is required");
      if (typeof payload.durationMinutes !== 'number' || payload.durationMinutes < 0) errors.push("Duration must be a positive number");
      break;
    case "demo-request":
      if (!payload.requestedDate || typeof payload.requestedDate !== 'string') errors.push("Requested date is required");
      break;
    case "contract-signed":
      if (!payload.contractId || typeof payload.contractId !== 'string') errors.push("Contract id is required");
      if (typeof payload.valueCents !== 'number' || payload.valueCents < 0) errors.push("Value must be a positive number");
      if (typeof payload.termMonths !== 'number' || payload.termMonths < 0) errors.push("Term must be a positive number");
      break;
    case "support-ticket-opened":
      if (!payload.ticketId || typeof payload.ticketId !== 'string') errors.push("Ticket id is required");
      if (!["low", "medium", "high", "critical"].includes(payload.severity)) errors.push("Invalid severity");
      if (!payload.category || typeof payload.category !== 'string') errors.push("Category is required");
      break;
    default:
      errors.push(`Unknown payload kind: ${(payload as any).kind}`);
  }
  
  return errors.length === 0 ? success(payload) : failure(...errors);
}

