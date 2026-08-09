import { describe, expect, test } from "vitest";
import { addLead, analyzeEventCohortRetention, compareEventWindows, correlateScoreWithEvents, createEngine, processEvent } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

function stateWithTwoLeads() {
  const first = addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@example.test", createdAt: 1 });
  if (!first.ok) throw new Error("setup failed");
  const second = addLead(first.value, { id: "lead-2", name: "Lin", email: "lin@example.test", createdAt: 2 });
  if (!second.ok) throw new Error("setup failed");
  const one = processEvent(second.value, event("open-1", { leadId: "lead-1", occurredAt: 10, sequence: 1 }), rules, 20);
  return processEvent(one.state, event("demo-2", { leadId: "lead-2", type: "demo.request", category: "intent", occurredAt: 30, sequence: 1 }), rules, 40).state;
}

describe("state-derived analytics", () => {
  test("cohort retention counts only ledger activity in the supplied observation window", () => {
    const report = analyzeEventCohortRetention(stateWithTwoLeads(), 0, 5, 20, 40);
    expect(report.cohortSize).toBe(2);
    expect(report.retainedLeads).toBe(1);
    expect(report.averageEventsBeforeWindow).toBe(0.5);
  });

  test("score correlation is computed from final scores and selected events", () => {
    const report = correlateScoreWithEvents(stateWithTwoLeads(), { category: "intent" });
    expect(report.sampleSize).toBe(2);
    expect(report.averageSelectedEvents).toBe(0.5);
    expect(report.coefficient).toBeGreaterThan(0);
  });

  test("window comparison identifies activity from leads absent in the earlier window", () => {
    const comparison = compareEventWindows(stateWithTwoLeads(), { start: 0, end: 20 }, { start: 21, end: 40 });
    expect(comparison.absoluteChange).toBe(0);
    expect(comparison.leadIdsWithNewActivity).toEqual(["lead-2"]);
  });
});
