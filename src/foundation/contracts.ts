// Shared immutable contracts used by every domain subsystem.
export type LeadId = string;
export type EventId = string;
export type RuleId = string;
export type Timestamp = number;

export type LifecycleState = "new" | "contacted" | "nurturing" | "qualified" | "converted" | "rejected";
export type QualificationState = "unqualified" | "marketing-qualified" | "sales-qualified" | "disqualified";
export type EventCategory = "engagement" | "intent" | "profile" | "commercial" | "support" | "custom";
export type ConflictMode = "stack" | "highest-priority" | "first-match";

export type Scalar = string | number | boolean;
export type Attributes = Readonly<Record<string, Scalar>>;

export interface Lead {
  readonly id: LeadId;
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly attributes: Attributes;
  readonly lifecycle: LifecycleState;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export type LeadChangeKind = "created" | "attributes-updated" | "lifecycle-transitioned" | "ownership-assigned" | "consent-updated" | "profile-merged";

export interface LeadChange {
  readonly id: string;
  readonly leadId: LeadId;
  readonly kind: LeadChangeKind;
  readonly occurredAt: Timestamp;
  readonly sequence: number;
  readonly previous: Readonly<Record<string, Scalar | LifecycleState | undefined>>;
  readonly next: Readonly<Record<string, Scalar | LifecycleState | undefined>>;
  readonly reason: string;
}

export interface LeadOwnership {
  readonly ownerId: string;
  readonly territory: string;
  readonly assignedAt: Timestamp;
}

export interface ConsentState {
  readonly email: "unknown" | "granted" | "revoked";
  readonly phone: "unknown" | "granted" | "revoked";
  readonly updatedAt: Timestamp;
}

export interface LeadProfile {
  readonly leadId: LeadId;
  readonly ownership?: LeadOwnership;
  readonly consent: ConsentState;
  readonly source?: string;
  readonly tags: readonly string[];
}

export interface CreateLeadInput {
  readonly id: LeadId;
  readonly name: string;
  readonly email: string;
  readonly company?: string;
  readonly attributes?: Attributes;
  readonly lifecycle?: LifecycleState;
  readonly createdAt: Timestamp;
}

export interface DomainEvent {
  readonly id: EventId;
  readonly leadId: LeadId;
  readonly type: string;
  readonly category: EventCategory;
  readonly occurredAt: Timestamp;
  readonly sequence: number;
  readonly attributes: Attributes;
}

export interface CreateEventInput extends DomainEvent {}

export interface AttributeCondition {
  readonly key: string;
  readonly equals?: Scalar;
  readonly exists?: boolean;
}

export interface EventCondition {
  readonly eventType?: string;
  readonly category?: EventCategory;
  readonly attributes?: readonly AttributeCondition[];
  readonly leadAttributes?: readonly AttributeCondition[];
  readonly lifecycle?: readonly LifecycleState[];
}

export type NumericOperator = "equals" | "greater-than" | "greater-than-or-equal" | "less-than" | "less-than-or-equal";

export type RuleExpression =
  | { readonly kind: "all"; readonly expressions: readonly RuleExpression[] }
  | { readonly kind: "any"; readonly expressions: readonly RuleExpression[] }
  | { readonly kind: "not"; readonly expression: RuleExpression }
  | { readonly kind: "event-condition"; readonly condition: EventCondition }
  | { readonly kind: "lead-attribute"; readonly condition: AttributeCondition }
  | { readonly kind: "event-attribute"; readonly condition: AttributeCondition }
  | { readonly kind: "score"; readonly operator: NumericOperator; readonly value: number }
  | { readonly kind: "event-count"; readonly eventType?: string; readonly category?: EventCategory; readonly operator: NumericOperator; readonly value: number };

export interface RuleEvaluationContext {
  readonly lead: Lead;
  readonly event: DomainEvent;
  readonly score: number;
  readonly eventHistory: readonly DomainEvent[];
}

export interface ScoringRule {
  readonly id: RuleId;
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly delta: number;
  readonly dimensionDeltas?: Readonly<Record<string, number>>;
  readonly condition: EventCondition;
  readonly expression?: RuleExpression;
  readonly stopProcessing?: boolean;
}

export interface ScorePolicy {
  readonly cap: number;
  readonly floor: number;
  readonly conflictMode: ConflictMode;
  readonly dimensions?: readonly ScoreDimension[];
}

export interface ScoreDimension {
  readonly id: string;
  readonly label: string;
  readonly floor: number;
  readonly cap: number;
}

export interface ScoreProjection {
  readonly leadId: LeadId;
  readonly total: number;
  readonly dimensions: Readonly<Record<string, number>>;
  readonly updatedAt: Timestamp;
}

export interface ScoreExplanation {
  readonly eventId: EventId;
  readonly leadId: LeadId;
  readonly occurredAt: Timestamp;
  readonly previousScore: number;
  readonly nextScore: number;
  readonly requestedDelta: number;
  readonly appliedDelta: number;
  readonly ruleIds: readonly RuleId[];
  readonly reason: "scored" | "no-match" | "duplicate";
}

export interface QualificationPolicy {
  readonly id: string;
  readonly minimumScore: number;
  readonly minimumEvents?: number;
  readonly requiredEventTypes?: readonly string[];
  readonly allowedLifecycles?: readonly LifecycleState[];
  readonly qualification: Exclude<QualificationState, "unqualified">;
}

export interface QualificationResult {
  readonly leadId: LeadId;
  readonly policyId: string;
  readonly state: QualificationState;
  readonly evaluatedAt: Timestamp;
  readonly reasons: readonly string[];
}

export interface SegmentRule {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly minimumScore?: number;
  readonly maximumScore?: number;
  readonly qualificationStates?: readonly QualificationState[];
  readonly requiredAttributes?: readonly AttributeCondition[];
  readonly requiredEventTypes?: readonly string[];
}

export interface SegmentPolicy {
  readonly rules: readonly SegmentRule[];
  readonly fallback: string;
}

export interface SegmentResult {
  readonly leadId: LeadId;
  readonly segment: string;
  readonly matchedRuleId?: string;
}

export interface RankEntry {
  readonly leadId: LeadId;
  readonly rank: number;
  readonly score: number;
  readonly qualification: QualificationState;
}

export interface AnalyticsSummary {
  readonly leadCount: number;
  readonly eventCount: number;
  readonly totalScore: number;
  readonly averageScore: number;
  readonly scoresByLifecycle: Readonly<Record<LifecycleState, number>>;
  readonly leadsByQualification: Readonly<Record<QualificationState, number>>;
  readonly leadsBySegment: Readonly<Record<string, number>>;
  readonly eventsByCategory: Readonly<Record<EventCategory, number>>;
  readonly eventsByType: Readonly<Record<string, number>>;
}

export interface EngineConfig {
  readonly scorePolicy: ScorePolicy;
  readonly qualificationPolicies: readonly QualificationPolicy[];
  readonly segmentPolicy: SegmentPolicy;
}

export interface EngineState {
  readonly config: EngineConfig;
  readonly leads: Readonly<Record<LeadId, Lead>>;
  readonly events: Readonly<Record<EventId, DomainEvent>>;
  readonly eventIdsByLead: Readonly<Record<LeadId, readonly EventId[]>>;
  readonly scores: Readonly<Record<LeadId, number>>;
  readonly scoreHistory: Readonly<Record<LeadId, readonly ScoreExplanation[]>>;
  readonly scoreProjections: Readonly<Record<LeadId, ScoreProjection>>;
  readonly qualifications: Readonly<Record<LeadId, QualificationResult>>;
  readonly segments: Readonly<Record<LeadId, SegmentResult>>;
  readonly profiles: Readonly<Record<LeadId, LeadProfile>>;
  readonly leadHistory: Readonly<Record<LeadId, readonly LeadChange[]>>;
}

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] };

export interface EventProcessResult {
  readonly state: EngineState;
  readonly outcome: "accepted" | "duplicate" | "rejected";
  readonly event?: DomainEvent;
  readonly explanation?: ScoreExplanation;
  readonly qualification?: QualificationResult;
  readonly segment?: SegmentResult;
  readonly errors?: readonly string[];
}

// --- Attribution ---

export type AttributionModelType = "first-touch" | "last-touch" | "linear" | "time-decay" | "position-based" | "w-shaped";

export interface TouchPoint {
  readonly eventId: EventId;
  readonly leadId: LeadId;
  readonly channel: string;
  readonly category: EventCategory;
  readonly occurredAt: Timestamp;
  readonly isConversion: boolean;
}

export interface AttributionWeight {
  readonly touchPointEventId: EventId;
  readonly weight: number;
  readonly normalizedWeight: number;
  readonly position: number;
  readonly totalTouchPoints: number;
}

export interface AttributionResult {
  readonly leadId: LeadId;
  readonly model: AttributionModelType;
  readonly touchPoints: readonly TouchPoint[];
  readonly weights: readonly AttributionWeight[];
  readonly conversionEventId?: EventId;
  readonly totalWeight: number;
}

// --- Cohorts ---

export interface CohortDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly createdAtFrom: Timestamp;
  readonly createdAtTo: Timestamp;
  readonly requiredAttributes?: Attributes;
  readonly requiredLifecycles?: readonly LifecycleState[];
  readonly minimumScore?: number;
  readonly maximumScore?: number;
}

export interface CohortMembership {
  readonly cohortId: string;
  readonly leadId: LeadId;
  readonly joinedAt: Timestamp;
  readonly score: number;
  readonly lifecycle: LifecycleState;
}

export interface CohortMetrics {
  readonly cohortId: string;
  readonly memberCount: number;
  readonly averageScore: number;
  readonly medianScore: number;
  readonly scoreStdDev: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly conversionRate: number;
  readonly averageEventsPerLead: number;
  readonly lifecycleDistribution: Readonly<Record<LifecycleState, number>>;
  readonly qualificationDistribution: Readonly<Record<QualificationState, number>>;
}

export interface CohortComparison {
  readonly cohortA: CohortMetrics;
  readonly cohortB: CohortMetrics;
  readonly scoreDelta: number;
  readonly conversionRateDelta: number;
  readonly eventRateDelta: number;
}

// --- Funnels ---

export interface FunnelDefinition {
  readonly id: string;
  readonly name: string;
  readonly stages: readonly FunnelStageDefinition[];
  readonly conversionWindow: Timestamp;
}

export interface FunnelStageDefinition {
  readonly id: string;
  readonly name: string;
  readonly requiredEventTypes: readonly string[];
  readonly requiredCategories?: readonly EventCategory[];
  readonly minimumScore?: number;
  readonly maximumDwellMs?: Timestamp;
}

export interface FunnelStageResult {
  readonly stageId: string;
  readonly stageName: string;
  readonly enteredAt: Timestamp;
  readonly exitedAt?: Timestamp;
  readonly dwellMs: number;
  readonly matchedEventIds: readonly EventId[];
  readonly completed: boolean;
}

export interface FunnelResult {
  readonly funnelId: string;
  readonly leadId: LeadId;
  readonly stages: readonly FunnelStageResult[];
  readonly completedStages: number;
  readonly totalStages: number;
  readonly convertedAt?: Timestamp;
  readonly totalDwellMs: number;
  readonly dropOffStageId?: string;
}

export interface FunnelAggregation {
  readonly funnelId: string;
  readonly totalLeads: number;
  readonly stageMetrics: readonly FunnelStageAggregation[];
  readonly overallConversionRate: number;
}

export interface FunnelStageAggregation {
  readonly stageId: string;
  readonly enteredCount: number;
  readonly completedCount: number;
  readonly dropOffCount: number;
  readonly conversionRate: number;
  readonly averageDwellMs: number;
  readonly medianDwellMs: number;
}

// --- Routing Policies ---

export interface RoutingPolicy {
  readonly id: string;
  readonly name: string;
  readonly strategy: "round-robin" | "capacity-weighted" | "skill-match" | "territory-priority";
  readonly territories: readonly TerritoryDefinition[];
  readonly capacityConstraints: CapacityConstraint;
  readonly fallbackStrategy: "queue" | "overflow-territory" | "reject";
  readonly overflowTerritoryId?: string;
}

export interface TerritoryDefinition {
  readonly id: string;
  readonly name: string;
  readonly requiredAttributes: readonly AttributeCondition[];
  readonly priority: number;
  readonly maxLeads: number;
  readonly requiredSkills?: readonly string[];
}

export interface CapacityConstraint {
  readonly maxLeadsPerRep: number;
  readonly maxLeadsPerTerritory: number;
  readonly reserveCapacityPercent: number;
}

export interface RoutingDecision {
  readonly leadId: LeadId;
  readonly policyId: string;
  readonly matchedTerritoryId?: string;
  readonly assignedRepId?: string;
  readonly strategy: RoutingPolicy["strategy"];
  readonly evaluatedAt: Timestamp;
  readonly reasons: readonly string[];
  readonly fallbackUsed: boolean;
  readonly capacityRemaining: number;
}

// --- Simulation ---

export interface SimulationConfig {
  readonly id: string;
  readonly name: string;
  readonly baseRules: readonly ScoringRule[];
  readonly variantRules: readonly ScoringRule[];
  readonly targetLeadIds?: readonly LeadId[];
  readonly evaluateAt: Timestamp;
  readonly includeDecay?: boolean;
}

export interface SimulationLeadResult {
  readonly leadId: LeadId;
  readonly baseScore: number;
  readonly variantScore: number;
  readonly scoreDelta: number;
  readonly baseQualification: QualificationState;
  readonly variantQualification: QualificationState;
  readonly qualificationChanged: boolean;
  readonly baseRuleMatches: readonly RuleId[];
  readonly variantRuleMatches: readonly RuleId[];
  readonly newlyMatched: readonly RuleId[];
  readonly droppedMatches: readonly RuleId[];
}

export interface SimulationResult {
  readonly configId: string;
  readonly leadResults: readonly SimulationLeadResult[];
  readonly totalLeadsAffected: number;
  readonly averageScoreDelta: number;
  readonly qualificationChanges: number;
  readonly scoreDistributionBefore: ScoreDistribution;
  readonly scoreDistributionAfter: ScoreDistribution;
}

export interface ScoreDistribution {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly standardDeviation: number;
  readonly percentiles: Readonly<Record<string, number>>;
}

// --- State Auditing ---

export type InvariantKind =
  | "orphaned-event"
  | "orphaned-score"
  | "missing-lead-events-index"
  | "score-history-mismatch"
  | "score-projection-stale"
  | "qualification-stale"
  | "segment-stale"
  | "profile-orphaned"
  | "history-orphaned"
  | "event-order-violation"
  | "duplicate-event-id"
  | "negative-score-below-floor"
  | "score-above-cap";

export interface StateInvariantViolation {
  readonly kind: InvariantKind;
  readonly entityId: string;
  readonly entityType: "lead" | "event" | "score" | "profile" | "history";
  readonly message: string;
  readonly severity: "error" | "warning" | "info";
}

export interface StateAuditResult {
  readonly violations: readonly StateInvariantViolation[];
  readonly auditedLeads: number;
  readonly auditedEvents: number;
  readonly isConsistent: boolean;
  readonly summary: Readonly<Record<InvariantKind, number>>;
}

// --- Trends & Correlation ---

export interface TrendDataPoint {
  readonly timestamp: Timestamp;
  readonly value: number;
  readonly label?: string;
}

export interface TrendAnalysis {
  readonly dataPoints: readonly TrendDataPoint[];
  readonly slope: number;
  readonly intercept: number;
  readonly rSquared: number;
  readonly movingAverages: readonly TrendDataPoint[];
  readonly direction: "increasing" | "decreasing" | "stable";
  readonly inflectionPoints: readonly TrendDataPoint[];
}

export interface CorrelationResult {
  readonly dimensionA: string;
  readonly dimensionB: string;
  readonly coefficient: number;
  readonly sampleSize: number;
  readonly strength: "strong" | "moderate" | "weak" | "none";
}

// --- Lead Comparison ---

export interface LeadFieldDiff {
  readonly field: string;
  readonly valueA: Scalar | undefined;
  readonly valueB: Scalar | undefined;
  readonly changed: boolean;
}

export interface LeadComparisonResult {
  readonly leadIdA: LeadId;
  readonly leadIdB: LeadId;
  readonly fieldDiffs: readonly LeadFieldDiff[];
  readonly attributeDiffs: readonly LeadFieldDiff[];
  readonly scoreDiff: number;
  readonly sameLifecycle: boolean;
  readonly sameSegment: boolean;
  readonly similarityScore: number;
}

// --- Batch Policies ---

export interface BatchPolicy {
  readonly id: string;
  readonly maxBatchSize: number;
  readonly conflictStrategy: "skip" | "overwrite" | "merge" | "error";
  readonly validationMode: "strict" | "lenient" | "skip";
  readonly orderingStrategy: "chronological" | "priority" | "lead-grouped";
  readonly enableRollback: boolean;
  readonly enableProgressTracking: boolean;
}

export interface BatchProgress {
  readonly batchId: string;
  readonly totalItems: number;
  readonly processedItems: number;
  readonly acceptedItems: number;
  readonly rejectedItems: number;
  readonly duplicateItems: number;
  readonly errors: readonly string[];
  readonly isComplete: boolean;
}

export interface BatchSummary {
  readonly batchId: string;
  readonly progress: BatchProgress;
  readonly scoresBefore: Readonly<Record<LeadId, number>>;
  readonly scoresAfter: Readonly<Record<LeadId, number>>;
  readonly qualificationChanges: readonly { readonly leadId: LeadId; readonly from: QualificationState; readonly to: QualificationState }[];
  readonly segmentChanges: readonly { readonly leadId: LeadId; readonly from: string; readonly to: string }[];
}
