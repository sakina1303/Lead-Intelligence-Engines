import { expect, test } from "vitest";
import { addLead, buildIsolationForest, buildMarkovConversionModel, createEngine, isolationForestPredict } from "../src/index.js";
import { config } from "./helpers.js";

test("median isolation forest is stable for the same ledger state", () => {
  const first = addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@example.test", createdAt: 1, attributes: { employees: 10 } });
  if (!first.ok) throw new Error("setup failed");
  const second = addLead(first.value, { id: "lead-2", name: "Lin", email: "lin@example.test", createdAt: 2, attributes: { employees: 200 } });
  if (!second.ok) throw new Error("setup failed");
  const forest = buildIsolationForest(second.value, 3, 2);
  expect(forest).toEqual(buildIsolationForest(second.value, 3, 2));
  expect(isolationForestPredict(second.value.leads["lead-1"]!, second.value, forest)).toBeGreaterThanOrEqual(0);
});

test("conversion model derives probabilities from recorded lifecycle departures", () => {
  const base = createEngine(config);
  const state = { ...base, leadHistory: { "lead-1": [{ id: "change-1", leadId: "lead-1", kind: "lifecycle-transitioned" as const, occurredAt: 5, sequence: 1, previous: { lifecycle: "qualified" }, next: { lifecycle: "converted" }, reason: "contract signed" }, { id: "change-2", leadId: "lead-1", kind: "lifecycle-transitioned" as const, occurredAt: 6, sequence: 2, previous: { lifecycle: "qualified" }, next: { lifecycle: "rejected" }, reason: "disqualified" }] } };
  expect(buildMarkovConversionModel(state).find((item) => item.lifecycle === "qualified")?.conversionProb).toBe(0.5);
});
