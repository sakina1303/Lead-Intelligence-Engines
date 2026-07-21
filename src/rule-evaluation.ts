import type { DomainEvent, Lead, ScoringRule } from "./contracts.js";
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

export function matchingRules(rules: readonly ScoringRule[], event: DomainEvent, lead: Lead): readonly ScoringRule[] {
  const matches = rules.filter((rule) => ruleMatches(rule, event, lead)).sort(compareRules);
  const stopper = matches.findIndex((rule) => rule.stopProcessing === true);
  return stopper < 0 ? matches : matches.slice(0, stopper + 1);
}

export function selectRules(rules: readonly ScoringRule[], mode: "stack" | "highest-priority" | "first-match"): readonly ScoringRule[] {
  if (mode === "stack") return rules;
  return rules.length === 0 ? [] : [rules[0]!];
}
