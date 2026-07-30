import { describe, expect, test } from "vitest";
import { addLead, createEngine, processBatch, processEvent } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

function state() { return addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@test.dev", createdAt: 0 }).value!; }

describe("batch processing", () => {
  test.each([
    [[event("a")], 10, ["accepted"]], [[event("a"), event("b")], 20, ["accepted", "accepted"]],
    [[event("b", { occurredAt: 2 }), event("a", { occurredAt: 1 })], 20, ["accepted", "accepted"]],
    [[event("a"), event("a")], 10, ["accepted", "duplicate"]], [[event("bad", { leadId: "missing" })], 0, ["rejected"]],
  ])("processes deterministic batch %#", (inputs, score, outcomes) => {
    const result = processBatch(state(), inputs, rules, 10); expect(result.state.scores["lead-1"]).toBe(score); expect(result.results.map((item) => item.outcome)).toEqual(outcomes);
  });

  test.each(Array.from({ length: 20 }, (_, index) => index + 1))("adds repeated event %i", (count) => {
    const inputs = Array.from({ length: count }, (_, index) => event(`e${index}`, { occurredAt: index, sequence: index }));
    expect(processBatch(state(), inputs, rules, 100).state.scores["lead-1"]).toBe(Math.min(count * 10, 100));
  });

  test.each(Array.from({ length: 20 }, (_, index) => index))("matches batch order %i", (offset) => {
    const input = [event("late", { occurredAt: 10 + offset }), event("early", { occurredAt: offset })];
    expect(processBatch(state(), input, rules, 100).results.map((result) => result.event?.id)).toEqual(["early", "late"]);
  });

  test.each(Array.from({ length: 20 }, (_, index) => index))("remains idempotent for duplicate %i", (index) => {
    const input = event(`same-${index}`); const first = processEvent(state(), input, rules, 1); const second = processEvent(first.state, input, rules, 2);
    expect(second.outcome).toBe("duplicate"); expect(second.state.scores["lead-1"]).toBe(10);
  });
});
