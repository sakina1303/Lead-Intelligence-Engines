import type { DomainEvent, Lead, QualificationResult, SegmentPolicy, SegmentResult } from "./contracts.js";
import { matchesAttributes } from "./scoring-rules.js";

// --- Advanced Segmentation ---

export interface SegmentTransitionConfig {
  readonly requiredTimeInPreviousSegmentMs?: number;
  readonly allowedPreviousSegments?: readonly string[];
  readonly preventReEntry?: boolean;
}

export interface AdvancedSegmentRule {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly minimumScore?: number;
  readonly maximumScore?: number;
  readonly qualificationStates?: readonly string[];
  readonly requiredAttributes?: Readonly<Record<string, string | number | boolean>>;
  readonly requiredEventTypes?: readonly string[];
  readonly requiredDimensionScores?: Readonly<Record<string, number>>;
  readonly transitionConfig?: SegmentTransitionConfig;
}

export interface AdvancedSegmentPolicy extends SegmentPolicy {
  readonly advancedRules?: readonly AdvancedSegmentRule[];
}

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

export function assignAdvancedSegment(
  lead: Lead, 
  score: number, 
  dimensions: Readonly<Record<string, number>>, 
  events: readonly DomainEvent[], 
  qualification: QualificationResult | undefined, 
  policy: AdvancedSegmentPolicy,
  previousSegment?: string,
  timeInPreviousSegmentMs?: number
): SegmentResult {
  
  if (!policy.advancedRules) {
    return assignSegment(lead, score, events, qualification, policy);
  }

  const sortedRules = [...policy.advancedRules].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  for (const candidate of sortedRules) {
    const scoreMatch = (candidate.minimumScore === undefined || score >= candidate.minimumScore) &&
                       (candidate.maximumScore === undefined || score <= candidate.maximumScore);
    const qualMatch = candidate.qualificationStates === undefined || 
                      (qualification !== undefined && candidate.qualificationStates.includes(qualification.state));
    const attrMatch = matchesAttributes(lead.attributes, candidate.requiredAttributes);
    const eventMatch = (candidate.requiredEventTypes ?? []).every((type) => events.some((event) => event.type === type));
    
    let dimMatch = true;
    if (candidate.requiredDimensionScores) {
      for (const [dim, min] of Object.entries(candidate.requiredDimensionScores)) {
        if ((dimensions[dim] ?? 0) < min) {
          dimMatch = false;
          break;
        }
      }
    }

    let transitionMatch = true;
    if (candidate.transitionConfig) {
      if (candidate.transitionConfig.allowedPreviousSegments && previousSegment) {
        if (!candidate.transitionConfig.allowedPreviousSegments.includes(previousSegment)) {
          transitionMatch = false;
        }
      }
      if (candidate.transitionConfig.requiredTimeInPreviousSegmentMs && timeInPreviousSegmentMs !== undefined) {
        if (timeInPreviousSegmentMs < candidate.transitionConfig.requiredTimeInPreviousSegmentMs) {
          transitionMatch = false;
        }
      }
      if (candidate.transitionConfig.preventReEntry && previousSegment === candidate.name) {
        transitionMatch = false;
      }
    }

    if (scoreMatch && qualMatch && attrMatch && eventMatch && dimMatch && transitionMatch) {
      return { leadId: lead.id, segment: candidate.name, matchedRuleId: candidate.id };
    }
  }

  return { leadId: lead.id, segment: policy.fallback };
}

export function analyzeSegmentMobility(history: readonly SegmentResult[]): { totalTransitions: number; mostFrequentSegment: string } {
  if (history.length === 0) return { totalTransitions: 0, mostFrequentSegment: "none" };
  const counts: Record<string, number> = {};
  let transitions = 0;
  
  let current = history[0]!.segment;
  counts[current] = 1;

  for (let i = 1; i < history.length; i++) {
    const next = history[i]!.segment;
    counts[next] = (counts[next] ?? 0) + 1;
    if (next !== current) {
      transitions++;
      current = next;
    }
  }

  const mostFreq = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0];
  return { totalTransitions: transitions, mostFrequentSegment: mostFreq };
}
