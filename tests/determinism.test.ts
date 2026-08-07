import { describe, expect, test } from "vitest";
import { addLead, createEngine, processBatch, rankLeads, summarize } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

describe("deterministic domain operations", () => {
  test.each(Array.from({ length: 15 }, (_, index) => index))("repeats identical workflow %i", (index) => {
    const make = () => addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "a@b.co", createdAt: index }).value!;
    const inputs = [event(`b-${index}`, { occurredAt: 2 }), event(`a-${index}`, { occurredAt: 1 })];
    const one = processBatch(make(), inputs, rules, index).state;
    const two = processBatch(make(), inputs, rules, index).state;
    expect({ one, rank: rankLeads(one), summary: summarize(one) }).toEqual({ two, rank: rankLeads(two), summary: summarize(two) });
  });
});
