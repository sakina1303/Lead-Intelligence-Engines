import type { DomainEvent, Lead, QualificationPolicy, QualificationResult, Timestamp } from "./contracts.js";

// --- Advanced Qualification Evaluation ---

export interface QualificationEvidence {
  readonly thresholdMet: boolean;
  readonly scoreContribution: number;
  readonly matchedEvents: readonly string[];
  readonly recencyMs: number | null;
  readonly velocityGradientMet: boolean;
}

export interface AdvancedQualificationPolicy extends QualificationPolicy {
  readonly maxScoreRecencyMs?: number;
  readonly requiredVelocityGradient?: number;
  readonly disqualificationEvents?: readonly string[];
  readonly autoQualifyEvents?: readonly string[];
  readonly minimumDimensionScores?: Readonly<Record<string, number>>;
}

export function evaluateQualification(lead: Lead, score: number, events: readonly DomainEvent[], policy: QualificationPolicy, evaluatedAt: Timestamp): QualificationResult {
  const reasons: string[] = [];
  if (score < policy.minimumScore) reasons.push(`score is below ${policy.minimumScore}`);
  if (policy.minimumEvents !== undefined && events.length < policy.minimumEvents) reasons.push(`event count is below ${policy.minimumEvents}`);
  for (const type of policy.requiredEventTypes ?? []) {
    if (!events.some((event) => event.type === type)) reasons.push(`missing required event '${type}'`);
  }
  if (policy.allowedLifecycles !== undefined && !policy.allowedLifecycles.includes(lead.lifecycle)) {
    reasons.push(`lifecycle '${lead.lifecycle}' is not eligible`);
  }
  return { leadId: lead.id, policyId: policy.id, state: reasons.length === 0 ? policy.qualification : "unqualified", evaluatedAt, reasons };
}

export function evaluateAdvancedQualification(lead: Lead, score: number, dimensions: Record<string, number>, events: readonly DomainEvent[], policy: AdvancedQualificationPolicy, evaluatedAt: Timestamp): { result: QualificationResult; evidence: QualificationEvidence } {
  let isDisqualified = false;
  let isAutoQualified = false;
  const matchedDisqual = events.find(e => policy.disqualificationEvents?.includes(e.type));
  const matchedAuto = events.find(e => policy.autoQualifyEvents?.includes(e.type));

  if (matchedDisqual) {
    isDisqualified = true;
  } else if (matchedAuto) {
    isAutoQualified = true;
  }

  const baseResult = evaluateQualification(lead, score, events, policy, evaluatedAt);
  const reasons = [...baseResult.reasons];
  
  if (policy.minimumDimensionScores) {
    for (const [dim, minScore] of Object.entries(policy.minimumDimensionScores)) {
      if ((dimensions[dim] ?? 0) < minScore) {
        reasons.push(`dimension ${dim} score below ${minScore}`);
      }
    }
  }

  if (isDisqualified) {
    reasons.push("matched disqualification event");
  }

  const latestEvent = events.length > 0 ? [...events].sort((a, b) => b.occurredAt - a.occurredAt)[0] : undefined;
  const recencyMs = latestEvent ? evaluatedAt - latestEvent.occurredAt : null;
  
  if (policy.maxScoreRecencyMs && recencyMs !== null && recencyMs > policy.maxScoreRecencyMs) {
    reasons.push(`latest event is too old (${recencyMs}ms)`);
  }

  let finalState = baseResult.state;
  if (isDisqualified) finalState = "unqualified"; // or "disqualified" if supported by type
  else if (isAutoQualified) finalState = policy.qualification;
  else if (reasons.length > 0) finalState = "unqualified";
  
  return {
    result: { leadId: lead.id, policyId: policy.id, state: finalState, evaluatedAt, reasons: isAutoQualified && !isDisqualified ? [] : reasons },
    evidence: {
      thresholdMet: finalState !== "unqualified",
      scoreContribution: score,
      matchedEvents: events.map(e => e.id),
      recencyMs,
      velocityGradientMet: true
    }
  };
}

export function selectQualification(results: readonly QualificationResult[]): QualificationResult | undefined {
  const accepted = results.filter((result) => result.state !== "unqualified");
  return accepted.sort((left, right) => left.policyId.localeCompare(right.policyId))[0];
}

export function buildQualificationEvidenceChain(results: readonly QualificationResult[]): readonly string[] {
  return results.map(r => `[${r.policyId} -> ${r.state}]: ${r.reasons.join(', ')}`);
}
