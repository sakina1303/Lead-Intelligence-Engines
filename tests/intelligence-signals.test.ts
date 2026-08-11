import { describe, expect, test } from "vitest";
import type { EngineState, LeadSignalPolicy } from "../src/index.js";
import { intelligence } from "../src/index.js";

const policy: LeadSignalPolicy = {
  evaluatedAt: 1_000,
  recentWindowMs: 200,
  comparisonWindowMs: 200,
  staleAfterMs: 300,
  highIntentEventTypes: ["demo", "pricing"],
  decisionEventTypes: ["demo", "pricing", "proposal"],
  highIntentMinimum: 2,
  repeatedDecisionMinimum: 3,
  engagementChangeRatio: 1.5,
  concentrationRatio: 0.7,
  rapidProgressionMs: 100,
  fitDimension: "fit",
  engagementDimension: "engagement",
  strongDimensionThreshold: 70,
  weakDimensionThreshold: 20,
};

function stateWithEvents(eventTimes: readonly number[], types: readonly string[] = []): EngineState {
  const lead = { id: "lead-1", name: "Ada", email: "ada@example.test", company: "Engine", attributes: {}, lifecycle: "qualified" as const, createdAt: 100, updatedAt: 900 };
  const events = Object.fromEntries(eventTimes.map((occurredAt, index) => {
    const type = types[index] ?? "open";
    const event = { id: `event-${index}`, leadId: lead.id, type, category: type === "open" ? "engagement" as const : "intent" as const, occurredAt, sequence: index, attributes: {} };
    return [event.id, event];
  }));
  return {
    config: { scorePolicy: { floor: 0, cap: 500, conflictMode: "stack" }, qualificationPolicies: [], segmentPolicy: { rules: [], fallback: "none" } },
    leads: { [lead.id]: lead },
    events,
    eventIdsByLead: { [lead.id]: Object.keys(events) },
    scores: { [lead.id]: 100 },
    scoreHistory: {},
    scoreProjections: { [lead.id]: { leadId: lead.id, total: 100, dimensions: { fit: 80, engagement: 15 }, updatedAt: 1_000 } },
    qualifications: { [lead.id]: { leadId: lead.id, policyId: "qualified", state: "sales-qualified", evaluatedAt: 1_000, reasons: [] } },
    segments: {},
    profiles: {},
    leadHistory: {},
  };
}

function signalKinds(state: EngineState, selectedPolicy: LeadSignalPolicy = policy): readonly string[] {
  const result = intelligence.evaluateLeadIntelligence(state, "lead-1", selectedPolicy);
  if (!result.ok) throw new Error(result.errors.join(", "));
  return result.value.signals.map((signal) => signal.kind);
}

describe("explainable lead intelligence signals", () => {
  test("identifies increasing engagement from normalized explicit windows", () => {
    expect(signalKinds(stateWithEvents([650, 810, 850, 900, 950]))).toContain("increasing-engagement");
  });

  test("identifies declining engagement without consulting a clock", () => {
    expect(signalKinds(stateWithEvents([610, 650, 690, 900]))).toContain("declining-engagement");
  });

  test("adds qualification risk when qualified engagement declines", () => {
    expect(signalKinds(stateWithEvents([610, 650, 690, 900]))).toContain("qualification-risk");
  });

  test("uses configured event types for high-intent evidence", () => {
    const state = stateWithEvents([850, 900], ["demo", "pricing"]);
    const result = intelligence.evaluateLeadIntelligence(state, "lead-1", policy);
    if (!result.ok) throw new Error("expected intelligence report");
    const signal = result.value.signals.find((item) => item.kind === "high-intent");
    expect(signal?.evidence.eventIds).toEqual(["event-0", "event-1"]);
  });

  test("combines engagement growth and intent into opportunity acceleration", () => {
    expect(signalKinds(stateWithEvents([650, 820, 850, 900], ["open", "demo", "pricing", "demo"]))).toContain("opportunity-acceleration");
  });

  test("recognizes repeated decision-stage behavior", () => {
    expect(signalKinds(stateWithEvents([820, 850, 900], ["demo", "pricing", "proposal"]))).toContain("repeated-decision-behavior");
  });

  test("marks a lead stale using the supplied evaluation timestamp", () => {
    expect(signalKinds(stateWithEvents([600]))).toContain("stale-activity");
  });

  test("does not mark recent activity stale", () => {
    expect(signalKinds(stateWithEvents([900]))).not.toContain("stale-activity");
  });

  test("compares named score dimensions for fit and engagement mismatch", () => {
    expect(signalKinds(stateWithEvents([900]))).toContain("strong-fit-low-engagement");
  });

  test("detects the inverse score-dimension mismatch", () => {
    const state = stateWithEvents([900]);
    const inverse: EngineState = { ...state, scoreProjections: { "lead-1": { leadId: "lead-1", total: 100, dimensions: { fit: 10, engagement: 90 }, updatedAt: 1_000 } } };
    expect(signalKinds(inverse)).toContain("strong-engagement-weak-fit");
  });

  test("reports concentration when one category dominates recent behavior", () => {
    expect(signalKinds(stateWithEvents([820, 850, 900]))).toContain("behavioral-concentration");
  });

  test("uses lifecycle history as evidence of rapid progression", () => {
    const state = stateWithEvents([900]);
    const withHistory: EngineState = {
      ...state,
      leadHistory: { "lead-1": [
        { id: "c1", leadId: "lead-1", kind: "lifecycle-transitioned", occurredAt: 850, sequence: 1, previous: { lifecycle: "new" }, next: { lifecycle: "contacted" }, reason: "contacted" },
        { id: "c2", leadId: "lead-1", kind: "lifecycle-transitioned", occurredAt: 900, sequence: 2, previous: { lifecycle: "contacted" }, next: { lifecycle: "qualified" }, reason: "qualified" },
      ] },
    };
    expect(signalKinds(withHistory)).toContain("rapid-progression");
  });

  test("rejects missing leads with a stable error", () => {
    const result = intelligence.evaluateLeadIntelligence(stateWithEvents([]), "missing", policy);
    expect(result).toEqual({ ok: false, errors: ["lead missing does not exist"] });
  });

  test.each([
    ["recentWindowMs", 0, "recentWindowMs must be a positive finite number"],
    ["highIntentMinimum", 0, "highIntentMinimum must be a positive integer"],
    ["engagementChangeRatio", 1, "engagementChangeRatio must be greater than 1"],
    ["concentrationRatio", 2, "concentrationRatio must be in (0, 1]"],
  ] as const)("validates %s", (field, value, error) => {
    const result = intelligence.evaluateLeadIntelligence(stateWithEvents([]), "lead-1", { ...policy, [field]: value });
    expect(result).toEqual({ ok: false, errors: [error] });
  });

  test("returns identical reports for identical explicit inputs", () => {
    const state = stateWithEvents([650, 820, 850, 900], ["open", "demo", "pricing", "demo"]);
    expect(intelligence.evaluateLeadIntelligence(state, "lead-1", policy)).toEqual(intelligence.evaluateLeadIntelligence(state, "lead-1", policy));
  });
});
