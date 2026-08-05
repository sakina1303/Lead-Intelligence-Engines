import { describe, expect, test } from "vitest";
import { addLead, createEngine, processEvent, summarize } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

describe("analytics summaries", () => {
  test.each(Array.from({ length: 12 }, (_, index) => index))("counts event category %i", (index) => {
    const state = addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "a@b.co", createdAt: 0 }).value!;
    const next = processEvent(state, event(`e${index}`, { category: index % 2 === 0 ? "engagement" : "intent" }), rules, 1).state;
    expect(summarize(next).eventsByCategory[index % 2 === 0 ? "engagement" : "intent"]).toBe(1);
  });
});
