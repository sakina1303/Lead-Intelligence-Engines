import type { AttributeCondition, DomainEvent, EventCondition, Lead, NumericOperator, RuleEvaluationContext, RuleExpression, ScoringRule } from "./contracts.js";
import { compareRules, matchesAttributes } from "./scoring-rules.js";

export type ASTNodeType = 
  | "Literal" | "Identifier" | "BinaryExpression" | "LogicalExpression"
  | "UnaryExpression" | "CallExpression" | "MemberExpression" | "ArrayExpression";

export interface ASTNode { type: ASTNodeType; }
export interface LiteralNode extends ASTNode { type: "Literal"; value: string | number | boolean | null; }
export interface IdentifierNode extends ASTNode { type: "Identifier"; name: string; }
export interface BinaryExpressionNode extends ASTNode { type: "BinaryExpression"; operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "startsWith" | "endsWith" | "matches"; left: ASTNode; right: ASTNode; }
export interface LogicalExpressionNode extends ASTNode { type: "LogicalExpression"; operator: "and" | "or"; left: ASTNode; right: ASTNode; }
export interface UnaryExpressionNode extends ASTNode { type: "UnaryExpression"; operator: "not" | "exists" | "empty"; argument: ASTNode; }
export interface MemberExpressionNode extends ASTNode { type: "MemberExpression"; object: ASTNode; property: ASTNode; computed: boolean; }
export interface ArrayExpressionNode extends ASTNode { type: "ArrayExpression"; elements: ASTNode[]; }

export type EvaluationContext = Readonly<Record<string, any>>;

export function evaluateAST(node: ASTNode, context: EvaluationContext): any {
  if (!node) return null;
  switch (node.type) {
    case "Literal": return (node as LiteralNode).value;
    case "Identifier": {
        const idNode = node as IdentifierNode;
        return (context && Object.prototype.hasOwnProperty.call(context, idNode.name)) ? context[idNode.name] : undefined;
    }
    case "BinaryExpression": {
        const binNode = node as BinaryExpressionNode;
        const left = evaluateAST(binNode.left, context);
        const right = evaluateAST(binNode.right, context);
        switch (binNode.operator) {
            case "eq": return left === right;
            case "neq": return left !== right;
            case "gt": return typeof left === 'number' && typeof right === 'number' && left > right;
            case "gte": return typeof left === 'number' && typeof right === 'number' && left >= right;
            case "lt": return typeof left === 'number' && typeof right === 'number' && left < right;
            case "lte": return typeof left === 'number' && typeof right === 'number' && left <= right;
            case "in": return Array.isArray(right) && right.includes(left);
            case "contains": return typeof left === 'string' && typeof right === 'string' && left.includes(right);
            case "startsWith": return typeof left === 'string' && typeof right === 'string' && left.startsWith(right);
            case "endsWith": return typeof left === 'string' && typeof right === 'string' && left.endsWith(right);
            case "matches": {
                if (typeof left !== 'string' || typeof right !== 'string') return false;
                try { return new RegExp(right).test(left); } catch { return false; }
            }
        }
        return false;
    }
    case "LogicalExpression": {
        const logNode = node as LogicalExpressionNode;
        const left = evaluateAST(logNode.left, context);
        if (logNode.operator === "and") return left ? !!evaluateAST(logNode.right, context) : false;
        if (logNode.operator === "or") return left ? true : !!evaluateAST(logNode.right, context);
        return false;
    }
    case "UnaryExpression": {
        const unNode = node as UnaryExpressionNode;
        const arg = evaluateAST(unNode.argument, context);
        switch (unNode.operator) {
            case "not": return !arg;
            case "exists": return arg !== undefined && arg !== null;
            case "empty": return arg === undefined || arg === null || arg === "" || (Array.isArray(arg) && arg.length === 0);
        }
        return false;
    }
    case "MemberExpression": {
        const memNode = node as MemberExpressionNode;
        const obj = evaluateAST(memNode.object, context);
        if (!obj || typeof obj !== 'object') return undefined;
        if (memNode.computed) {
            const prop = evaluateAST(memNode.property, context);
            return obj[prop];
        } else {
            if (memNode.property.type === "Identifier") return obj[(memNode.property as IdentifierNode).name];
            return undefined;
        }
    }
    case "ArrayExpression": {
        return (node as ArrayExpressionNode).elements.map(el => evaluateAST(el, context));
    }
  }
  return null;
}

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
