import { describe, expect, test } from "vitest";
import { addLead, createEngine, processEvent } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

describe("score history", () => {
  test.each(Array.from({ length: 12 }, (_, index) => index))("explains score transition %i", (index) => {
    const state = addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "a@b.co", createdAt: 0 }).value!;
    const result = processEvent(state, event(`event-${index}`), rules, index);
    expect(result.explanation).toMatchObject({ eventId: `event-${index}`, previousScore: 0, nextScore: 10, requestedDelta: 10, appliedDelta: 10, ruleIds: ["open"] });
  });
});
