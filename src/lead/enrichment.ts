import type { Lead, Outcome, Timestamp } from "../contracts.js";
import { failure, success, validTimestamp } from "../validation.js";

export interface EnrichmentRule {
  readonly id: string;
  readonly triggerAttributes: readonly string[];
  readonly enrichedAttributes: Readonly<Record<string, string | number | boolean>>;
  readonly condition: (lead: Lead) => boolean;
}

export function enrichLead(lead: Lead, rules: readonly EnrichmentRule[], timestamp: Timestamp): Outcome<Lead> {
  if (!validTimestamp(timestamp) || timestamp < lead.updatedAt) return failure("enrichment timestamp cannot precede the lead update");
  const attributes = { ...lead.attributes };
  let modified = false;
  for (const rule of rules) {
    if (!rule.condition(lead)) continue;
    for (const [key, value] of Object.entries(rule.enrichedAttributes)) {
      if (attributes[key] === undefined) {
        attributes[key] = value;
        modified = true;
      }
    }
  }
  return success(modified ? { ...lead, attributes, updatedAt: timestamp } : lead);
}
