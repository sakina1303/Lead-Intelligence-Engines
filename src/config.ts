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
