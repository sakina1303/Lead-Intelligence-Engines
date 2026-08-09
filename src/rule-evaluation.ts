import type { AttributeCondition, DomainEvent, EventCondition, Lead, NumericOperator, RuleEvaluationContext, RuleExpression, ScoringRule, EngineState } from "./contracts.js";
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

// --- AST Optimization Passes ---

export function foldConstants(node: ASTNode): ASTNode {
  switch (node.type) {
    case "BinaryExpression": {
      const bin = node as BinaryExpressionNode;
      const left = foldConstants(bin.left);
      const right = foldConstants(bin.right);
      
      if (left.type === "Literal" && right.type === "Literal") {
        const lv = (left as LiteralNode).value;
        const rv = (right as LiteralNode).value;
        
        switch (bin.operator) {
          case "eq": return { type: "Literal", value: lv === rv } as LiteralNode;
          case "neq": return { type: "Literal", value: lv !== rv } as LiteralNode;
          case "gt": return { type: "Literal", value: typeof lv === "number" && typeof rv === "number" && lv > rv } as LiteralNode;
          case "gte": return { type: "Literal", value: typeof lv === "number" && typeof rv === "number" && lv >= rv } as LiteralNode;
          case "lt": return { type: "Literal", value: typeof lv === "number" && typeof rv === "number" && lv < rv } as LiteralNode;
          case "lte": return { type: "Literal", value: typeof lv === "number" && typeof rv === "number" && lv <= rv } as LiteralNode;
          default: break;
        }
      }
      return { type: "BinaryExpression", operator: bin.operator, left, right } as BinaryExpressionNode;
    }
    
    case "LogicalExpression": {
      const log = node as LogicalExpressionNode;
      const left = foldConstants(log.left);
      const right = foldConstants(log.right);
      
      if (left.type === "Literal") {
        const lv = (left as LiteralNode).value;
        if (log.operator === "and") return lv ? right : { type: "Literal", value: false } as LiteralNode;
        if (log.operator === "or") return lv ? { type: "Literal", value: true } as LiteralNode : right;
      }
      
      return { type: "LogicalExpression", operator: log.operator, left, right } as LogicalExpressionNode;
    }
    
    case "UnaryExpression": {
      const un = node as UnaryExpressionNode;
      const arg = foldConstants(un.argument);
      
      if (arg.type === "Literal" && un.operator === "not") {
        return { type: "Literal", value: !(arg as LiteralNode).value } as LiteralNode;
      }
      
      // Double negation elimination
      if (un.operator === "not" && arg.type === "UnaryExpression" && (arg as UnaryExpressionNode).operator === "not") {
        return (arg as UnaryExpressionNode).argument;
      }
      
      return { type: "UnaryExpression", operator: un.operator, argument: arg } as UnaryExpressionNode;
    }
    
    case "ArrayExpression": {
      const arr = node as ArrayExpressionNode;
      return { type: "ArrayExpression", elements: arr.elements.map(foldConstants) } as ArrayExpressionNode;
    }
    
    default:
      return node;
  }
}

export function eliminateDeadBranches(node: ASTNode): ASTNode {
  switch (node.type) {
    case "LogicalExpression": {
      const log = node as LogicalExpressionNode;
      const left = eliminateDeadBranches(log.left);
      const right = eliminateDeadBranches(log.right);
      
      // "and" with false is always false
      if (left.type === "Literal" && (left as LiteralNode).value === false && log.operator === "and") {
        return { type: "Literal", value: false } as LiteralNode;
      }
      // "or" with true is always true
      if (left.type === "Literal" && (left as LiteralNode).value === true && log.operator === "or") {
        return { type: "Literal", value: true } as LiteralNode;
      }
      // "and" with true simplifies to right
      if (left.type === "Literal" && (left as LiteralNode).value === true && log.operator === "and") {
        return right;
      }
      // "or" with false simplifies to right
      if (left.type === "Literal" && (left as LiteralNode).value === false && log.operator === "or") {
        return right;
      }
      
      return { type: "LogicalExpression", operator: log.operator, left, right } as LogicalExpressionNode;
    }
    
    case "UnaryExpression": {
      const un = node as UnaryExpressionNode;
      return { type: "UnaryExpression", operator: un.operator, argument: eliminateDeadBranches(un.argument) } as UnaryExpressionNode;
    }
    
    case "BinaryExpression": {
      const bin = node as BinaryExpressionNode;
      return { type: "BinaryExpression", operator: bin.operator, left: eliminateDeadBranches(bin.left), right: eliminateDeadBranches(bin.right) } as BinaryExpressionNode;
    }
    
    default:
      return node;
  }
}

export function optimizeAST(node: ASTNode): ASTNode {
  let current = node;
  for (let pass = 0; pass < 3; pass++) {
    const folded = foldConstants(current);
    const pruned = eliminateDeadBranches(folded);
    if (serializeAST(pruned) === serializeAST(current)) break;
    current = pruned;
  }
  return current;
}

// --- AST Complexity ---

export interface ASTComplexity {
  readonly depth: number;
  readonly nodeCount: number;
  readonly branchCount: number;
  readonly identifierCount: number;
  readonly literalCount: number;
  readonly complexityScore: number;
}

export function measureASTComplexity(node: ASTNode): ASTComplexity {
  let nodeCount = 0;
  let branchCount = 0;
  let identifierCount = 0;
  let literalCount = 0;
  
  function countDepth(n: ASTNode): number {
    nodeCount++;
    switch (n.type) {
      case "Literal": literalCount++; return 1;
      case "Identifier": identifierCount++; return 1;
      case "BinaryExpression": {
        branchCount++;
        const bin = n as BinaryExpressionNode;
        return 1 + Math.max(countDepth(bin.left), countDepth(bin.right));
      }
      case "LogicalExpression": {
        branchCount++;
        const log = n as LogicalExpressionNode;
        return 1 + Math.max(countDepth(log.left), countDepth(log.right));
      }
      case "UnaryExpression":
        return 1 + countDepth((n as UnaryExpressionNode).argument);
      case "MemberExpression": {
        const mem = n as MemberExpressionNode;
        return 1 + Math.max(countDepth(mem.object), countDepth(mem.property));
      }
      case "ArrayExpression":
        return 1 + (n as ArrayExpressionNode).elements.reduce((m, el) => Math.max(m, countDepth(el)), 0);
      case "CallExpression":
        return 1;
    }
    return 1;
  }
  
  const depth = countDepth(node);
  const complexityScore = depth * 2 + branchCount * 3 + nodeCount;
  
  return { depth, nodeCount, branchCount, identifierCount, literalCount, complexityScore };
}

export function exceedsComplexityBudget(node: ASTNode, maxDepth: number, maxNodes: number): boolean {
  const complexity = measureASTComplexity(node);
  return complexity.depth > maxDepth || complexity.nodeCount > maxNodes;
}

// --- AST Serialization ---

export function serializeAST(node: ASTNode): string {
  switch (node.type) {
    case "Literal": {
      const lit = node as LiteralNode;
      return lit.value === null ? "null" : JSON.stringify(lit.value);
    }
    case "Identifier":
      return `$${(node as IdentifierNode).name}`;
    case "BinaryExpression": {
      const bin = node as BinaryExpressionNode;
      return `(${serializeAST(bin.left)} ${bin.operator} ${serializeAST(bin.right)})`;
    }
    case "LogicalExpression": {
      const log = node as LogicalExpressionNode;
      return `(${serializeAST(log.left)} ${log.operator} ${serializeAST(log.right)})`;
    }
    case "UnaryExpression": {
      const un = node as UnaryExpressionNode;
      return `(${un.operator} ${serializeAST(un.argument)})`;
    }
    case "MemberExpression": {
      const mem = node as MemberExpressionNode;
      return mem.computed
        ? `${serializeAST(mem.object)}[${serializeAST(mem.property)}]`
        : `${serializeAST(mem.object)}.${serializeAST(mem.property)}`;
    }
    case "ArrayExpression":
      return `[${(node as ArrayExpressionNode).elements.map(serializeAST).join(", ")}]`;
    default:
      return "<unknown>";
  }
}

export function deserializeLiteral(token: string): LiteralNode {
  if (token === "null") return { type: "Literal", value: null };
  if (token === "true") return { type: "Literal", value: true };
  if (token === "false") return { type: "Literal", value: false };
  const num = Number(token);
  if (!isNaN(num) && token.length > 0) return { type: "Literal", value: num };
  // Remove quotes for string
  if (token.startsWith('"') && token.endsWith('"')) return { type: "Literal", value: token.slice(1, -1) };
  return { type: "Literal", value: token };
}

// --- Expression Equivalence ---

export function areExpressionsEquivalent(a: ASTNode, b: ASTNode): boolean {
  if (a.type !== b.type) return false;
  
  switch (a.type) {
    case "Literal":
      return (a as LiteralNode).value === (b as LiteralNode).value;
    case "Identifier":
      return (a as IdentifierNode).name === (b as IdentifierNode).name;
    case "BinaryExpression": {
      const ba = a as BinaryExpressionNode;
      const bb = b as BinaryExpressionNode;
      if (ba.operator !== bb.operator) return false;
      // Check direct match
      if (areExpressionsEquivalent(ba.left, bb.left) && areExpressionsEquivalent(ba.right, bb.right)) return true;
      // Check commutative operators
      if ((ba.operator === "eq" || ba.operator === "neq") &&
          areExpressionsEquivalent(ba.left, bb.right) && areExpressionsEquivalent(ba.right, bb.left)) return true;
      return false;
    }
    case "LogicalExpression": {
      const la = a as LogicalExpressionNode;
      const lb = b as LogicalExpressionNode;
      if (la.operator !== lb.operator) return false;
      if (areExpressionsEquivalent(la.left, lb.left) && areExpressionsEquivalent(la.right, lb.right)) return true;
      // Commutative check for and/or
      if (areExpressionsEquivalent(la.left, lb.right) && areExpressionsEquivalent(la.right, lb.left)) return true;
      return false;
    }
    case "UnaryExpression": {
      const ua = a as UnaryExpressionNode;
      const ub = b as UnaryExpressionNode;
      return ua.operator === ub.operator && areExpressionsEquivalent(ua.argument, ub.argument);
    }
    case "ArrayExpression": {
      const aa = a as ArrayExpressionNode;
      const ab = b as ArrayExpressionNode;
      return aa.elements.length === ab.elements.length && aa.elements.every((el, i) => areExpressionsEquivalent(el, ab.elements[i]!));
    }
    case "MemberExpression": {
      const ma = a as MemberExpressionNode;
      const mb = b as MemberExpressionNode;
      return ma.computed === mb.computed && areExpressionsEquivalent(ma.object, mb.object) && areExpressionsEquivalent(ma.property, mb.property);
    }
    default:
      return false;
  }
}

// --- Partial Evaluation ---

export interface PartialEvalResult {
  readonly isResolved: boolean;
  readonly value: unknown;
  readonly residual: ASTNode;
}

export function partialEvaluateAST(node: ASTNode, context: EvaluationContext): PartialEvalResult {
  switch (node.type) {
    case "Literal":
      return { isResolved: true, value: (node as LiteralNode).value, residual: node };
    
    case "Identifier": {
      const id = node as IdentifierNode;
      if (Object.prototype.hasOwnProperty.call(context, id.name)) {
        const val = context[id.name];
        return { isResolved: true, value: val, residual: { type: "Literal", value: val as string | number | boolean | null } as LiteralNode };
      }
      return { isResolved: false, value: undefined, residual: node };
    }
    
    case "BinaryExpression": {
      const bin = node as BinaryExpressionNode;
      const left = partialEvaluateAST(bin.left, context);
      const right = partialEvaluateAST(bin.right, context);
      
      if (left.isResolved && right.isResolved) {
        const result = evaluateAST(node, context);
        return { isResolved: true, value: result, residual: { type: "Literal", value: result } as LiteralNode };
      }
      
      return { isResolved: false, value: undefined, residual: { type: "BinaryExpression", operator: bin.operator, left: left.residual, right: right.residual } as BinaryExpressionNode };
    }
    
    case "LogicalExpression": {
      const log = node as LogicalExpressionNode;
      const left = partialEvaluateAST(log.left, context);
      
      // Short-circuit: "and" with false, "or" with true
      if (left.isResolved) {
        if (log.operator === "and" && !left.value) return { isResolved: true, value: false, residual: { type: "Literal", value: false } as LiteralNode };
        if (log.operator === "or" && left.value) return { isResolved: true, value: true, residual: { type: "Literal", value: true } as LiteralNode };
        
        const right = partialEvaluateAST(log.right, context);
        if (right.isResolved) {
          const result = evaluateAST(node, context);
          return { isResolved: true, value: result, residual: { type: "Literal", value: result } as LiteralNode };
        }
        return { isResolved: false, value: undefined, residual: right.residual };
      }
      
      const right = partialEvaluateAST(log.right, context);
      return { isResolved: false, value: undefined, residual: { type: "LogicalExpression", operator: log.operator, left: left.residual, right: right.residual } as LogicalExpressionNode };
    }
    
    case "UnaryExpression": {
      const un = node as UnaryExpressionNode;
      const arg = partialEvaluateAST(un.argument, context);
      if (arg.isResolved) {
        const result = evaluateAST(node, context);
        return { isResolved: true, value: result, residual: { type: "Literal", value: result } as LiteralNode };
      }
      return { isResolved: false, value: undefined, residual: { type: "UnaryExpression", operator: un.operator, argument: arg.residual } as UnaryExpressionNode };
    }
    
    default:
      return { isResolved: false, value: undefined, residual: node };
  }
}

// --- Rule Coverage Analysis ---

export interface RuleCoverageReport {
  readonly totalRules: number;
  readonly matchedRules: number;
  readonly unmatchedRules: readonly string[];
  readonly coveragePercent: number;
  readonly ruleMatchCounts: Readonly<Record<string, number>>;
}

export function analyzeRuleCoverage(state: EngineState, rules: readonly ScoringRule[]): RuleCoverageReport {
  const matchCounts: Record<string, number> = {};
  for (const rule of rules) matchCounts[rule.id] = 0;
  
  const events = Object.values(state.events) as readonly DomainEvent[];
  
  for (const event of events) {
    const lead = state.leads[event.leadId];
    if (!lead) continue;
    
    for (const rule of rules) {
      if (ruleMatches(rule, event, lead)) {
        matchCounts[rule.id] = (matchCounts[rule.id] ?? 0) + 1;
      }
    }
  }
  
  const unmatchedRules = Object.entries(matchCounts)
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort();
  
  return {
    totalRules: rules.length,
    matchedRules: rules.length - unmatchedRules.length,
    unmatchedRules,
    coveragePercent: rules.length === 0 ? 100 : ((rules.length - unmatchedRules.length) / rules.length) * 100,
    ruleMatchCounts: matchCounts,
  };
}
