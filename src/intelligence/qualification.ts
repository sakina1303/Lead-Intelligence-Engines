import type { DomainEvent, Lead, QualificationPolicy, QualificationResult, QualificationState, Timestamp } from "../contracts.js";

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

// --- Qualification State Machines ---

export interface QualificationTransitionDef {
  readonly fromState: string;
  readonly toState: string;
  readonly requiredEvents: readonly string[];
  readonly requiredMinScore?: number;
  readonly requiredMaxScore?: number;
  readonly minTimeInStateMs?: number;
  readonly maxTimeInStateMs?: number;
}

export interface QualificationStateMachine {
  readonly id: string;
  readonly initialState: string;
  readonly transitions: readonly QualificationTransitionDef[];
}

export interface QualificationStateContext {
  readonly leadId: string;
  readonly currentState: string;
  readonly enteredAt: number;
  readonly transitionHistory: readonly { readonly state: string; readonly enteredAt: number }[];
}

export function evaluateStateMachineTransition(
  machine: QualificationStateMachine,
  context: QualificationStateContext,
  score: number,
  events: readonly DomainEvent[],
  evaluatedAt: Timestamp
): { readonly nextState: string; readonly appliedTransition?: QualificationTransitionDef } {
  
  const timeInStateMs = evaluatedAt - context.enteredAt;
  const possibleTransitions = machine.transitions.filter(t => t.fromState === context.currentState);
  
  // Sort transitions by complexity or priority (assume array order is priority for now)
  for (const t of possibleTransitions) {
    // 1. Time constraints
    if (t.minTimeInStateMs !== undefined && timeInStateMs < t.minTimeInStateMs) continue;
    if (t.maxTimeInStateMs !== undefined && timeInStateMs > t.maxTimeInStateMs) continue;
    
    // 2. Score constraints
    if (t.requiredMinScore !== undefined && score < t.requiredMinScore) continue;
    if (t.requiredMaxScore !== undefined && score > t.requiredMaxScore) continue;
    
    // 3. Event constraints
    let hasAllEvents = true;
    for (const reqEvent of t.requiredEvents) {
      if (!events.find(e => e.type === reqEvent && e.occurredAt >= context.enteredAt)) {
        hasAllEvents = false;
        break;
      }
    }
    
    if (hasAllEvents) {
      return { nextState: t.toState, appliedTransition: t };
    }
  }
  
  return { nextState: context.currentState };
}

// --- Qualification SLA Monitoring ---

export interface QualificationSLADef {
  readonly stateToMonitor: string;
  readonly targetActionState: string;
  readonly slaBreachMs: number;
}

export interface SLABreachResult {
  readonly breached: boolean;
  readonly timeInStateMs: number;
  readonly excessMs: number;
}

export function evaluateQualificationSLA(context: QualificationStateContext, sla: QualificationSLADef, evaluatedAt: Timestamp): SLABreachResult {
  if (context.currentState !== sla.stateToMonitor) {
    return { breached: false, timeInStateMs: 0, excessMs: 0 };
  }
  
  const timeInState = evaluatedAt - context.enteredAt;
  const excess = timeInState - sla.slaBreachMs;
  
  return {
    breached: excess > 0,
    timeInStateMs: timeInState,
    excessMs: Math.max(0, excess)
  };
}

// --- Hysteresis and Cooldown Management ---

export interface HysteresisConfig {
  readonly qualificationThreshold: number;
  readonly disqualificationThreshold: number;
  readonly cooldownMs: number;
}

export interface HysteresisContext {
  readonly lastQualificationChangeAt: number;
  readonly isCurrentlyQualified: boolean;
}

export function evaluateHysteresisQualification(
  score: number,
  config: HysteresisConfig,
  context: HysteresisContext,
  evaluatedAt: Timestamp
): { readonly isQualified: boolean; readonly changed: boolean } {
  
  const timeSinceLastChange = evaluatedAt - context.lastQualificationChangeAt;
  if (timeSinceLastChange < config.cooldownMs) {
    // In cooldown, cannot change state
    return { isQualified: context.isCurrentlyQualified, changed: false };
  }
  
  if (context.isCurrentlyQualified) {
    // Check if we drop below disqualification threshold
    if (score < config.disqualificationThreshold) {
      return { isQualified: false, changed: true };
    }
    return { isQualified: true, changed: false };
  } else {
    // Check if we rise above qualification threshold
    if (score >= config.qualificationThreshold) {
      return { isQualified: true, changed: true };
    }
    return { isQualified: false, changed: false };
  }
}

// --- Multi-Step Qualification Funnels ---

export interface FunnelStage {
  readonly name: string;
  readonly order: number;
  readonly policies: readonly QualificationPolicy[];
}

export interface FunnelDef {
  readonly id: string;
  readonly stages: readonly FunnelStage[];
}

export interface FunnelProgress {
  readonly leadId: string;
  readonly highestStageReached: string;
  readonly highestStageOrder: number;
  readonly stageResults: Readonly<Record<string, QualificationResult>>;
  readonly isFullyQualified: boolean;
}

export function evaluateFunnelProgress(lead: Lead, score: number, events: readonly DomainEvent[], funnel: FunnelDef, evaluatedAt: Timestamp): FunnelProgress {
  const sortedStages = [...funnel.stages].sort((a, b) => a.order - b.order);
  
  let highestReached = "none";
  let highestOrder = -1;
  const stageResults: Record<string, QualificationResult> = {};
  
  for (const stage of sortedStages) {
    let stageQualified = false;
    let bestResult: QualificationResult | undefined = undefined;
    
    for (const policy of stage.policies) {
      const res = evaluateQualification(lead, score, events, policy, evaluatedAt);
      if (res.state !== "unqualified") {
        stageQualified = true;
        bestResult = res;
        break;
      }
      bestResult = res; // keep the last failure reason if none pass
    }
    
    if (bestResult) {
      stageResults[stage.name] = bestResult;
    }
    
    if (stageQualified) {
      highestReached = stage.name;
      highestOrder = stage.order;
    } else {
      // Funnel breaks here
      break;
    }
  }
  
  return {
    leadId: lead.id,
    highestStageReached: highestReached,
    highestStageOrder: highestOrder,
    stageResults,
    isFullyQualified: highestOrder === sortedStages[sortedStages.length - 1]?.order
  };
}

// --- Qualification Scenario Simulation (What-If) ---

export interface SimulationScenario {
  readonly scoreDelta: number;
  readonly extraEvents: readonly DomainEvent[];
  readonly timeOffsetMs: number;
}

export function simulateQualificationScenario(
  lead: Lead,
  currentScore: number,
  currentEvents: readonly DomainEvent[],
  policy: QualificationPolicy,
  currentTimestamp: Timestamp,
  scenario: SimulationScenario
): QualificationResult {
  
  const simulatedScore = currentScore + scenario.scoreDelta;
  const simulatedEvents = [...currentEvents, ...scenario.extraEvents].sort((a, b) => a.occurredAt - b.occurredAt);
  const simulatedTime = currentTimestamp + scenario.timeOffsetMs;
  
  return evaluateQualification(lead, simulatedScore, simulatedEvents, policy, simulatedTime);
}

export function batchSimulateScenarios(
  lead: Lead,
  currentScore: number,
  currentEvents: readonly DomainEvent[],
  policy: QualificationPolicy,
  currentTimestamp: Timestamp,
  scenarios: readonly SimulationScenario[]
): readonly QualificationResult[] {
  return scenarios.map(scenario => simulateQualificationScenario(lead, currentScore, currentEvents, policy, currentTimestamp, scenario));
}

// --- Qualification Cohort Grouping ---

export interface CohortDef {
  readonly id: string;
  readonly name: string;
  readonly basePolicy: QualificationPolicy;
  readonly attributeFilters?: Readonly<Record<string, string | number | boolean>>;
}

export interface CohortResult {
  readonly cohortId: string;
  readonly qualifiedCount: number;
  readonly totalEvaluated: number;
  readonly passRate: number;
  readonly qualifiedLeadIds: readonly string[];
}

export function analyzeQualificationCohorts(
  leads: readonly Lead[],
  scores: Readonly<Record<string, number>>,
  eventsByLead: Readonly<Record<string, readonly DomainEvent[]>>,
  cohorts: readonly CohortDef[],
  evaluatedAt: Timestamp
): readonly CohortResult[] {
  
  const results: CohortResult[] = [];
  
  for (const cohort of cohorts) {
    let total = 0;
    const qualifiedIds: string[] = [];
    
    for (const lead of leads) {
      // Check filters
      let matchFilter = true;
      if (cohort.attributeFilters) {
        for (const [k, v] of Object.entries(cohort.attributeFilters)) {
          if (lead.attributes[k] !== v) {
            matchFilter = false;
            break;
          }
        }
      }
      
      if (!matchFilter) continue;
      
      total++;
      const score = scores[lead.id] ?? 0;
      const events = eventsByLead[lead.id] ?? [];
      
      const res = evaluateQualification(lead, score, events, cohort.basePolicy, evaluatedAt);
      if (res.state !== "unqualified") {
        qualifiedIds.push(lead.id);
      }
    }
    
    results.push({
      cohortId: cohort.id,
      totalEvaluated: total,
      qualifiedCount: qualifiedIds.length,
      passRate: total === 0 ? 0 : qualifiedIds.length / total,
      qualifiedLeadIds: qualifiedIds.sort()
    });
  }
  
  return results.sort((a, b) => b.passRate - a.passRate || a.cohortId.localeCompare(b.cohortId));
}

// --- Complex Qualification Dependencies ---

export interface QualificationDependencyGraph {
  readonly policyId: string;
  readonly dependsOnPolicyIds: readonly string[];
  readonly condition: "ALL" | "ANY" | "NONE";
}

export function evaluateDependentQualification(
  lead: Lead,
  score: number,
  events: readonly DomainEvent[],
  policy: QualificationPolicy,
  dependencies: QualificationDependencyGraph,
  priorResults: Readonly<Record<string, QualificationResult>>,
  evaluatedAt: Timestamp
): QualificationResult {
  
  let depsMet = false;
  
  if (dependencies.dependsOnPolicyIds.length === 0) {
    depsMet = true;
  } else {
    const depStates = dependencies.dependsOnPolicyIds.map(id => {
      const res = priorResults[id];
      return res ? res.state !== "unqualified" : false;
    });
    
    switch (dependencies.condition) {
      case "ALL":
        depsMet = depStates.every(s => s);
        break;
      case "ANY":
        depsMet = depStates.some(s => s);
        break;
      case "NONE":
        depsMet = depStates.every(s => !s);
        break;
    }
  }
  
  if (!depsMet) {
    return {
      leadId: lead.id,
      policyId: policy.id,
      state: "unqualified",
      evaluatedAt,
      reasons: [`Dependencies not met (Condition: ${dependencies.condition})`]
    };
  }
  
  return evaluateQualification(lead, score, events, policy, evaluatedAt);
}

// --- Qualification Matrix Evaluation ---

export interface MatrixDimensionDef {
  readonly id: string;
  readonly attribute: string; // From lead attributes
  readonly scoreWeights: Readonly<Record<string, number>>; // attribute value -> weight
}

export interface QualificationMatrix {
  readonly id: string;
  readonly dimensions: readonly MatrixDimensionDef[];
  readonly requiredMatrixScore: number;
}

export function evaluateQualificationMatrix(
  lead: Lead,
  matrix: QualificationMatrix
): { readonly isQualified: boolean; readonly matrixScore: number; readonly missingAttributes: readonly string[] } {
  let score = 0;
  const missing: string[] = [];
  
  for (const dim of matrix.dimensions) {
    const val = lead.attributes[dim.attribute];
    if (val === undefined || val === null) {
      missing.push(dim.attribute);
    } else {
      const weight = dim.scoreWeights[String(val)] ?? 0;
      score += weight;
    }
  }
  
  return {
    isQualified: score >= matrix.requiredMatrixScore,
    matrixScore: score,
    missingAttributes: missing
  };
}

// --- Capacity-Aware Qualification Routing ---

export interface QualificationCapacityNode {
  readonly state: QualificationState;
  readonly maxCapacity: number;
  readonly currentLoad: number;
  readonly overflowState?: QualificationState;
}

export function applyCapacityRouting(
  initialResult: QualificationResult,
  capacities: readonly QualificationCapacityNode[]
): { readonly finalResult: QualificationResult; readonly overflowTriggered: boolean; readonly originalState: string } {
  const originalState = initialResult.state;
  let currentState = originalState;
  let overflowTriggered = false;
  
  // Follow overflow chain
  let iters = 0;
  while (iters < 10) { // arbitrary limit to prevent infinite loops
    const node = capacities.find(c => c.state === currentState);
    if (!node) break;
    
    if (node.currentLoad >= node.maxCapacity) {
      if (node.overflowState) {
        currentState = node.overflowState;
        overflowTriggered = true;
      } else {
        // If no overflow defined but at capacity, fail qualification
        currentState = "unqualified";
        overflowTriggered = true;
        break;
      }
    } else {
      // Capacity available
      break;
    }
    iters++;
  }
  
  return {
    finalResult: {
      ...initialResult,
      state: currentState,
      reasons: overflowTriggered 
        ? [...initialResult.reasons, `Capacity overflowed from ${originalState}`] 
        : initialResult.reasons
    },
    overflowTriggered,
    originalState
  };
}

// --- Qualification Degradation Modeling ---

export interface DegradationModel {
  readonly state: string;
  readonly halflifeMs: number;
  readonly minScoreToRetainState: number;
}

export function evaluateQualificationDegradation(
  currentScore: number,
  timeSinceLastEventMs: number,
  context: QualificationStateContext,
  model: DegradationModel
): { readonly retained: boolean; readonly degradedScore: number } {
  
  if (context.currentState !== model.state) {
    return { retained: true, degradedScore: currentScore };
  }
  
  const degradedScore = currentScore * Math.pow(0.5, timeSinceLastEventMs / model.halflifeMs);
  
  return {
    retained: degradedScore >= model.minScoreToRetainState,
    degradedScore
  };
}

// --- Heuristic Qualification Prediction ---

export interface QualificationHeuristics {
  readonly highIntentEventTypes: readonly string[];
  readonly velocityThresholdEventsPerDay: number;
  readonly targetLifecycleStages: readonly string[];
}

export interface PredictionResult {
  readonly probability: number; // 0.0 to 1.0
  readonly confidence: number;  // 0.0 to 1.0
  readonly keyFactors: readonly string[];
}

export function predictFutureQualification(
  lead: Lead,
  events: readonly DomainEvent[],
  heuristics: QualificationHeuristics,
  evaluatedAt: Timestamp
): PredictionResult {
  let p = 0.1; // base probability
  let c = 0.5; // base confidence (low without data)
  const factors: string[] = [];
  
  if (events.length === 0) {
    return { probability: p, confidence: 0.1, keyFactors: ["No events"] };
  }
  
  // 1. High intent events
  const intentEvents = events.filter(e => heuristics.highIntentEventTypes.includes(e.type));
  if (intentEvents.length > 0) {
    p += 0.3 * Math.min(1, intentEvents.length / 3);
    c += 0.2;
    factors.push(`Found ${intentEvents.length} high-intent events`);
  }
  
  // 2. Velocity
  const firstEventTime = Math.min(...events.map(e => e.occurredAt));
  const timeSpanDays = Math.max(0.1, (evaluatedAt - firstEventTime) / (1000 * 60 * 60 * 24));
  const velocity = events.length / timeSpanDays;
  
  if (velocity >= heuristics.velocityThresholdEventsPerDay) {
    p += 0.2;
    c += 0.1;
    factors.push(`High velocity: ${velocity.toFixed(1)} events/day`);
  } else if (velocity < heuristics.velocityThresholdEventsPerDay * 0.1) {
    p -= 0.1;
    factors.push(`Low velocity: ${velocity.toFixed(1)} events/day`);
  }
  
  // 3. Lifecycle mapping
  if (heuristics.targetLifecycleStages.includes(lead.lifecycle)) {
    p += 0.2;
    c += 0.1;
    factors.push(`Target lifecycle: ${lead.lifecycle}`);
  }
  
  // 4. Attribute completeness
  const attrKeys = Object.keys(lead.attributes);
  if (attrKeys.length > 5) {
    p += 0.1;
    c += 0.1;
  }
  
  return {
    probability: Math.max(0, Math.min(1, p)),
    confidence: Math.max(0, Math.min(1, c)),
    keyFactors: factors
  };
}

// --- Qualification Confidence Scoring ---

export interface ConfidenceMetrics {
  readonly dataCompletenessScore: number;
  readonly eventDiversityScore: number;
  readonly scoreStabilityScore: number;
  readonly overallConfidence: number; // 0-100
}

export function computeQualificationConfidence(
  lead: Lead,
  events: readonly DomainEvent[],
  scoreHistory: readonly number[]
): ConfidenceMetrics {
  
  // 1. Completeness
  const expectedKeys = ['email', 'company', 'role', 'industry', 'country'];
  let foundKeys = 0;
  for (const k of expectedKeys) {
    if (lead.attributes[k]) foundKeys++;
  }
  const dataCompletenessScore = (foundKeys / expectedKeys.length) * 100;
  
  // 2. Diversity
  const categories = new Set(events.map(e => e.category));
  const eventDiversityScore = Math.min(100, (categories.size / 4) * 100);
  
  // 3. Stability
  let scoreStabilityScore = 100;
  if (scoreHistory.length > 2) {
    const recent = scoreHistory.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    let variance = 0;
    for (const s of recent) variance += Math.pow(s - mean, 2);
    variance /= recent.length;
    
    // higher variance = lower stability
    const penalty = Math.min(100, variance / 10); 
    scoreStabilityScore = Math.max(0, 100 - penalty);
  }
  
  const overallConfidence = (dataCompletenessScore * 0.4) + (eventDiversityScore * 0.4) + (scoreStabilityScore * 0.2);
  
  return {
    dataCompletenessScore,
    eventDiversityScore,
    scoreStabilityScore,
    overallConfidence
  };
}

// --- Multi-Dimensional SLAs ---

export interface SLADimension {
  readonly id: string;
  readonly maxDurationMs: number;
  readonly triggersAlert: boolean;
}

export interface MultiDimensionalSLA {
  readonly stateId: string;
  readonly dimensions: readonly SLADimension[];
}

export interface SLADimensionResult {
  readonly dimensionId: string;
  readonly isBreached: boolean;
  readonly remainingMs: number;
}

export function evaluateMultiDimensionalSLA(
  context: QualificationStateContext,
  sla: MultiDimensionalSLA,
  evaluatedAt: Timestamp
): { readonly breachedCount: number; readonly results: readonly SLADimensionResult[] } {
  
  if (context.currentState !== sla.stateId) {
    return { breachedCount: 0, results: sla.dimensions.map(d => ({ dimensionId: d.id, isBreached: false, remainingMs: d.maxDurationMs })) };
  }
  
  const duration = evaluatedAt - context.enteredAt;
  const results: SLADimensionResult[] = [];
  let breachedCount = 0;
  
  for (const dim of sla.dimensions) {
    const remaining = dim.maxDurationMs - duration;
    const isBreached = remaining < 0;
    
    if (isBreached) breachedCount++;
    
    results.push({
      dimensionId: dim.id,
      isBreached,
      remainingMs: Math.max(0, remaining)
    });
  }
  
  return { breachedCount, results };
}
