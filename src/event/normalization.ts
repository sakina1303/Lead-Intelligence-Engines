import type { DomainEvent } from "../contracts.js";
import type { TypedDomainEventPayload } from "./payloads.js";

export function computeEventContentHash(event: DomainEvent): string {
  const content = [event.leadId, event.type, event.category, String(event.occurredAt), ...Object.entries(event.attributes).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${String(value)}`)].join("|");
  let hash = 5381;
  for (let index = 0; index < content.length; index += 1) hash = ((hash << 5) + hash + content.charCodeAt(index)) | 0;
  return `hash-${(hash >>> 0).toString(36)}`;
}

export function findDuplicateEvents(events: readonly DomainEvent[]): readonly { readonly originalId: string; readonly duplicateId: string; readonly contentHash: string }[] {
  const firstByHash = new Map<string, string>();
  const duplicates: { originalId: string; duplicateId: string; contentHash: string }[] = [];
  for (const event of [...events].sort((left, right) => left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id))) {
    const contentHash = computeEventContentHash(event);
    const originalId = firstByHash.get(contentHash);
    if (originalId && originalId !== event.id) duplicates.push({ originalId, duplicateId: event.id, contentHash });
    else firstByHash.set(contentHash, event.id);
  }
  return duplicates;
}

export function canonicalizePayload(payload: TypedDomainEventPayload): TypedDomainEventPayload {
  switch (payload.kind) {
    case "page-view": return { ...payload, url: payload.url.trim().toLowerCase().replace(/\/+$/, "") };
    case "form-submit": return { ...payload, formId: payload.formId.trim(), submissionData: Object.fromEntries(Object.entries(payload.submissionData).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) };
    case "email-open": return { ...payload, campaignId: payload.campaignId.trim(), messageId: payload.messageId.trim() };
    case "email-click": return { ...payload, campaignId: payload.campaignId.trim(), messageId: payload.messageId.trim(), linkUrl: payload.linkUrl.trim().toLowerCase() };
    case "webinar-register": return { ...payload, webinarId: payload.webinarId.trim(), title: payload.title.trim() };
    case "webinar-attend": return { ...payload, webinarId: payload.webinarId.trim(), durationMinutes: Math.max(0, Math.round(payload.durationMinutes)) };
    case "demo-request": return { ...payload, requestedDate: payload.requestedDate.trim() };
    case "contract-signed": return { ...payload, contractId: payload.contractId.trim(), valueCents: Math.max(0, Math.round(payload.valueCents)), termMonths: Math.max(1, Math.round(payload.termMonths)) };
    case "support-ticket-opened": return { ...payload, ticketId: payload.ticketId.trim(), category: payload.category.trim().toLowerCase() };
  }
}
