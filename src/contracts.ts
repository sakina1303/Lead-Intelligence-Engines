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

export interface ScoringRule {
  readonly id: RuleId;
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly delta: number;
  readonly condition: EventCondition;
  readonly stopProcessing?: boolean;
}

export interface ScorePolicy {
  readonly cap: number;
  readonly floor: number;
  readonly conflictMode: ConflictMode;
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
