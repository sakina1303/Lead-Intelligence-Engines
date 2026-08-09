import { describe, expect, test } from "vitest";
import { addLead, createEngine, evaluateWhatIfScenario, processEvent, runShadowPolicyExecution } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

function scoredState() {
  const lead = addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@example.test", createdAt: 1 });
  if (!lead.ok) throw new Error("setup failed");
  const scored = processEvent(lead.value, event("open-1", { occurredAt: 10, sequence: 1 }), rules, 20);
  if (scored.outcome !== "accepted") throw new Error("setup failed");
  return scored.state;
}

describe("replay scenario integrity", () => {
  test("what-if replay preserves complete state and scores injected events in chronological order", () => {
    const result = evaluateWhatIfScenario(scoredState(), "lead-1", {
      id: "demo-scenario", name: "demo", eventsToDrop: [], ruleOverrides: [],
      eventsToInject: [event("demo-1", { type: "demo.request", occurredAt: 5, sequence: 0 })],
    }, rules, config.qualificationPolicies);
    expect(result.ok && result.value.projectedScore).toBe(50);
  });

  test("what-if replay rejects an injection for another lead instead of silently changing it", () => {
    const result = evaluateWhatIfScenario(scoredState(), "lead-1", {
      id: "wrong-lead", name: "wrong lead", eventsToDrop: [], ruleOverrides: [],
      eventsToInject: [event("foreign", { leadId: "lead-2", occurredAt: 5, sequence: 0 })],
    }, rules, config.qualificationPolicies);
    expect(result.ok).toBe(false);
  });

  test("shadow qualification uses the caller-supplied evaluation timestamp", () => {
    const result = runShadowPolicyExecution(scoredState(), "lead-1", rules, config.qualificationPolicies, 777);
    expect(result.ok && result.value.shadowState.qualifications["lead-1"]?.evaluatedAt).toBe(777);
  });
});
