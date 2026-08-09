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

