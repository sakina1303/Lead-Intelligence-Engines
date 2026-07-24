import type { DomainEvent, Lead, QualificationResult, SegmentPolicy, SegmentResult } from "./contracts.js";
import { matchesAttributes } from "./scoring-rules.js";

export function assignSegment(lead: Lead, score: number, events: readonly DomainEvent[], qualification: QualificationResult | undefined, policy: SegmentPolicy): SegmentResult {
  const rule = [...policy.rules].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id)).find((candidate) =>
    (candidate.minimumScore === undefined || score >= candidate.minimumScore) &&
    (candidate.maximumScore === undefined || score <= candidate.maximumScore) &&
    (candidate.qualificationStates === undefined || (qualification !== undefined && candidate.qualificationStates.includes(qualification.state))) &&
    matchesAttributes(lead.attributes, candidate.requiredAttributes) &&
    (candidate.requiredEventTypes ?? []).every((type) => events.some((event) => event.type === type)),
  );
  return rule ? { leadId: lead.id, segment: rule.name, matchedRuleId: rule.id } : { leadId: lead.id, segment: policy.fallback };
}
