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
      errors.push("Unknown payload kind");
  }
  
  return errors.length === 0 ? success(payload) : failure(...errors);
}

// --- Event Causality Chains ---

export interface CausalLink {
  readonly parentEventId: string;
  readonly childEventId: string;
  readonly relationship: "caused-by" | "followed-by" | "correlated-with";
}

export interface CausalityChain {
  readonly rootEventId: string;
  readonly links: readonly CausalLink[];
  readonly depth: number;
  readonly totalEvents: number;
}

export function buildCausalityChain(events: readonly DomainEvent[], rootEventId: string, maxDepth: number = 10): CausalityChain {
  const eventMap = new Map<string, DomainEvent>();
  for (const event of events) eventMap.set(event.id, event);
  
  const root = eventMap.get(rootEventId);
  if (!root) return { rootEventId, links: [], depth: 0, totalEvents: 0 };
  
  const links: CausalLink[] = [];
  const visited = new Set<string>([rootEventId]);
  const queue: { eventId: string; depth: number }[] = [{ eventId: rootEventId, depth: 0 }];
  let maxReachedDepth = 0;
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    
    const currentEvent = eventMap.get(current.eventId)!;
    
    // Find events from the same lead that happened after this one
    // within a temporal causality window (same lead, sequential ordering)
    const candidates = events.filter(e => 
      e.leadId === currentEvent.leadId && 
      e.occurredAt > currentEvent.occurredAt && 
      !visited.has(e.id)
    ).sort((a, b) => a.occurredAt - b.occurredAt || a.sequence - b.sequence || a.id.localeCompare(b.id));
    
    // Link to the immediately next event (direct causal successor)
    if (candidates.length > 0) {
      const next = candidates[0]!;
      const timeDelta = next.occurredAt - currentEvent.occurredAt;
      const relationship: CausalLink["relationship"] = 
        timeDelta === 0 ? "correlated-with" : 
        next.category === currentEvent.category ? "followed-by" : "caused-by";
      
      links.push({ parentEventId: current.eventId, childEventId: next.id, relationship });
      visited.add(next.id);
      maxReachedDepth = Math.max(maxReachedDepth, current.depth + 1);
      queue.push({ eventId: next.id, depth: current.depth + 1 });
    }
  }
  
  return { rootEventId, links, depth: maxReachedDepth, totalEvents: visited.size };
}

// --- Event Correlation Groups ---

export interface CorrelationGroup {
  readonly groupId: string;
  readonly strategy: "session" | "campaign" | "temporal";
  readonly eventIds: readonly string[];
  readonly leadId: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
}

export function groupEventsBySession(events: readonly DomainEvent[], sessionGapMs: number): readonly CorrelationGroup[] {
  const byLead = new Map<string, DomainEvent[]>();
  for (const event of events) {
    const list = byLead.get(event.leadId) ?? [];
    list.push(event);
    byLead.set(event.leadId, list);
  }
  
  const groups: CorrelationGroup[] = [];
  let groupCounter = 0;
  
  for (const [leadId, leadEvents] of byLead) {
    const sorted = [...leadEvents].sort((a, b) => a.occurredAt - b.occurredAt || a.sequence - b.sequence);
    if (sorted.length === 0) continue;
    
    let sessionStart = sorted[0]!.occurredAt;
    let sessionEvents: DomainEvent[] = [sorted[0]!];
    
    for (let i = 1; i < sorted.length; i++) {
      const event = sorted[i]!;
      const gap = event.occurredAt - sorted[i - 1]!.occurredAt;
      
      if (gap > sessionGapMs) {
        // Close current session
        const lastEvent = sessionEvents[sessionEvents.length - 1]!;
        groups.push({
          groupId: `session-${groupCounter++}`,
          strategy: "session",
          eventIds: sessionEvents.map(e => e.id),
          leadId,
          startedAt: sessionStart,
          endedAt: lastEvent.occurredAt,
          durationMs: lastEvent.occurredAt - sessionStart,
        });
        sessionStart = event.occurredAt;
        sessionEvents = [event];
      } else {
        sessionEvents.push(event);
      }
    }
    
    // Close final session
    const lastEvent = sessionEvents[sessionEvents.length - 1]!;
    groups.push({
      groupId: `session-${groupCounter++}`,
      strategy: "session",
      eventIds: sessionEvents.map(e => e.id),
      leadId,
      startedAt: sessionStart,
      endedAt: lastEvent.occurredAt,
      durationMs: lastEvent.occurredAt - sessionStart,
    });
  }
  
  return groups.sort((a, b) => a.startedAt - b.startedAt || a.groupId.localeCompare(b.groupId));
}

export function groupEventsByCampaign(events: readonly DomainEvent[], campaignAttributeKey: string): readonly CorrelationGroup[] {
  const byCampaign = new Map<string, DomainEvent[]>();
  
  for (const event of events) {
    const campaignId = event.attributes[campaignAttributeKey];
    if (typeof campaignId !== "string" || campaignId.trim().length === 0) continue;
    const list = byCampaign.get(campaignId) ?? [];
    list.push(event);
    byCampaign.set(campaignId, list);
  }
  
  const groups: CorrelationGroup[] = [];
  
  for (const [campaignId, campaignEvents] of byCampaign) {
    const sorted = [...campaignEvents].sort((a, b) => a.occurredAt - b.occurredAt || a.sequence - b.sequence);
    // Group by lead within campaign
    const byLead = new Map<string, DomainEvent[]>();
    for (const e of sorted) {
      const list = byLead.get(e.leadId) ?? [];
      list.push(e);
      byLead.set(e.leadId, list);
    }
    
    for (const [leadId, leadEvents] of byLead) {
      const first = leadEvents[0]!;
      const last = leadEvents[leadEvents.length - 1]!;
      groups.push({
        groupId: `campaign-${campaignId}-${leadId}`,
        strategy: "campaign",
        eventIds: leadEvents.map(e => e.id),
        leadId,
        startedAt: first.occurredAt,
        endedAt: last.occurredAt,
        durationMs: last.occurredAt - first.occurredAt,
      });
    }
  }
  
  return groups.sort((a, b) => a.startedAt - b.startedAt || a.groupId.localeCompare(b.groupId));
}

// --- Content-Based Deduplication ---

export function computeEventContentHash(event: DomainEvent): string {
  const parts = [
    event.leadId,
    event.type,
    event.category,
    String(event.occurredAt),
    ...Object.entries(event.attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v)}`)
  ];
  // Simple deterministic hash using djb2
  let hash = 5381;
  const content = parts.join("|");
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  }
  return `hash-${(hash >>> 0).toString(36)}`;
}

export function findDuplicateEvents(events: readonly DomainEvent[]): readonly { readonly originalId: string; readonly duplicateId: string; readonly contentHash: string }[] {
  const hashToFirst = new Map<string, string>();
  const duplicates: { originalId: string; duplicateId: string; contentHash: string }[] = [];
  
  for (const event of [...events].sort((a, b) => a.occurredAt - b.occurredAt || a.sequence - b.sequence || a.id.localeCompare(b.id))) {
    const hash = computeEventContentHash(event);
    const existing = hashToFirst.get(hash);
    if (existing !== undefined && existing !== event.id) {
      duplicates.push({ originalId: existing, duplicateId: event.id, contentHash: hash });
    } else {
      hashToFirst.set(hash, event.id);
    }
  }
  
  return duplicates;
}

// --- Payload Canonicalization ---

export function canonicalizePayload(payload: TypedDomainEventPayload): TypedDomainEventPayload {
  switch (payload.kind) {
    case "page-view":
      return { ...payload, url: payload.url.trim().toLowerCase().replace(/\/+$/, "") };
    case "form-submit": {
      const sortedData: Record<string, string | boolean | number> = {};
      for (const key of Object.keys(payload.submissionData).sort()) {
        const value = payload.submissionData[key]!;
        sortedData[key] = typeof value === "string" ? value.trim() : value;
      }
      return { ...payload, formId: payload.formId.trim(), submissionData: sortedData };
    }
    case "email-open":
      return { ...payload, campaignId: payload.campaignId.trim(), messageId: payload.messageId.trim() };
    case "email-click":
      return { ...payload, campaignId: payload.campaignId.trim(), messageId: payload.messageId.trim(), linkUrl: payload.linkUrl.trim().toLowerCase() };
    case "webinar-register":
      return { ...payload, webinarId: payload.webinarId.trim(), title: payload.title.trim() };
    case "webinar-attend":
      return { ...payload, webinarId: payload.webinarId.trim(), durationMinutes: Math.max(0, Math.round(payload.durationMinutes)) };
    case "demo-request":
      return { ...payload, requestedDate: payload.requestedDate.trim() };
    case "contract-signed":
      return { ...payload, contractId: payload.contractId.trim(), valueCents: Math.max(0, Math.round(payload.valueCents)), termMonths: Math.max(1, Math.round(payload.termMonths)) };
    case "support-ticket-opened":
      return { ...payload, ticketId: payload.ticketId.trim(), category: payload.category.trim().toLowerCase() };
  }
}

// --- Event Sequence Pattern Matching ---

export interface EventPattern {
  readonly id: string;
  readonly name: string;
  readonly steps: readonly EventPatternStep[];
  readonly maxWindowMs: number;
}

export interface EventPatternStep {
  readonly eventType: string;
  readonly category?: string;
  readonly requiredAttributes?: Readonly<Record<string, string | number | boolean>>;
  readonly optional?: boolean;
}

export interface PatternMatch {
  readonly patternId: string;
  readonly leadId: string;
  readonly matchedEventIds: readonly string[];
  readonly startedAt: number;
  readonly completedAt: number;
  readonly windowMs: number;
  readonly skippedOptionalSteps: readonly string[];
}

export function matchEventPattern(events: readonly DomainEvent[], leadId: string, pattern: EventPattern): PatternMatch | null {
  const leadEvents = events
    .filter(e => e.leadId === leadId)
    .sort((a, b) => a.occurredAt - b.occurredAt || a.sequence - b.sequence || a.id.localeCompare(b.id));
  
  if (leadEvents.length === 0) return null;
  
  // Try each event as the starting point of the pattern
  for (let startIdx = 0; startIdx < leadEvents.length; startIdx++) {
    const startEvent = leadEvents[startIdx]!;
    const matchedIds: string[] = [];
    const skippedOptional: string[] = [];
    let stepIdx = 0;
    let eventIdx = startIdx;
    
    while (stepIdx < pattern.steps.length && eventIdx < leadEvents.length) {
      const step = pattern.steps[stepIdx]!;
      const event = leadEvents[eventIdx]!;
      
      // Check window constraint
      if (event.occurredAt - startEvent.occurredAt > pattern.maxWindowMs) {
        if (step.optional) {
          skippedOptional.push(step.eventType);
          stepIdx++;
          continue;
        }
        break;
      }
      
      // Check if event matches this step
      const typeMatch = event.type === step.eventType;
      const catMatch = step.category === undefined || event.category === step.category;
      const attrMatch = step.requiredAttributes === undefined || 
        Object.entries(step.requiredAttributes).every(([k, v]) => event.attributes[k] === v);
      
      if (typeMatch && catMatch && attrMatch) {
        matchedIds.push(event.id);
        stepIdx++;
        eventIdx++;
      } else if (step.optional) {
        skippedOptional.push(step.eventType);
        stepIdx++;
        // Don't advance event index — this event might match the next step
      } else {
        eventIdx++;
      }
    }
    
    // Skip remaining optional steps at the end
    while (stepIdx < pattern.steps.length && pattern.steps[stepIdx]!.optional) {
      skippedOptional.push(pattern.steps[stepIdx]!.eventType);
      stepIdx++;
    }
    
    if (stepIdx === pattern.steps.length && matchedIds.length > 0) {
      const lastMatchedEvent = leadEvents.find(e => e.id === matchedIds[matchedIds.length - 1]!)!;
      return {
        patternId: pattern.id,
        leadId,
        matchedEventIds: matchedIds,
        startedAt: startEvent.occurredAt,
        completedAt: lastMatchedEvent.occurredAt,
        windowMs: lastMatchedEvent.occurredAt - startEvent.occurredAt,
        skippedOptionalSteps: skippedOptional,
      };
    }
  }
  
  return null;
}

// --- Event Frequency Distribution ---

export interface FrequencyBucket {
  readonly label: string;
  readonly count: number;
  readonly proportion: number;
}

export function computeEventFrequencyDistribution(events: readonly DomainEvent[], bucketField: "type" | "category"): readonly FrequencyBucket[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = bucketField === "type" ? event.type : event.category;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  
  const total = events.length;
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, proportion: total > 0 ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function computeTemporalDistribution(events: readonly DomainEvent[], bucketSizeMs: number): readonly { readonly bucketStart: number; readonly bucketEnd: number; readonly count: number }[] {
  if (events.length === 0 || bucketSizeMs <= 0) return [];
  
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const first = sorted[0]!.occurredAt;
  const last = sorted[sorted.length - 1]!.occurredAt;
  
  const bucketCount = Math.ceil((last - first + 1) / bucketSizeMs);
  const buckets: { bucketStart: number; bucketEnd: number; count: number }[] = [];
  
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = first + i * bucketSizeMs;
    const bucketEnd = bucketStart + bucketSizeMs - 1;
    const count = sorted.filter(e => e.occurredAt >= bucketStart && e.occurredAt <= bucketEnd).length;
    buckets.push({ bucketStart, bucketEnd, count });
  }
  
  return buckets;
}
