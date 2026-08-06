import { describe, expect, test } from "vitest";
import { addLead, createEngine, matchingRules, selectRules } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

describe("rule priority", () => {
  test.each(["stack", "highest-priority", "first-match"] as const)("selects ordered rules with %s", (mode) => {
    const lead = addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "a@b.co", createdAt: 0 }).value!.leads["lead-1"]!;
    const matched = matchingRules(rules, event("event", { type: "demo.request", category: "intent" }), lead);
    expect(selectRules(matched, mode).map((rule) => rule.id)).toEqual(mode === "stack" ? ["demo", "intent"] : ["demo"]);
  });
});
