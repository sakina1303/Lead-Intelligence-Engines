import { describe, expect, test } from "vitest";
import { addLead, createEngine, evaluateQualification } from "../src/index.js";
import { event } from "./helpers.js";

describe("qualification policy conditions", () => {
  test.each(Array.from({ length: 12 }, (_, index) => index))("requires event type %i", (index) => {
    const state = addLead(createEngine({ scorePolicy: { cap: 100, floor: 0, conflictMode: "stack" }, qualificationPolicies: [], segmentPolicy: { fallback: "none", rules: [] } }), { id: "lead", name: "Ada", email: "a@b.co", createdAt: 0 }).value!;
    const result = evaluateQualification(state.leads.lead!, 100, [event(`e${index}`, { leadId: "lead", type: index % 2 === 0 ? "purchase" : "view" })], { id: "p", minimumScore: 10, requiredEventTypes: ["purchase"], qualification: "sales-qualified" }, 1);
    expect(result.state).toBe(index % 2 === 0 ? "sales-qualified" : "unqualified");
  });
});
