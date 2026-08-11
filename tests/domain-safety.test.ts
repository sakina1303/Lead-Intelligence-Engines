import { describe, expect, test } from "vitest";
import {
  addLead,
  createEngine,
  engine,
  qualification,
  segmentation,
} from "../src/index.js";
import { config } from "./helpers.js";

describe("domain safety contracts", () => {
  test("transaction failures roll back without pretending to return a result", () => {
    const state = createEngine(config);
    const outcome = engine.executeInTransaction(state, () => {
      throw new Error("policy rejected");
    });
    expect(outcome).toEqual({ state, committed: false, error: "policy rejected" });
  });

  test("fraud analysis consumes typed event coordinates", () => {
    const lead = addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@example.test", createdAt: 1 });
    if (!lead.ok) throw new Error("setup failed");
    const state = {
      ...lead.value,
      events: {
        first: { id: "first", leadId: "lead-1", type: "visit", category: "engagement" as const, occurredAt: 1_000, sequence: 0, attributes: { latitude: 0, longitude: 0 } },
        second: { id: "second", leadId: "lead-1", type: "visit", category: "engagement" as const, occurredAt: 2_000, sequence: 1, attributes: { latitude: 50, longitude: 50 } },
      },
      eventIdsByLead: { "lead-1": ["first", "second"] },
    };
    const result = engine.analyzeLeadFraudRisk(state, "lead-1", { maxEventsPerSecond: 100, impossibleTravelSpeedMetersPerSecond: 1_000 });
    expect(result.flags).toContain("impossible_travel");
  });

  test("capacity routing remains inside qualification states", () => {
    const initial = { leadId: "lead-1", policyId: "p", state: "sales-qualified" as const, evaluatedAt: 10, reasons: [] };
    const routed = qualification.applyCapacityRouting(initial, [{ state: "sales-qualified", currentLoad: 2, maxCapacity: 2, overflowState: "marketing-qualified" }]);
    expect(routed.finalResult.state).toBe("marketing-qualified");
  });

  test("dynamic segmentation produces base and advanced policy forms", () => {
    const policy = segmentation.generateDynamicPolicy("policy", "emerging", [{ templateId: "high_value_geo", params: { country: "IN", min_score: 50 } }]);
    expect(policy.rules[0]?.requiredAttributes).toEqual([{ key: "country", equals: "IN" }]);
    expect(policy.advancedRules[0]?.requiredAttributes).toEqual({ country: "IN" });
  });
});
