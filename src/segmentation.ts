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
    const attrMatch = !candidate.requiredAttributes || Object.entries(candidate.requiredAttributes).every(([k, v]) => lead.attributes[k] === v);
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

// --- RFM Analysis (Recency, Frequency, Monetary/Value) ---

export interface RFMConfig {
  readonly recencyThresholds: readonly number[]; // e.g. [7 days, 30 days] (in ms)
  readonly frequencyThresholds: readonly number[]; // e.g. [5 events, 20 events]
  readonly valueEventTypes: readonly string[]; // Events that contribute to value
  readonly valueThresholds: readonly number[]; // e.g. [100, 1000]
}

export interface RFMScore {
  readonly r: number; // 1 (worst) to N (best)
  readonly f: number;
  readonly m: number;
  readonly segment: string;
}

export function calculateRFM(events: readonly DomainEvent[], config: RFMConfig, evaluatedAt: number): RFMScore {
  if (events.length === 0) return { r: 1, f: 1, m: 1, segment: "111" };

  const latestEvent = events.reduce((latest, e) => e.occurredAt > latest.occurredAt ? e : latest, events[0]!);
  const recencyMs = evaluatedAt - latestEvent.occurredAt;
  
  let rScore = 1;
  for (let i = 0; i < config.recencyThresholds.length; i++) {
    if (recencyMs <= config.recencyThresholds[i]!) {
      rScore = config.recencyThresholds.length + 1 - i;
      break;
    }
  }

  let fScore = 1;
  for (let i = 0; i < config.frequencyThresholds.length; i++) {
    if (events.length >= config.frequencyThresholds[config.frequencyThresholds.length - 1 - i]!) {
      fScore = config.frequencyThresholds.length + 1 - i;
      break;
    }
  }

  const valueEvents = events.filter(e => config.valueEventTypes.includes(e.type));
  // Mock value calculation: sum of a specific attribute, or just count if no attribute exists
  const mValue = valueEvents.reduce((sum, e) => sum + (typeof e.attributes['value'] === 'number' ? e.attributes['value'] : 10), 0);
  
  let mScore = 1;
  for (let i = 0; i < config.valueThresholds.length; i++) {
    if (mValue >= config.valueThresholds[config.valueThresholds.length - 1 - i]!) {
      mScore = config.valueThresholds.length + 1 - i;
      break;
    }
  }

  return { r: rScore, f: fScore, m: mScore, segment: `${rScore}${fScore}${mScore}` };
}

// --- Hierarchical Segments ---

export interface SegmentHierarchyNode {
  readonly segmentName: string;
  readonly condition: (lead: Lead, score: number, events: readonly DomainEvent[]) => boolean;
  readonly children?: readonly SegmentHierarchyNode[];
}

export function assignHierarchicalSegment(lead: Lead, score: number, events: readonly DomainEvent[], root: SegmentHierarchyNode): string[] {
  const path: string[] = [];
  
  function traverse(node: SegmentHierarchyNode) {
    if (node.condition(lead, score, events)) {
      path.push(node.segmentName);
      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
  }
  
  traverse(root);
  return path;
}

// --- Micro-Segmentation & Decision Trees ---

export interface DecisionTreeNode {
  readonly feature: string;
  readonly operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "contains";
  readonly threshold: string | number | boolean | readonly (string | number)[];
  readonly trueBranch?: DecisionTreeNode;
  readonly falseBranch?: DecisionTreeNode;
  readonly leafSegment?: string;
}

export function evaluateDecisionTree(lead: Lead, score: number, events: readonly DomainEvent[], tree: DecisionTreeNode): string {
  const features: Record<string, any> = {
    ...lead.attributes,
    score,
    eventCount: events.length,
    lifecycle: lead.lifecycle
  };
  
  let current: DecisionTreeNode | undefined = tree;
  
  while (current) {
    if (current.leafSegment) return current.leafSegment;
    
    const val: any = features[current.feature];
    let evalResult = false;
    
    if (val !== undefined) {
      switch (current.operator) {
        case "==": evalResult = val === current.threshold; break;
        case "!=": evalResult = val !== current.threshold; break;
        case ">": evalResult = typeof val === 'number' && typeof current.threshold === 'number' && val > current.threshold; break;
        case "<": evalResult = typeof val === 'number' && typeof current.threshold === 'number' && val < current.threshold; break;
        case ">=": evalResult = typeof val === 'number' && typeof current.threshold === 'number' && val >= current.threshold; break;
        case "<=": evalResult = typeof val === 'number' && typeof current.threshold === 'number' && val <= current.threshold; break;
        case "in": evalResult = Array.isArray(current.threshold) && current.threshold.includes(val as any); break;
        case "contains": evalResult = typeof val === 'string' && typeof current.threshold === 'string' && val.includes(current.threshold); break;
      }
    }
    
    current = evalResult ? current.trueBranch : current.falseBranch;
  }
  
  return "unsegmented";
}

// --- Geographic Segmentation ---

export interface GeoRegionDef {
  readonly id: string;
  readonly countries: readonly string[];
  readonly statesOrProvinces?: readonly string[];
  readonly timezones?: readonly string[];
}

export function assignGeoSegment(lead: Lead, regions: readonly GeoRegionDef[]): string[] {
  const assigned: string[] = [];
  const leadCountry = lead.attributes['country'];
  const leadState = lead.attributes['state'];
  const leadTimezone = lead.attributes['timezone'];
  
  for (const region of regions) {
    let match = false;
    
    if (leadCountry && region.countries.includes(String(leadCountry))) {
      match = true;
      if (region.statesOrProvinces && leadState && !region.statesOrProvinces.includes(String(leadState))) {
        match = false;
      }
      if (region.timezones && leadTimezone && !region.timezones.includes(String(leadTimezone))) {
        match = false;
      }
    }
    
    if (match) assigned.push(region.id);
  }
  
  return assigned;
}

// --- Demographic/Firmographic Segmentation ---

export interface FirmographicDef {
  readonly id: string;
  readonly minEmployees?: number;
  readonly maxEmployees?: number;
  readonly minRevenue?: number;
  readonly maxRevenue?: number;
  readonly industries?: readonly string[];
}

export function assignFirmographicSegment(lead: Lead, segments: readonly FirmographicDef[]): string[] {
  const assigned: string[] = [];
  const employees = Number(lead.attributes['employees'] ?? 0);
  const revenue = Number(lead.attributes['revenue'] ?? 0);
  const industry = String(lead.attributes['industry'] ?? '');
  
  for (const seg of segments) {
    let match = true;
    
    if (seg.minEmployees !== undefined && employees < seg.minEmployees) match = false;
    if (seg.maxEmployees !== undefined && employees > seg.maxEmployees) match = false;
    if (seg.minRevenue !== undefined && revenue < seg.minRevenue) match = false;
    if (seg.maxRevenue !== undefined && revenue > seg.maxRevenue) match = false;
    if (seg.industries !== undefined && industry && !seg.industries.includes(industry)) match = false;
    
    if (match) assigned.push(seg.id);
  }
  
  return assigned;
}

// --- Technographic Segmentation ---

export interface TechnographicDef {
  readonly id: string;
  readonly requiredTechStack: readonly string[];
  readonly excludeTechStack?: readonly string[];
}

export function assignTechnographicSegment(lead: Lead, segments: readonly TechnographicDef[]): string[] {
  const assigned: string[] = [];
  const leadTech = Array.isArray(lead.attributes['tech_stack']) ? lead.attributes['tech_stack'] as string[] : [];
  
  if (leadTech.length === 0) return assigned;
  
  for (const seg of segments) {
    let match = true;
    for (const req of seg.requiredTechStack) {
      if (!leadTech.includes(req)) {
        match = false;
        break;
      }
    }
    
    if (match && seg.excludeTechStack) {
      for (const excl of seg.excludeTechStack) {
        if (leadTech.includes(excl)) {
          match = false;
          break;
        }
      }
    }
    
    if (match) assigned.push(seg.id);
  }
  
  return assigned;
}

// --- Predictive Segment Migration (Markov Chain Mock) ---

export interface SegmentTransitionMatrix {
  readonly segments: readonly string[];
  readonly probabilities: Readonly<Record<string, Readonly<Record<string, number>>>>; // from -> to -> prob
}

export interface SegmentForecast {
  readonly leadId: string;
  readonly currentSegment: string;
  readonly predictedNextSegment: string;
  readonly probability: number;
  readonly expectedDaysToTransition: number;
}

export function forecastSegmentMigration(
  leadId: string,
  currentSegment: string,
  matrix: SegmentTransitionMatrix
): SegmentForecast {
  
  const transitionsFromCurrent = matrix.probabilities[currentSegment];
  
  if (!transitionsFromCurrent) {
    return {
      leadId,
      currentSegment,
      predictedNextSegment: currentSegment,
      probability: 1.0,
      expectedDaysToTransition: Infinity
    };
  }
  
  let maxProb = 0;
  let nextSegment = currentSegment;
  
  for (const [toSegment, prob] of Object.entries(transitionsFromCurrent)) {
    if (toSegment !== currentSegment && prob > maxProb) {
      maxProb = prob;
      nextSegment = toSegment;
    }
  }
  
  // Mock expected days based on probability (higher prob = faster transition)
  const expectedDaysToTransition = maxProb > 0 ? Math.max(1, 30 * (1 - maxProb)) : Infinity;
  
  return {
    leadId,
    currentSegment,
    predictedNextSegment: nextSegment,
    probability: maxProb,
    expectedDaysToTransition
  };
}

// --- Dynamic Segmentation Rule Generator ---

export interface SegmentationRuleTemplate {
  readonly templateId: string;
  readonly basePriority: number;
  readonly generate: (params: Record<string, string | number>) => AdvancedSegmentRule;
}

export const defaultRuleTemplates: Record<string, SegmentationRuleTemplate> = {
  "high_value_geo": {
    templateId: "high_value_geo",
    basePriority: 100,
    generate: (params) => ({
      id: `rule_geo_${params['country']}`,
      name: `High Value ${params['country']}`,
      priority: 100,
      minimumScore: Number(params['min_score'] ?? 50),
      requiredAttributes: { country: String(params['country']) }
    })
  },
  "active_users": {
    templateId: "active_users",
    basePriority: 50,
    generate: (params) => ({
      id: `rule_active_${params['event_type']}`,
      name: `Active: ${params['event_type']}`,
      priority: 50,
      requiredEventTypes: [String(params['event_type'])]
    })
  }
};

export function generateDynamicPolicy(
  _policyId: string,
  fallbackSegment: string,
  templates: readonly { templateId: string; params: Record<string, string | number> }[]
): AdvancedSegmentPolicy {
  
  const rules = templates.map(t => {
    const template = defaultRuleTemplates[t.templateId];
    if (!template) throw new Error(`Template ${t.templateId} not found`);
    return template.generate(t.params);
  });
  
  return {
    fallback: fallbackSegment,
    rules: rules as any,
    advancedRules: rules
  };
}



// --- K-Dimensional Tree for Segment Nearest Neighbors (Deterministic) ---
// Useful for finding similar leads based on multi-dimensional scores

export interface KDPoint {
  readonly id: string;
  readonly dimensions: readonly number[];
}

export interface KDNode {
  readonly point: KDPoint;
  readonly left?: KDNode;
  readonly right?: KDNode;
  readonly axis: number;
}

export function buildKDTree(points: readonly KDPoint[], depth: number = 0): KDNode | undefined {
  if (points.length === 0) return undefined;
  
  const k = points[0]!.dimensions.length;
  if (k === 0) return undefined;
  
  const axis = depth % k;
  
  // Sort points by the chosen axis
  const sorted = [...points].sort((a, b) => a.dimensions[axis]! - b.dimensions[axis]!);
  
  const medianIdx = Math.floor(sorted.length / 2);
  const medianPoint = sorted[medianIdx]!;
  
  const left = buildKDTree(sorted.slice(0, medianIdx), depth + 1);
  const right = buildKDTree(sorted.slice(medianIdx + 1), depth + 1);
  
  return {
    point: medianPoint,
    axis,
    ...(left !== undefined ? { left } : {}),
    ...(right !== undefined ? { right } : {})
  };
}

export function nearestNeighborKD(root: KDNode | undefined, target: readonly number[]): KDPoint | undefined {
  if (!root) return undefined;
  
  let bestPoint = root.point;
  let bestDist = sqDist(root.point.dimensions, target);
  
  function search(node: KDNode | undefined) {
    if (!node) return;
    
    const d = sqDist(node.point.dimensions, target);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = node.point;
    }
    
    const axis = node.axis;
    const diff = target[axis]! - node.point.dimensions[axis]!;
    
    const first = diff < 0 ? node.left : node.right;
    const second = diff < 0 ? node.right : node.left;
    
    search(first);
    
    if (diff * diff < bestDist) {
      search(second);
    }
  }
  
  search(root);
  return bestPoint;
}

function sqDist(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    sum += diff * diff;
  }
  return sum;
}

// --- Segmentation Overlap Analysis ---

export interface SegmentOverlap {
  readonly segmentA: string;
  readonly segmentB: string;
  readonly overlapCount: number;
  readonly jaccardIndex: number;
}

export function analyzeSegmentOverlap(
  leadSegmentsA: Readonly<Record<string, string>>,
  leadSegmentsB: Readonly<Record<string, string>>
): readonly SegmentOverlap[] {
  
  const mapA = new Map<string, Set<string>>();
  for (const [leadId, seg] of Object.entries(leadSegmentsA)) {
    if (!mapA.has(seg)) mapA.set(seg, new Set());
    mapA.get(seg)!.add(leadId);
  }
  
  const mapB = new Map<string, Set<string>>();
  for (const [leadId, seg] of Object.entries(leadSegmentsB)) {
    if (!mapB.has(seg)) mapB.set(seg, new Set());
    mapB.get(seg)!.add(leadId);
  }
  
  const overlaps: SegmentOverlap[] = [];
  
  for (const [segA, setA] of mapA.entries()) {
    for (const [segB, setB] of mapB.entries()) {
      let intersection = 0;
      for (const id of setA) {
        if (setB.has(id)) intersection++;
      }
      
      const union = setA.size + setB.size - intersection;
      const jaccard = union === 0 ? 0 : intersection / union;
      
      if (intersection > 0) {
        overlaps.push({ segmentA: segA, segmentB: segB, overlapCount: intersection, jaccardIndex: jaccard });
      }
    }
  }
  
  return overlaps.sort((a, b) => b.jaccardIndex - a.jaccardIndex);
}

// --- Cohort Similarity Index ---

export function computeCohortSimilarity(cohortAIds: readonly string[], cohortBIds: readonly string[]): number {
  const setA = new Set(cohortAIds);
  const setB = new Set(cohortBIds);
  let intersection = 0;
  for (const id of setA) {
    if (setB.has(id)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
