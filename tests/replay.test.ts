import { describe, expect, test } from "vitest";
import { addLead, createEngine, processEvent, replayLeadScoring } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

function state() { return addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@test.dev", createdAt: 0 }).value!; }

describe("chronological replay", () => {
  test.each(Array.from({ length: 25 }, (_, index) => index))("late event replay is stable %i", (offset) => {
    const late = processEvent(state(), event(`late-${offset}`, { type: "demo.request", occurredAt: 20 + offset, sequence: 1 }), rules, 100);
    const complete = processEvent(late.state, event(`early-${offset}`, { type: "email.open", occurredAt: 10 + offset, sequence: 0 }), rules, 100);
    expect(complete.state.scoreHistory["lead-1"]!.map((item) => item.eventId)).toEqual([`early-${offset}`, `late-${offset}`]);
    expect(complete.state.scores["lead-1"]).toBe(50);
  });

  test.each(Array.from({ length: 15 }, (_, index) => index))("explicit replay is idempotent %i", (index) => {
    const input = processEvent(state(), event(`event-${index}`), rules, 10).state;
    const one = replayLeadScoring(input, "lead-1", rules).value!;
    const two = replayLeadScoring(one.state, "lead-1", rules).value!;
    expect(two).toEqual(one);
  });
});
