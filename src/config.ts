import type { EngineConfig, Outcome, SegmentPolicy } from "./contracts.js";
import { normalizeRules } from "./scoring-rules.js";
import { failure, success, validId } from "./validation.js";

export function validateEngineConfig(config: EngineConfig): Outcome<EngineConfig> {
  const errors: string[] = [];
  if (!Number.isFinite(config.scorePolicy.cap) || !Number.isFinite(config.scorePolicy.floor) || config.scorePolicy.cap < config.scorePolicy.floor) errors.push("score cap must be finite and no lower than the floor");
  const policyIds = new Set<string>();
  for (const policy of config.qualificationPolicies) {
    if (!validId(policy.id)) errors.push("qualification policy id is required");
    if (policyIds.has(policy.id)) errors.push(`duplicate qualification policy '${policy.id}'`);
    if (!Number.isFinite(policy.minimumScore) || (policy.minimumEvents !== undefined && (!Number.isSafeInteger(policy.minimumEvents) || policy.minimumEvents < 0))) errors.push(`invalid qualification policy '${policy.id}'`);
    policyIds.add(policy.id);
  }
  errors.push(...validateSegmentPolicy(config.segmentPolicy));
  return errors.length === 0 ? success(config) : failure(...errors);
}

function validateSegmentPolicy(policy: SegmentPolicy): readonly string[] {
  const ids = new Set<string>();
  const errors: string[] = [];
  if (!validId(policy.fallback)) errors.push("segment fallback is required");
  for (const rule of policy.rules) {
    if (!validId(rule.id) || !validId(rule.name)) errors.push("segment rule id and name are required");
    if (ids.has(rule.id)) errors.push(`duplicate segment rule '${rule.id}'`);
    if (rule.minimumScore !== undefined && rule.maximumScore !== undefined && rule.minimumScore > rule.maximumScore) errors.push(`segment rule '${rule.id}' has inverted score range`);
    ids.add(rule.id);
  }
  return errors;
}

export function validateRuleSet(rules: Parameters<typeof normalizeRules>[0]) { return normalizeRules(rules); }

// --- Config Diffing ---

export interface ConfigDiffReport {
  readonly hasChanges: boolean;
  readonly scorePolicyChanged: boolean;
  readonly addedQualificationPolicies: readonly string[];
  readonly removedQualificationPolicies: readonly string[];
  readonly modifiedQualificationPolicies: readonly string[];
  readonly segmentPolicyChanged: boolean;
  readonly addedSegmentRules: readonly string[];
  readonly removedSegmentRules: readonly string[];
  readonly modifiedSegmentRules: readonly string[];
}

export function compareEngineConfigs(oldConfig: EngineConfig, newConfig: EngineConfig): ConfigDiffReport {
  const scorePolicyChanged = 
    oldConfig.scorePolicy.cap !== newConfig.scorePolicy.cap ||
    oldConfig.scorePolicy.floor !== newConfig.scorePolicy.floor ||
    oldConfig.scorePolicy.conflictMode !== newConfig.scorePolicy.conflictMode;
    
  const oldQual = new Map(oldConfig.qualificationPolicies.map(p => [p.id, p]));
  const newQual = new Map(newConfig.qualificationPolicies.map(p => [p.id, p]));
  
  const addedQual: string[] = [];
  const removedQual: string[] = [];
  const modifiedQual: string[] = [];
  
  for (const id of oldQual.keys()) {
    if (!newQual.has(id)) removedQual.push(id);
    else if (JSON.stringify(oldQual.get(id)) !== JSON.stringify(newQual.get(id))) modifiedQual.push(id);
  }
  for (const id of newQual.keys()) {
    if (!oldQual.has(id)) addedQual.push(id);
  }
  
  const oldSeg = new Map(oldConfig.segmentPolicy.rules.map(r => [r.id, r]));
  const newSeg = new Map(newConfig.segmentPolicy.rules.map(r => [r.id, r]));
  
  const addedSeg: string[] = [];
  const removedSeg: string[] = [];
  const modifiedSeg: string[] = [];
  
  for (const id of oldSeg.keys()) {
    if (!newSeg.has(id)) removedSeg.push(id);
    else if (JSON.stringify(oldSeg.get(id)) !== JSON.stringify(newSeg.get(id))) modifiedSeg.push(id);
  }
  for (const id of newSeg.keys()) {
    if (!oldSeg.has(id)) addedSeg.push(id);
  }
  
  const segmentPolicyChanged = 
    oldConfig.segmentPolicy.fallback !== newConfig.segmentPolicy.fallback ||
    addedSeg.length > 0 || removedSeg.length > 0 || modifiedSeg.length > 0;
    
  return {
    hasChanges: scorePolicyChanged || addedQual.length > 0 || removedQual.length > 0 || modifiedQual.length > 0 || segmentPolicyChanged,
    scorePolicyChanged,
    addedQualificationPolicies: addedQual,
    removedQualificationPolicies: removedQual,
    modifiedQualificationPolicies: modifiedQual,
    segmentPolicyChanged,
    addedSegmentRules: addedSeg,
    removedSegmentRules: removedSeg,
    modifiedSegmentRules: modifiedSeg,
  };
}

// --- Config Merging ---

export function mergeEngineConfigs(base: EngineConfig, override: Partial<EngineConfig>): EngineConfig {
  return {
    scorePolicy: override.scorePolicy ? { ...base.scorePolicy, ...override.scorePolicy } : base.scorePolicy,
    qualificationPolicies: override.qualificationPolicies ?? base.qualificationPolicies,
    segmentPolicy: override.segmentPolicy ?? base.segmentPolicy,
  };
}

// --- Config Migration ---

export function migrateConfigV1ToV2(v1Config: any): Outcome<EngineConfig> {
  try {
    const config = {
      scorePolicy: {
        cap: typeof v1Config?.maxScore === "number" ? v1Config.maxScore : 1000,
        floor: typeof v1Config?.minScore === "number" ? v1Config.minScore : 0,
        conflictMode: "stack" as const,
      },
      qualificationPolicies: [] as import("./contracts.js").QualificationPolicy[],
      segmentPolicy: { fallback: "default", rules: [] as import("./contracts.js").SegmentRule[] },
    };
    
    if (Array.isArray(v1Config?.thresholds)) {
      for (const t of v1Config.thresholds) {
        if (typeof t.name === "string" && typeof t.value === "number") {
          config.qualificationPolicies.push({
            id: `qual-${t.name.toLowerCase().replace(/\s+/g, "-")}`,
            targetState: "qualified",
            minimumScore: t.value,
          });
        }
      }
    }
    
    return validateEngineConfig(config);
  } catch (e) {
    return failure("migration failed due to invalid v1 format");
  }
}

// --- Default Builders ---

export class EngineConfigBuilder {
  private config = {
    scorePolicy: { cap: 1000, floor: 0, conflictMode: "stack" as const },
    qualificationPolicies: [] as import("./contracts.js").QualificationPolicy[],
    segmentPolicy: { fallback: "unsegmented", rules: [] as import("./contracts.js").SegmentRule[] },
  };
  
  public withScoreLimits(floor: number, cap: number): this {
    this.config.scorePolicy = { ...this.config.scorePolicy, floor, cap };
    return this;
  }
  
  public withConflictMode(mode: "stack" | "highest-priority" | "first-match"): this {
    this.config.scorePolicy = { ...this.config.scorePolicy, conflictMode: mode };
    return this;
  }
  
  public addQualificationPolicy(policy: import("./contracts.js").QualificationPolicy): this {
    this.config.qualificationPolicies = [...this.config.qualificationPolicies, policy];
    return this;
  }
  
  public withSegmentFallback(fallback: string): this {
    this.config.segmentPolicy = { ...this.config.segmentPolicy, fallback };
    return this;
  }
  
  public addSegmentRule(rule: import("./contracts.js").SegmentRule): this {
    this.config.segmentPolicy.rules = [...this.config.segmentPolicy.rules, rule];
    return this;
  }
  
  public build(): Outcome<EngineConfig> {
    return validateEngineConfig(this.config);
  }
  
  public buildUnsafe(): EngineConfig {
    const result = this.build();
    if (!result.ok) throw new Error(`Invalid config: ${result.errors.join(", ")}`);
    return result.value;
  }
}
