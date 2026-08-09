import type { AttributeCondition, EventCondition, Outcome, ScoringRule } from "./contracts.js";
import { failure, success, validId } from "./validation.js";

export function compareRules(left: ScoringRule, right: ScoringRule): number {
  return right.priority - left.priority || left.id.localeCompare(right.id);
}

export function validateRule(rule: ScoringRule): Outcome<ScoringRule> {
  const errors = [
    ...(!validId(rule.id) ? ["rule id is required"] : []),
    ...(!validId(rule.name) ? ["rule name is required"] : []),
    ...(!Number.isSafeInteger(rule.priority) ? ["rule priority must be a safe integer"] : []),
    ...(!Number.isFinite(rule.delta) ? ["rule delta must be finite"] : []),
    ...validateCondition(rule.condition),
  ];
  return errors.length === 0 ? success(rule) : failure(...errors);
}

function validateCondition(condition: EventCondition): readonly string[] {
  const errors: string[] = [];
  for (const item of [...(condition.attributes ?? []), ...(condition.leadAttributes ?? [])]) {
    if (!validId(item.key)) errors.push("condition attribute key is required");
    if (item.equals === undefined && item.exists === undefined) errors.push(`condition '${item.key}' needs equals or exists`);
  }
  if (condition.eventType !== undefined && !validId(condition.eventType)) errors.push("condition event type is invalid");
  return errors;
}

export function normalizeRules(rules: readonly ScoringRule[]): Outcome<readonly ScoringRule[]> {
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const rule of rules) {
    const result = validateRule(rule);
    if (!result.ok) errors.push(...result.errors.map((error) => `${rule.id}: ${error}`));
    if (ids.has(rule.id)) errors.push(`duplicate rule id '${rule.id}'`);
    ids.add(rule.id);
  }
  return errors.length === 0 ? success([...rules].sort(compareRules)) : failure(...errors);
}

export function matchesAttributes(values: Readonly<Record<string, string | number | boolean>>, conditions: readonly AttributeCondition[] = []): boolean {
  return conditions.every((condition) => {
    const value = values[condition.key];
    return (condition.exists === undefined || (value !== undefined) === condition.exists) && (condition.equals === undefined || value === condition.equals);
  });
}
