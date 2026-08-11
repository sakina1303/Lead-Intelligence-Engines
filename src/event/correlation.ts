import type { DomainEvent } from "../contracts.js";

export interface CorrelationGroup { readonly groupId: string; readonly strategy: "session" | "campaign" | "temporal"; readonly eventIds: readonly string[]; readonly leadId: string; readonly startedAt: number; readonly endedAt: number; readonly durationMs: number; }

function group(leadId: string, id: string, strategy: CorrelationGroup["strategy"], events: readonly DomainEvent[]): CorrelationGroup {
  const ordered = [...events].sort((left, right) => left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id));
  return { groupId: id, strategy, eventIds: ordered.map((event) => event.id), leadId, startedAt: ordered[0]!.occurredAt, endedAt: ordered.at(-1)!.occurredAt, durationMs: ordered.at(-1)!.occurredAt - ordered[0]!.occurredAt };
}

export function groupEventsBySession(events: readonly DomainEvent[], sessionGapMs: number): readonly CorrelationGroup[] {
  const byLead = new Map<string, DomainEvent[]>();
  for (const event of events) (byLead.get(event.leadId) ?? (() => { const list: DomainEvent[] = []; byLead.set(event.leadId, list); return list; })()).push(event);
  const groups: CorrelationGroup[] = [];
  let counter = 0;
  for (const [leadId, leadEvents] of byLead) {
    const ordered = [...leadEvents].sort((left, right) => left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id));
    let current: DomainEvent[] = [];
    for (const event of ordered) {
      if (current.length > 0 && event.occurredAt - current.at(-1)!.occurredAt > sessionGapMs) {
        groups.push(group(leadId, `session-${counter++}`, "session", current));
        current = [];
      }
      current.push(event);
    }
    if (current.length > 0) groups.push(group(leadId, `session-${counter++}`, "session", current));
  }
  return groups.sort((left, right) => left.startedAt - right.startedAt || left.groupId.localeCompare(right.groupId));
}

export function groupEventsByCampaign(events: readonly DomainEvent[], campaignAttributeKey: string): readonly CorrelationGroup[] {
  const campaigns = new Map<string, DomainEvent[]>();
  for (const event of events) {
    const campaign = event.attributes[campaignAttributeKey];
    if (typeof campaign === "string" && campaign.trim()) (campaigns.get(campaign) ?? (() => { const list: DomainEvent[] = []; campaigns.set(campaign, list); return list; })()).push(event);
  }
  const groups: CorrelationGroup[] = [];
  for (const [campaign, campaignEvents] of campaigns) {
    const byLead = new Map<string, DomainEvent[]>();
    for (const event of campaignEvents) (byLead.get(event.leadId) ?? (() => { const list: DomainEvent[] = []; byLead.set(event.leadId, list); return list; })()).push(event);
    for (const [leadId, leadEvents] of byLead) groups.push(group(leadId, `campaign-${campaign}-${leadId}`, "campaign", leadEvents));
  }
  return groups.sort((left, right) => left.startedAt - right.startedAt || left.groupId.localeCompare(right.groupId));
}
