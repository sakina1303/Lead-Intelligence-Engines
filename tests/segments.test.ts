import { describe, expect, test } from "vitest";
import { addLead, assignSegment, createEngine } from "../src/index.js";
import { config, event } from "./helpers.js";

describe("segmentation policy", () => {
  test.each(Array.from({ length: 12 }, (_, index) => index))("selects priority segment %i", (index) => {
    const state = addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "a@b.co", createdAt: 0, attributes: { tier: index % 2 === 0 ? "gold" : "silver" } }).value!;
    const policy = { fallback: "other", rules: [{ id: "low", name: "low", priority: 1 }, { id: "gold", name: "gold", priority: 2, requiredAttributes: [{ key: "tier", equals: "gold" as const }] }] };
    expect(assignSegment(state.leads["lead-1"]!, index, [event(`e${index}`)], undefined, policy).segment).toBe(index % 2 === 0 ? "gold" : "low");
  });
});
