import { describe, expect, test } from "vitest";
import { auditEngineState, createEngine, createLeadInEngine, processEvent, processEventsInOrder, reconcileEngineState, resetLeadIntelligence } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

function populatedState() {
  const created = createLeadInEngine(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@example.test", createdAt: 1 });
  if (created.outcome !== "accepted") throw new Error("setup failed");
  const scored = processEvent(created.state, event("open-1", { occurredAt: 10, sequence: 1 }), rules, 20);
  if (scored.outcome !== "accepted") throw new Error("setup failed");
  return scored.state;
}

describe("engine state operations", () => {
  test("audits ledger indexes and derived score consistency", () => {
    const state = populatedState();
    expect(auditEngineState(state).isConsistent).toBe(true);
    const invalid = { ...state, eventIdsByLead: { ...state.eventIdsByLead, "lead-1": [] }, scoreProjections: { ...state.scoreProjections, "lead-1": { ...state.scoreProjections["lead-1"]!, total: 999 } } };
    const audit = auditEngineState(invalid);
    expect(audit.isConsistent).toBe(false);
    expect(audit.violations.map((item) => item.kind)).toContain("missing-lead-events-index");
    expect(audit.violations.map((item) => item.kind)).toContain("score-projection-stale");
  });

  test("reconciliation uses ledger events to rebuild scores, qualification, segment, and indexes", () => {
    const state = populatedState();
    const damaged = { ...state, eventIdsByLead: {}, scores: { "lead-1": 99 }, scoreHistory: {}, scoreProjections: {}, qualifications: {}, segments: {} };
    const reconciled = reconcileEngineState(damaged, rules, 30);
    expect(reconciled.scores["lead-1"]).toBe(10);
    expect(reconciled.eventIdsByLead["lead-1"]).toEqual(["open-1"]);
    expect(reconciled.qualifications["lead-1"]?.evaluatedAt).toBe(30);
    expect(auditEngineState(reconciled).isConsistent).toBe(true);
  });

  test("selective reset keeps the immutable lead and event records", () => {
    const state = populatedState();
    const reset = resetLeadIntelligence(state, ["lead-1"]);
    expect(reset.leads["lead-1"]?.email).toBe("ada@example.test");
    expect(reset.events["open-1"]?.leadId).toBe("lead-1");
    expect(reset.scores["lead-1"]).toBeUndefined();
    expect(reset.scoreHistory["lead-1"]).toBeUndefined();
  });

  test("ordered bulk processing keeps accepted events when a later event is rejected", () => {
    const created = createLeadInEngine(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@example.test", createdAt: 1 });
    if (created.outcome !== "accepted") throw new Error("setup failed");
    const result = processEventsInOrder(created.state, [event("open-1", { occurredAt: 10, sequence: 1 }), event("bad", { leadId: "missing", occurredAt: 11, sequence: 2 })], rules, 20);
    expect(result.accepted).toEqual(["open-1"]);
    expect(result.rejected).toHaveLength(1);
    expect(result.state.scores["lead-1"]).toBe(10);
  });
});
