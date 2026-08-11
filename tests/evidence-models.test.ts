import { describe, expect, test } from "vitest";
import type { DomainEvent, EngineState } from "../src/index.js";
import { analytics, intelligence, scoreProjections } from "../src/index.js";

function event(id: string, type: string, occurredAt: number, sequence: number): DomainEvent {
  return { id, leadId: "lead-1", type, category: "engagement", occurredAt, sequence, attributes: {} };
}

describe("evidence-based attribution", () => {
  test("uses event id to break equal timestamp and sequence ties", () => {
    const attributed = scoreProjections.calculateEventAttribution(
      [event("b", "later-id", 10, 1), event("a", "earlier-id", 10, 1)],
      100,
      "first-touch",
    );
    expect(attributed[0]?.eventId).toBe("a");
  });

  test("Markov attribution gives more credit to a type carrying more path information", () => {
    const attributed = scoreProjections.calculateEventAttribution(
      [event("a", "open", 1, 1), event("b", "demo", 2, 2), event("c", "open", 3, 3)],
      100,
      "markov",
    );
    const demo = attributed.find((item) => item.eventType === "demo");
    const open = attributed.filter((item) => item.eventType === "open").reduce((sum, item) => sum + item.percentage, 0);
    expect(open).toBeGreaterThan(demo?.percentage ?? 0);
    expect(attributed.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(1);
  });

  test("Shapley coverage divides value by unique type and occurrence", () => {
    const attributed = scoreProjections.calculateEventAttribution(
      [event("a", "open", 1, 1), event("b", "open", 2, 2), event("c", "demo", 3, 3)],
      120,
      "shapley",
    );
    expect(attributed.map((item) => item.contributionScore)).toEqual([30, 30, 60]);
    expect(attributed.reduce((sum, item) => sum + item.percentage, 0)).toBe(1);
  });
});

function experimentState(): EngineState {
  const state = {
    config: { scorePolicy: { floor: 0, cap: 100, conflictMode: "stack" as const }, qualificationPolicies: [], segmentPolicy: { rules: [], fallback: "none" } },
    leads: {}, events: {}, eventIdsByLead: {}, scores: {}, scoreHistory: {}, scoreProjections: {}, qualifications: {}, segments: {}, profiles: {}, leadHistory: {},
  };
  return {
    ...state,
    leads: Object.fromEntries(["c1", "c2", "c3", "v1", "v2", "v3"].map((id) => [id, { id, name: id, email: `${id}@example.test`, company: "", attributes: {}, lifecycle: "new" as const, createdAt: 1, updatedAt: 1 }])),
    scores: { c1: 10, c2: 20, c3: 30, v1: 40, v2: 50, v3: 60 },
  };
}

describe("deterministic experiment decisions", () => {
  test("uses observed score variance when comparing cohorts", () => {
    const result = analytics.simulateABTest(experimentState(), ["c1", "c2", "c3"], ["v1", "v2", "v3"], { targetMetric: "average_score", confidenceLevel: 0.95 });
    expect(result.controlMetric).toBe(20);
    expect(result.variantMetric).toBe(50);
    expect(result.isStatisticallySignificant).toBe(true);
    expect(result.pValueEstimate).toBeLessThan(0.05);
  });

  test("exploitation chooses the best rate with a stable id tie-break", () => {
    expect(analytics.epsilonGreedyAllocation([
      { id: "beta", successCount: 8, totalTrials: 10 },
      { id: "alpha", successCount: 4, totalTrials: 5 },
    ], 0.2, 0.9)).toBe("alpha");
  });

  test("exploration chooses the least-observed arm with a stable id tie-break", () => {
    expect(analytics.epsilonGreedyAllocation([
      { id: "beta", successCount: 0, totalTrials: 1 },
      { id: "alpha", successCount: 0, totalTrials: 1 },
      { id: "gamma", successCount: 9, totalTrials: 10 },
    ], 0.2, 0.1)).toBe("alpha");
  });

  test.each([
    [[], 0.1, 0.5, "at least one bandit arm is required"],
    [[{ id: "a", successCount: 1, totalTrials: 1 }], 2, 0.5, "epsilon must be in [0, 1]"],
    [[{ id: "a", successCount: 1, totalTrials: 1 }], 0.1, -1, "explorationValue must be in [0, 1]"],
  ] as const)("rejects invalid allocation inputs %#", (arms, epsilon, explorationValue, error) => {
    expect(() => analytics.epsilonGreedyAllocation(arms, epsilon, explorationValue)).toThrow(error);
  });
});

describe("historical lifecycle models", () => {
  test("derives transition probabilities from recorded lifecycle evidence", () => {
    const state = experimentState();
    const historical: EngineState = {
      ...state,
      leads: {
        ...state.leads,
        c1: { ...state.leads["c1"]!, lifecycle: "qualified" },
        c2: { ...state.leads["c2"]!, lifecycle: "converted" },
      },
      leadHistory: {
        c1: [{ id: "h1", leadId: "c1", kind: "lifecycle-transitioned", occurredAt: 10, sequence: 1, previous: { lifecycle: "new" }, next: { lifecycle: "qualified" }, reason: "qualified" }],
        c2: [
          { id: "h2", leadId: "c2", kind: "lifecycle-transitioned", occurredAt: 10, sequence: 1, previous: { lifecycle: "new" }, next: { lifecycle: "contacted" }, reason: "contacted" },
          { id: "h3", leadId: "c2", kind: "lifecycle-transitioned", occurredAt: 20, sequence: 2, previous: { lifecycle: "contacted" }, next: { lifecycle: "converted" }, reason: "converted" },
        ],
      },
    };

    const model = intelligence.buildLifecycleMarkovChain(historical);
    const newRow = model.matrix[model.states.indexOf("new")]!;
    expect(newRow[model.states.indexOf("contacted")]).toBe(0.5);
    expect(newRow[model.states.indexOf("qualified")]).toBe(0.5);
    expect(model.matrix[model.states.indexOf("contacted")]?.[model.states.indexOf("converted")]).toBe(1);
  });

  test("treats observed states without departures as absorbing", () => {
    const model = intelligence.buildLifecycleMarkovChain(experimentState());
    const newIndex = model.states.indexOf("new");
    expect(model.matrix[newIndex]?.[newIndex]).toBe(1);
  });
});
