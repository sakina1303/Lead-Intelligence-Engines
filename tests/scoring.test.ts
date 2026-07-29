import { describe, expect, test } from "vitest";
import { addLead, clampScore, createEngine, matchingRules, normalizeRules, processEvent, ruleMatches, scoreEvent, selectRules } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

function seeded() { return addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@test.dev", createdAt: 0 }).value!; }

describe("scoring rules and scores", () => {
  test.each([[-5, 0, 100, 0], [0, 0, 100, 0], [40, 0, 100, 40], [101, 0, 100, 100], [30, 20, 80, 30], [-4, -10, 10, -4]])("clamps score %#", (score, floor, cap, expected) => expect(clampScore(score, floor, cap)).toBe(expected));

  test.each([
    [rules[0]!, event("a"), true], [rules[0]!, event("a", { type: "other" }), false], [rules[1]!, event("a", { type: "demo.request" }), true],
    [rules[2]!, event("a", { category: "intent" }), true], [rules[2]!, event("a"), false], [{ ...rules[0]!, enabled: false }, event("a"), false],
  ])("matches a rule %#", (rule, input, expected) => expect(ruleMatches(rule, input, seeded().leads["lead-1"]!)).toBe(expected));

  test.each([
    ["stack", 2], ["highest-priority", 1], ["first-match", 1],
  ] as const)("applies conflict mode %s", (mode, expected) => expect(selectRules(rules.slice(0, 2), mode).length).toBe(expected));

  test.each([
    [event("open"), 10, ["open"]], [event("demo", { type: "demo.request", category: "intent" }), 45, ["demo", "intent"]], [event("none", { type: "none" }), 0, []],
  ])("scores event %#", (input, score, ids) => {
    const result = scoreEvent(seeded(), input, rules); expect(result.explanation.nextScore).toBe(score); expect(result.explanation.ruleIds).toEqual(ids);
  });

  test.each([
    ["stack", 45], ["highest-priority", 40], ["first-match", 40],
  ] as const)("engine honors policy %s", (mode, score) => {
    const state = createEngine({ ...config, scorePolicy: { ...config.scorePolicy, conflictMode: mode } });
    const withLead = addLead(state, { id: "lead-1", name: "Ada", email: "a@b.co", createdAt: 0 }).value!;
    expect(processEvent(withLead, event("demo", { type: "demo.request", category: "intent" }), rules, 10).state.scores["lead-1"]).toBe(score);
  });

  test("applies score cap and history", () => {
    const state = createEngine({ ...config, scorePolicy: { ...config.scorePolicy, cap: 12 } });
    const lead = addLead(state, { id: "lead-1", name: "Ada", email: "a@b.co", createdAt: 0 }).value!;
    const result = processEvent(lead, event("open"), rules, 1);
    expect(result.state.scores["lead-1"]).toBe(10);
    expect(processEvent(result.state, event("open2"), rules, 2).state.scores["lead-1"]).toBe(12);
  });

  test.each([
    [[], true], [[rules[0]!], true], [[rules[0]!, rules[0]!], false], [[{ ...rules[0]!, id: "", }], false], [[{ ...rules[0]!, delta: Number.NaN }], false],
  ])("normalizes rule sets %#", (input, accepted) => expect(normalizeRules(input).ok).toBe(accepted));

  test("orders matching rules by priority", () => expect(matchingRules(rules, event("d", { type: "demo.request", category: "intent" }), seeded().leads["lead-1"]!).map((rule) => rule.id)).toEqual(["demo", "intent"]));
});
