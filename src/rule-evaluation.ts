import type { AttributeCondition, DomainEvent, EventCondition, Lead, NumericOperator, RuleEvaluationContext, RuleExpression, ScoringRule } from "./contracts.js";
import { compareRules, matchesAttributes } from "./scoring-rules.js";

export function ruleMatches(rule: ScoringRule, event: DomainEvent, lead: Lead): boolean {
  const condition = rule.condition;
  return rule.enabled &&
    (condition.eventType === undefined || condition.eventType === event.type) &&
    (condition.category === undefined || condition.category === event.category) &&
    (condition.lifecycle === undefined || condition.lifecycle.includes(lead.lifecycle)) &&
    matchesAttributes(event.attributes, condition.attributes) &&
    matchesAttributes(lead.attributes, condition.leadAttributes);
}

export function compareNumber(left: number, operator: NumericOperator, right: number): boolean {
  switch (operator) {
    case "equals": return left === right;
    case "greater-than": return left > right;
    case "greater-than-or-equal": return left >= right;
    case "less-than": return left < right;
    case "less-than-or-equal": return left <= right;
  }
}

function attributeMatches(values: Readonly<Record<string, string | number | boolean>>, condition: AttributeCondition): boolean {
  const value = values[condition.key];
  return (condition.exists === undefined || (value !== undefined) === condition.exists) && (condition.equals === undefined || value === condition.equals);
}

function conditionMatches(condition: EventCondition, context: RuleEvaluationContext): boolean {
  return (condition.eventType === undefined || condition.eventType === context.event.type) &&
    (condition.category === undefined || condition.category === context.event.category) &&
    (condition.lifecycle === undefined || condition.lifecycle.includes(context.lead.lifecycle)) &&
    (condition.attributes ?? []).every((item) => attributeMatches(context.event.attributes, item)) &&
    (condition.leadAttributes ?? []).every((item) => attributeMatches(context.lead.attributes, item));
}

export function evaluateRuleExpression(expression: RuleExpression, context: RuleEvaluationContext): boolean {
  switch (expression.kind) {
    case "all": return expression.expressions.every((item) => evaluateRuleExpression(item, context));
    case "any": return expression.expressions.some((item) => evaluateRuleExpression(item, context));
    case "not": return !evaluateRuleExpression(expression.expression, context);
    case "event-condition": return conditionMatches(expression.condition, context);
    case "lead-attribute": return attributeMatches(context.lead.attributes, expression.condition);
    case "event-attribute": return attributeMatches(context.event.attributes, expression.condition);
    case "score": return compareNumber(context.score, expression.operator, expression.value);
    case "event-count": {
      const count = context.eventHistory.filter((event) => (expression.eventType === undefined || event.type === expression.eventType) && (expression.category === undefined || event.category === expression.category)).length;
      return compareNumber(count, expression.operator, expression.value);
    }
  }
}

export function expressionRuleMatches(rule: ScoringRule, context: RuleEvaluationContext): boolean {
  return rule.enabled && ruleMatches(rule, context.event, context.lead) && (rule.expression === undefined || evaluateRuleExpression(rule.expression, context));
}

export function explainRuleExpression(expression: RuleExpression, context: RuleEvaluationContext): readonly string[] {
  const passed = evaluateRuleExpression(expression, context);
  if (expression.kind === "all" || expression.kind === "any") return [`${expression.kind}:${passed}`, ...expression.expressions.flatMap((item) => explainRuleExpression(item, context))];
  if (expression.kind === "not") return [`not:${passed}`, ...explainRuleExpression(expression.expression, context)];
  return [`${expression.kind}:${passed}`];
}

export function matchingRules(rules: readonly ScoringRule[], event: DomainEvent, lead: Lead): readonly ScoringRule[] {
  const matches = rules.filter((rule) => ruleMatches(rule, event, lead)).sort(compareRules);
  const stopper = matches.findIndex((rule) => rule.stopProcessing === true);
  return stopper < 0 ? matches : matches.slice(0, stopper + 1);
}

export function selectRules(rules: readonly ScoringRule[], mode: "stack" | "highest-priority" | "first-match"): readonly ScoringRule[] {
  if (mode === "stack") return rules;
  return rules.length === 0 ? [] : [rules[0]!];
}

// AST Rule Evaluator
export type ASTOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "startsWith" | "endsWith" | "matches";
export type ASTNodeType = "LogicalExpression" | "BinaryExpression" | "Identifier" | "Literal" | "MemberExpression";
export interface ASTNode { type: ASTNodeType; }
export interface Literal extends ASTNode { type: "Literal"; value: string | number | boolean | null; }
export interface Identifier extends ASTNode { type: "Identifier"; name: string; }
export interface MemberExpression extends ASTNode { type: "MemberExpression"; object: ASTNode; property: Identifier | Literal; }
export interface BinaryExpression extends ASTNode { type: "BinaryExpression"; operator: ASTOperator; left: ASTNode; right: ASTNode; }
export interface LogicalExpression extends ASTNode { type: "LogicalExpression"; operator: "and" | "or"; left: ASTNode; right: ASTNode; }

export function evaluateAST(node: ASTNode, context: Record<string, any>): boolean {
    if (node.type === "LogicalExpression") {
        const expr = node as LogicalExpression;
        const left = evaluateAST(expr.left, context);
        if (expr.operator === "and" && !left) return false;
        if (expr.operator === "or" && left) return true;
        return evaluateAST(expr.right, context);
    }
    if (node.type === "BinaryExpression") {
        const expr = node as BinaryExpression;
        const leftVal = evaluateNode(expr.left, context);
        const rightVal = evaluateNode(expr.right, context);
        switch (expr.operator) {
            case "eq": return leftVal === rightVal;
            case "neq": return leftVal !== rightVal;
            case "gt": return typeof leftVal === 'number' && typeof rightVal === 'number' && leftVal > rightVal;
            case "gte": return typeof leftVal === 'number' && typeof rightVal === 'number' && leftVal >= rightVal;
            case "lt": return typeof leftVal === 'number' && typeof rightVal === 'number' && leftVal < rightVal;
            case "lte": return typeof leftVal === 'number' && typeof rightVal === 'number' && leftVal <= rightVal;
            case "in": return Array.isArray(rightVal) && rightVal.includes(leftVal);
            case "contains": return typeof leftVal === 'string' && typeof rightVal === 'string' && leftVal.includes(rightVal);
            case "startsWith": return typeof leftVal === 'string' && typeof rightVal === 'string' && leftVal.startsWith(rightVal);
            case "endsWith": return typeof leftVal === 'string' && typeof rightVal === 'string' && leftVal.endsWith(rightVal);
            case "matches": {
                if (typeof leftVal !== 'string' || typeof rightVal !== 'string') return false;
                try { return new RegExp(rightVal).test(leftVal); } catch { return false; }
            }
            default: return false;
        }
    }
    return false;
}
export function evaluateNode(node: ASTNode, context: Record<string, any>): any {
    switch (node.type) {
        case "Literal": return (node as Literal).value;
        case "Identifier": return context[(node as Identifier).name];
        case "MemberExpression": {
            const expr = node as MemberExpression;
            const obj = evaluateNode(expr.object, context);
            const prop = expr.property.type === "Identifier" ? expr.property.name : (expr.property as Literal).value;
            if (obj && typeof obj === 'object') return obj[prop as string];
            return undefined;
        }
        default: return undefined;
    }
}
