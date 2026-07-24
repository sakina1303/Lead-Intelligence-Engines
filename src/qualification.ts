import type { DomainEvent, Lead, QualificationPolicy, QualificationResult, Timestamp } from "./contracts.js";

export function evaluateQualification(lead: Lead, score: number, events: readonly DomainEvent[], policy: QualificationPolicy, evaluatedAt: Timestamp): QualificationResult {
  const reasons: string[] = [];
  if (score < policy.minimumScore) reasons.push(`score is below ${policy.minimumScore}`);
  if (policy.minimumEvents !== undefined && events.length < policy.minimumEvents) reasons.push(`event count is below ${policy.minimumEvents}`);
  for (const type of policy.requiredEventTypes ?? []) if (!events.some((event) => event.type === type)) reasons.push(`missing required event '${type}'`);
  if (policy.allowedLifecycles !== undefined && !policy.allowedLifecycles.includes(lead.lifecycle)) reasons.push(`lifecycle '${lead.lifecycle}' is not eligible`);
  return { leadId: lead.id, policyId: policy.id, state: reasons.length === 0 ? policy.qualification : "unqualified", evaluatedAt, reasons };
}

export function selectQualification(results: readonly QualificationResult[]): QualificationResult | undefined {
  const accepted = results.filter((result) => result.state !== "unqualified");
  return accepted.sort((left, right) => left.policyId.localeCompare(right.policyId))[0];
}
