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

// --- Rule Dependency Graph ---

export interface RuleDependencyGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly cycles: readonly (readonly string[])[];
  readonly isAcyclic: boolean;
}

export function buildRuleDependencyGraph(rules: readonly ScoringRule[]): RuleDependencyGraph {
  const edges: { from: string; to: string }[] = [];
  const nodes = new Set(rules.map(r => r.id));
  
  // A rule depends on another if it requires attributes that the other rule sets,
  // or if it explicitly specifies dependencies (assuming we might add that later).
  // For now, we define a structural overlap as a dependency if priorities differ.
  for (let i = 0; i < rules.length; i++) {
    for (let j = 0; j < rules.length; j++) {
      if (i === j) continue;
      const r1 = rules[i]!;
      const r2 = rules[j]!;
      
      // If r1 evaluates before r2 (higher priority) and they share conditions,
      // r2 depends on the state r1 might leave (conceptually).
      if (r1.priority > r2.priority && shareConditions(r1, r2)) {
        edges.push({ from: r1.id, to: r2.id });
      }
    }
  }
  
  // Find cycles using DFS
  const cycles: (string[])[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];
  
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  for (const e of edges) adj.get(e.from)!.push(e.to);
  
  function dfs(node: string) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    
    for (const neighbor of adj.get(node)!) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart));
      }
    }
    
    recursionStack.delete(node);
    path.pop();
  }
  
  for (const node of nodes) {
    if (!visited.has(node)) dfs(node);
  }
  
  return {
    nodes: [...nodes],
    edges,
    cycles,
    isAcyclic: cycles.length === 0,
  };
}

function shareConditions(r1: ScoringRule, r2: ScoringRule): boolean {
  if (r1.condition.eventType && r2.condition.eventType && r1.condition.eventType === r2.condition.eventType) return true;
  
  const attr1 = r1.condition.attributes ?? [];
  const attr2 = r2.condition.attributes ?? [];
  
  for (const a1 of attr1) {
    for (const a2 of attr2) {
      if (a1.key === a2.key) return true;
    }
  }
  return false;
}

// --- Rule Conflict Detection ---

export interface RuleConflict {
  readonly ruleIdA: string;
  readonly ruleIdB: string;
  readonly severity: "high" | "medium" | "low";
  readonly reason: string;
}

export function detectRuleConflicts(rules: readonly ScoringRule[]): readonly RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]!;
      const b = rules[j]!;
      
      const exactMatch = areConditionsIdentical(a.condition, b.condition);
      
      if (exactMatch) {
        if (a.delta === b.delta) {
          conflicts.push({ ruleIdA: a.id, ruleIdB: b.id, severity: "low", reason: "Identical conditions and deltas (redundant)" });
        } else {
          conflicts.push({ ruleIdA: a.id, ruleIdB: b.id, severity: "high", reason: "Identical conditions but different deltas (contradiction)" });
        }
      } else if (areConditionsOverlapping(a.condition, b.condition)) {
        if (Math.sign(a.delta) !== Math.sign(b.delta)) {
          conflicts.push({ ruleIdA: a.id, ruleIdB: b.id, severity: "medium", reason: "Overlapping conditions with opposite deltas" });
        }
      }
    }
  }
  
  return conflicts;
}

function areConditionsIdentical(a: EventCondition, b: EventCondition): boolean {
  if (a.eventType !== b.eventType) return false;
  
  const aAttr = a.attributes ?? [];
  const bAttr = b.attributes ?? [];
  if (aAttr.length !== bAttr.length) return false;
  
  for (const cA of aAttr) {
    const cB = bAttr.find(x => x.key === cA.key);
    if (!cB) return false;
    if (cA.equals !== cB.equals || cA.exists !== cB.exists) return false;
  }
  
  const aLead = a.leadAttributes ?? [];
  const bLead = b.leadAttributes ?? [];
  if (aLead.length !== bLead.length) return false;
  
  for (const cA of aLead) {
    const cB = bLead.find(x => x.key === cA.key);
    if (!cB) return false;
    if (cA.equals !== cB.equals || cA.exists !== cB.exists) return false;
  }
  
  return true;
}

function areConditionsOverlapping(a: EventCondition, b: EventCondition): boolean {
  // If event types differ and are specified, they can't overlap (an event has one type)
  if (a.eventType && b.eventType && a.eventType !== b.eventType) return false;
  
  // Check for explicit contradiction in attributes
  const aAttr = a.attributes ?? [];
  const bAttr = b.attributes ?? [];
  for (const cA of aAttr) {
    const cB = bAttr.find(x => x.key === cA.key);
    if (cB) {
      if (cA.equals !== undefined && cB.equals !== undefined && cA.equals !== cB.equals) return false; // x=1 vs x=2
      if (cA.exists === true && cB.exists === false) return false;
      if (cA.exists === false && cB.exists === true) return false;
      if (cA.exists === false && cB.equals !== undefined) return false;
    }
  }
  
  const aLead = a.leadAttributes ?? [];
  const bLead = b.leadAttributes ?? [];
  for (const cA of aLead) {
    const cB = bLead.find(x => x.key === cA.key);
    if (cB) {
      if (cA.equals !== undefined && cB.equals !== undefined && cA.equals !== cB.equals) return false;
      if (cA.exists === true && cB.exists === false) return false;
      if (cA.exists === false && cB.exists === true) return false;
      if (cA.exists === false && cB.equals !== undefined) return false;
    }
  }
  
  return true; // No contradiction found, so they can overlap
}

// --- Rule Simplification ---

export function simplifyRule(rule: ScoringRule): ScoringRule {
  const condition = rule.condition;
  const newAttr: AttributeCondition[] = [];
  const newLeadAttr: AttributeCondition[] = [];
  
  // Prune redundant attributes (e.g. exists: true AND equals: "value" -> equals: "value")
  for (const a of condition.attributes ?? []) {
    if (a.equals !== undefined) {
      newAttr.push({ key: a.key, equals: a.equals }); // drop exists if equals is present
    } else {
      newAttr.push(a);
    }
  }
  
  for (const a of condition.leadAttributes ?? []) {
    if (a.equals !== undefined) {
      newLeadAttr.push({ key: a.key, equals: a.equals });
    } else {
      newLeadAttr.push(a);
    }
  }
  
  return {
    ...rule,
    condition: {
      ...(condition.eventType ? { eventType: condition.eventType } : {}),
      ...(newAttr.length > 0 ? { attributes: newAttr } : {}),
      ...(newLeadAttr.length > 0 ? { leadAttributes: newLeadAttr } : {}),
    }
  };
}

// --- Fluent Rule Builder ---

export class RuleBuilder {
  private id: string = "";
  private name: string = "";
  private priority: number = 0;
  private delta: number = 0;
  private dimensions: Record<string, number> = {};
  private tags: string[] = [];
  private eventType?: string;
  private attributes: AttributeCondition[] = [];
  private leadAttributes: AttributeCondition[] = [];
  
  constructor(id: string) {
    this.id = id;
    this.name = id;
  }
  
  public withName(name: string): this { this.name = name; return this; }
  public withPriority(prio: number): this { this.priority = prio; return this; }
  public withDelta(delta: number): this { this.delta = delta; return this; }
  public withDimension(dim: string, val: number): this { this.dimensions[dim] = val; return this; }
  public withTag(tag: string): this { this.tags.push(tag); return this; }
  
  public matchingEvent(type: string): this { this.eventType = type; return this; }
  
  public requiringAttribute(key: string, equals?: string | number | boolean): this {
    if (equals !== undefined) {
      this.attributes.push({ key, equals });
    } else {
      this.attributes.push({ key, exists: true });
    }
    return this;
  }
  
  public requiringMissingAttribute(key: string): this {
    this.attributes.push({ key, exists: false });
    return this;
  }
  
  public requiringLeadAttribute(key: string, equals?: string | number | boolean): this {
    if (equals !== undefined) {
      this.leadAttributes.push({ key, equals });
    } else {
      this.leadAttributes.push({ key, exists: true });
    }
    return this;
  }
  
  public build(): ScoringRule {
    return {
      id: this.id,
      name: this.name,
      priority: this.priority,
      delta: this.delta,
      dimensions: Object.keys(this.dimensions).length > 0 ? this.dimensions : undefined,
      tags: this.tags.length > 0 ? this.tags : undefined,
      condition: {
        ...(this.eventType ? { eventType: this.eventType } : {}),
        ...(this.attributes.length > 0 ? { attributes: this.attributes } : {}),
        ...(this.leadAttributes.length > 0 ? { leadAttributes: this.leadAttributes } : {}),
      }
    };
  }
}
