import type { Lead, Outcome, Timestamp } from "../contracts.js";
import { failure, success, validTimestamp } from "../validation.js";

export function mergeLeadsDeterministic(primary: Lead, secondary: Lead, timestamp: Timestamp): Outcome<Lead> {
  if (primary.id === secondary.id) return failure("cannot merge lead with itself");
  if (!validTimestamp(timestamp)) return failure("timestamp must be valid");
  if (timestamp < primary.updatedAt || timestamp < secondary.updatedAt) return failure("merge timestamp cannot precede lead updates");
  const mergedAttributes = { ...primary.attributes };
  for (const [key, value] of Object.entries(secondary.attributes)) {
    const existing = mergedAttributes[key];
    if (existing === undefined) mergedAttributes[key] = value;
    else if (typeof existing === "string" && typeof value === "string" && (value.length > existing.length || (value.length === existing.length && value.localeCompare(existing) > 0))) mergedAttributes[key] = value;
    else if (typeof existing === "number" && typeof value === "number" && value > existing) mergedAttributes[key] = value;
    else if (typeof existing === "boolean" && typeof value === "boolean" && value) mergedAttributes[key] = true;
  }
  return success({
    id: primary.id,
    name: primary.name,
    email: primary.email,
    company: primary.company || secondary.company,
    attributes: mergedAttributes,
    lifecycle: primary.lifecycle,
    createdAt: Math.min(primary.createdAt, secondary.createdAt),
    updatedAt: timestamp,
  });
}
