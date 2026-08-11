import type { Attributes, Outcome, Scalar, Timestamp } from "./contracts.js";

// Stable validation primitives shared by public domain operations.

export function validId(value: string): boolean {
  return value.trim().length > 0;
}

export function validTimestamp(value: Timestamp): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validSequence(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validEmail(value: string): boolean {
  const at = value.indexOf("@");
  return at > 0 && at < value.length - 1 && value.indexOf(".", at) > at + 1;
}

export function validScalar(value: unknown): value is Scalar {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function validateAttributes(attributes: Attributes): readonly string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (!validId(key)) errors.push("attribute keys must be non-empty");
    if (!validScalar(value)) errors.push(`attribute '${key}' must be a scalar`);
  }
  return errors;
}

export function success<T>(value: T): Outcome<T> {
  return { ok: true, value };
}

export function failure<T = never>(...errors: readonly string[]): Outcome<T> {
  return { ok: false, errors };
}

// --- Deep Structural Validators ---

export function validNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function validNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function validPercentage(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function validTimestampRange(from: Timestamp, to: Timestamp): boolean {
  return validTimestamp(from) && validTimestamp(to) && from <= to;
}

export interface ValidationContext {
  readonly path: string;
  readonly errors: string[];
}

function ctx(path: string): ValidationContext {
  return { path, errors: [] };
}

function addError(context: ValidationContext, message: string): void {
  context.errors.push(`${context.path}: ${message}`);
}

function nested(parent: ValidationContext, segment: string): ValidationContext {
  return { path: `${parent.path}.${segment}`, errors: parent.errors };
}

export function validateCohortDefinition(cohort: Readonly<Record<string, unknown>>): readonly string[] {
  const c = ctx("cohort");
  if (!validNonEmptyString(cohort["id"])) addError(c, "id is required");
  if (!validNonEmptyString(cohort["name"])) addError(c, "name is required");
  if (!validNonEmptyString(cohort["description"])) addError(c, "description is required");

  const from = cohort["createdAtFrom"];
  const to = cohort["createdAtTo"];
  if (!validTimestamp(from as number)) addError(c, "createdAtFrom must be a valid timestamp");
  if (!validTimestamp(to as number)) addError(c, "createdAtTo must be a valid timestamp");
  if (typeof from === "number" && typeof to === "number" && from > to) {
    addError(c, "createdAtFrom must not exceed createdAtTo");
  }

  if (cohort["minimumScore"] !== undefined && !validNonNegativeFinite(cohort["minimumScore"])) {
    addError(c, "minimumScore must be a non-negative finite number");
  }
  if (cohort["maximumScore"] !== undefined && !validNonNegativeFinite(cohort["maximumScore"])) {
    addError(c, "maximumScore must be a non-negative finite number");
  }
  if (typeof cohort["minimumScore"] === "number" && typeof cohort["maximumScore"] === "number" && cohort["minimumScore"] > cohort["maximumScore"]) {
    addError(c, "minimumScore must not exceed maximumScore");
  }

  const lifecycles = cohort["requiredLifecycles"];
  if (lifecycles !== undefined) {
    if (!Array.isArray(lifecycles)) addError(c, "requiredLifecycles must be an array");
    else {
      const validValues = new Set(["new", "contacted", "nurturing", "qualified", "converted", "rejected"]);
      for (let i = 0; i < lifecycles.length; i++) {
        if (!validValues.has(lifecycles[i] as string)) addError(nested(c, `requiredLifecycles[${i}]`), `invalid lifecycle state`);
      }
    }
  }

  if (cohort["requiredAttributes"] !== undefined && typeof cohort["requiredAttributes"] === "object" && cohort["requiredAttributes"] !== null) {
    const attrErrors = validateAttributes(cohort["requiredAttributes"] as Attributes);
    for (const err of attrErrors) c.errors.push(`cohort.requiredAttributes: ${err}`);
  }

  return c.errors;
}

export function validateFunnelDefinition(funnel: Readonly<Record<string, unknown>>): readonly string[] {
  const c = ctx("funnel");
  if (!validNonEmptyString(funnel["id"])) addError(c, "id is required");
  if (!validNonEmptyString(funnel["name"])) addError(c, "name is required");
  if (!validTimestamp(funnel["conversionWindow"] as number)) addError(c, "conversionWindow must be a valid timestamp");

  const stages = funnel["stages"];
  if (!Array.isArray(stages)) {
    addError(c, "stages must be an array");
  } else {
    if (stages.length === 0) addError(c, "funnel must have at least one stage");
    const stageIds = new Set<string>();
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i] as Readonly<Record<string, unknown>>;
      const sc = nested(c, `stages[${i}]`);
      if (!validNonEmptyString(stage["id"])) addError(sc, "id is required");
      if (!validNonEmptyString(stage["name"])) addError(sc, "name is required");
      if (typeof stage["id"] === "string") {
        if (stageIds.has(stage["id"])) addError(sc, `duplicate stage id '${stage["id"]}'`);
        stageIds.add(stage["id"]);
      }
      const reqTypes = stage["requiredEventTypes"];
      if (!Array.isArray(reqTypes) || reqTypes.length === 0) addError(sc, "requiredEventTypes must be a non-empty array");
      else {
        for (let j = 0; j < reqTypes.length; j++) {
          if (!validNonEmptyString(reqTypes[j])) addError(nested(sc, `requiredEventTypes[${j}]`), "must be a non-empty string");
        }
      }
      if (stage["minimumScore"] !== undefined && !validNonNegativeFinite(stage["minimumScore"])) {
        addError(sc, "minimumScore must be non-negative and finite");
      }
      if (stage["maximumDwellMs"] !== undefined && !validPositiveInteger(stage["maximumDwellMs"])) {
        addError(sc, "maximumDwellMs must be a positive integer");
      }
    }
  }
  return c.errors;
}

export function validateRoutingPolicy(policy: Readonly<Record<string, unknown>>): readonly string[] {
  const c = ctx("routingPolicy");
  if (!validNonEmptyString(policy["id"])) addError(c, "id is required");
  if (!validNonEmptyString(policy["name"])) addError(c, "name is required");

  const validStrategies = new Set(["round-robin", "capacity-weighted", "skill-match", "territory-priority"]);
  if (!validStrategies.has(policy["strategy"] as string)) addError(c, "strategy must be round-robin, capacity-weighted, skill-match, or territory-priority");

  const validFallbacks = new Set(["queue", "overflow-territory", "reject"]);
  if (!validFallbacks.has(policy["fallbackStrategy"] as string)) addError(c, "fallbackStrategy must be queue, overflow-territory, or reject");

  if (policy["fallbackStrategy"] === "overflow-territory" && !validNonEmptyString(policy["overflowTerritoryId"])) {
    addError(c, "overflowTerritoryId is required when fallbackStrategy is overflow-territory");
  }

  const territories = policy["territories"];
  if (!Array.isArray(territories)) {
    addError(c, "territories must be an array");
  } else {
    const terrIds = new Set<string>();
    for (let i = 0; i < territories.length; i++) {
      const terr = territories[i] as Readonly<Record<string, unknown>>;
      const tc = nested(c, `territories[${i}]`);
      if (!validNonEmptyString(terr["id"])) addError(tc, "id is required");
      if (!validNonEmptyString(terr["name"])) addError(tc, "name is required");
      if (typeof terr["id"] === "string") {
        if (terrIds.has(terr["id"])) addError(tc, `duplicate territory id`);
        terrIds.add(terr["id"]);
      }
      if (!Number.isSafeInteger(terr["priority"])) addError(tc, "priority must be a safe integer");
      if (!validPositiveInteger(terr["maxLeads"])) addError(tc, "maxLeads must be a positive integer");
    }
  }

  const cap = policy["capacityConstraints"] as Readonly<Record<string, unknown>> | undefined;
  if (cap) {
    const cc = nested(c, "capacityConstraints");
    if (!validPositiveInteger(cap["maxLeadsPerRep"])) addError(cc, "maxLeadsPerRep must be a positive integer");
    if (!validPositiveInteger(cap["maxLeadsPerTerritory"])) addError(cc, "maxLeadsPerTerritory must be a positive integer");
    if (!validPercentage(cap["reserveCapacityPercent"])) addError(cc, "reserveCapacityPercent must be 0-100");
  }

  return c.errors;
}

export function validateBatchPolicy(policy: Readonly<Record<string, unknown>>): readonly string[] {
  const c = ctx("batchPolicy");
  if (!validNonEmptyString(policy["id"])) addError(c, "id is required");
  if (!validPositiveInteger(policy["maxBatchSize"])) addError(c, "maxBatchSize must be a positive integer");

  const conflictStrategies = new Set(["skip", "overwrite", "merge", "error"]);
  if (!conflictStrategies.has(policy["conflictStrategy"] as string)) addError(c, "conflictStrategy must be skip, overwrite, merge, or error");

  const validationModes = new Set(["strict", "lenient", "skip"]);
  if (!validationModes.has(policy["validationMode"] as string)) addError(c, "validationMode must be strict, lenient, or skip");

  const orderingStrategies = new Set(["chronological", "priority", "lead-grouped"]);
  if (!orderingStrategies.has(policy["orderingStrategy"] as string)) addError(c, "orderingStrategy must be chronological, priority, or lead-grouped");

  if (typeof policy["enableRollback"] !== "boolean") addError(c, "enableRollback must be a boolean");
  if (typeof policy["enableProgressTracking"] !== "boolean") addError(c, "enableProgressTracking must be a boolean");

  return c.errors;
}

export function validateSimulationConfig(config: Readonly<Record<string, unknown>>): readonly string[] {
  const c = ctx("simulationConfig");
  if (!validNonEmptyString(config["id"])) addError(c, "id is required");
  if (!validNonEmptyString(config["name"])) addError(c, "name is required");
  if (!validTimestamp(config["evaluateAt"] as number)) addError(c, "evaluateAt must be a valid timestamp");

  if (!Array.isArray(config["baseRules"])) addError(c, "baseRules must be an array");
  if (!Array.isArray(config["variantRules"])) addError(c, "variantRules must be an array");

  const targetLeadIds = config["targetLeadIds"];
  if (targetLeadIds !== undefined) {
    if (!Array.isArray(targetLeadIds)) addError(c, "targetLeadIds must be an array");
    else {
      for (let i = 0; i < targetLeadIds.length; i++) {
        if (!validNonEmptyString(targetLeadIds[i])) addError(nested(c, `targetLeadIds[${i}]`), "must be a non-empty string");
      }
    }
  }

  return c.errors;
}
