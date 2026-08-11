import type { DomainEvent, Outcome } from "../contracts.js";
import { failure, success } from "../validation.js";

export interface DomainEventPayload {
  readonly kind: string;
}

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

export type TypedDomainEventPayload = PageViewPayload | FormSubmitPayload | EmailOpenPayload | EmailClickPayload | WebinarRegisterPayload | WebinarAttendPayload | DemoRequestPayload | ContractSignedPayload | SupportTicketOpenedPayload;
export interface TypedDomainEvent extends DomainEvent {
  readonly payload?: TypedDomainEventPayload;
}

export function validateEventPayload(payload: TypedDomainEventPayload): Outcome<TypedDomainEventPayload> {
  const errors: string[] = [];
  switch (payload.kind) {
    case "page-view":
      if (!payload.url) errors.push("Page view url is required");
      if (payload.durationMs !== undefined && payload.durationMs < 0) errors.push("Duration must be a positive number");
      break;
    case "form-submit": if (!payload.formId) errors.push("Form id is required"); break;
    case "email-open":
      if (!payload.campaignId) errors.push("Campaign id is required");
      if (!payload.messageId) errors.push("Message id is required");
      break;
    case "email-click":
      if (!payload.campaignId) errors.push("Campaign id is required");
      if (!payload.messageId) errors.push("Message id is required");
      if (!payload.linkUrl) errors.push("Link url is required");
      break;
    case "webinar-register":
      if (!payload.webinarId) errors.push("Webinar id is required");
      if (!payload.title) errors.push("Webinar title is required");
      break;
    case "webinar-attend":
      if (!payload.webinarId) errors.push("Webinar id is required");
      if (payload.durationMinutes < 0) errors.push("Duration must be a positive number");
      break;
    case "demo-request": if (!payload.requestedDate) errors.push("Requested date is required"); break;
    case "contract-signed":
      if (!payload.contractId) errors.push("Contract id is required");
      if (payload.valueCents < 0) errors.push("Value must be a positive number");
      if (payload.termMonths < 0) errors.push("Term must be a positive number");
      break;
    case "support-ticket-opened":
      if (!payload.ticketId) errors.push("Ticket id is required");
      if (!payload.category) errors.push("Category is required");
      break;
  }
  return errors.length === 0 ? success(payload) : failure(...errors);
}
