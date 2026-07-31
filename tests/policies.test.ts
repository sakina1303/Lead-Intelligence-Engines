import { describe, expect, test } from "vitest";
import { addLead, createEngine, evaluateQualification, processEvent, refreshLeadIntelligence, transitionLifecycle } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

function lead(attributes: Record<string, string | number | boolean> = {}) {
  return addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@test.dev", createdAt: 0, attributes }).value!;
}

describe("policy behavior", () => {
  test.each(Array.from({ length: 20 }, (_, index) => ({ score: index * 5, expected: index * 5 >= 30 ? "marketing-qualified" : "unqualified" })))("qualification threshold %#", ({ score, expected }) => {
    const result = evaluateQualification(lead().leads["lead-1"]!, score, [event("e")], config.qualificationPolicies[0]!, 100);
    expect(result.state).toBe(expected);
  });

  test.each(Array.from({ length: 20 }, (_, index) => index))("qualification requires event evidence %i", (index) => {
    const policy = { id: `p${index}`, minimumScore: index, minimumEvents: index % 3, qualification: "sales-qualified" as const };
    const events = Array.from({ length: index % 3 }, (_, eventIndex) => event(`e-${index}-${eventIndex}`));
    expect(evaluateQualification(lead().leads["lead-1"]!, index, events, policy, 10).state).toBe("sales-qualified");
  });

  test.each(Array.from({ length: 20 }, (_, index) => index))("event processing is repeatable %i", (index) => {
    const input = event(`event-${index}`, { occurredAt: index, sequence: index, type: index % 2 === 0 ? "email.open" : "demo.request", category: index % 2 === 0 ? "engagement" : "intent" });
    const one = processEvent(lead(), input, rules, 100);
    const two = processEvent(lead(), input, rules, 100);
    expect(one).toEqual(two);
  });

  test.each(Array.from({ length: 20 }, (_, index) => index))("refresh preserves score %i", (index) => {
    let state = lead();
    state = processEvent(state, event(`event-${index}`), rules, 10).state;
    const refreshed = refreshLeadIntelligence(state, "lead-1", 100);
    expect(refreshed.state.scores["lead-1"]).toBe(state.scores["lead-1"]);
  });

  test.each(["contacted", "nurturing", "qualified", "rejected"] as const)("lifecycle can be refreshed from %s", (lifecycle) => {
    const initial = lead();
    const changed = transitionLifecycle(initial, "lead-1", lifecycle, 1).value!;
    expect(refreshLeadIntelligence(changed, "lead-1", 2).outcome).toBe("accepted");
  });
});
