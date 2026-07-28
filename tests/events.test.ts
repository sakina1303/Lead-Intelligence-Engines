import { describe, expect, test } from "vitest";
import { addLead, appendEvent, compareEvents, createEngine, createEvent, getLeadEvents, queryEvents } from "../src/index.js";
import { config, event } from "./helpers.js";

function stateWithLead() { return addLead(createEngine(config), { id: "lead-1", name: "Ada", email: "ada@test.dev", createdAt: 0 }).value!; }

describe("event ledger", () => {
  test.each([
    [event("a"), true], [event("", {}), false], [event("a", { leadId: "" }), false], [event("a", { type: "" }), false],
    [event("a", { occurredAt: -1 }), false], [event("a", { sequence: -1 }), false], [event("a", { attributes: { page: "home" } }), true],
  ])("validates event %#", (input, accepted) => expect(createEvent(input).ok).toBe(accepted));

  test.each([
    [100, 0, "a", 100, 0, "b", -1], [99, 9, "z", 100, 0, "a", -1], [100, 0, "a", 100, 1, "a", -1], [100, 0, "a", 100, 0, "a", 0], [101, 0, "a", 100, 9, "z", 1],
  ])("orders events %#", (atA, seqA, idA, atB, seqB, idB, sign) => {
    expect(Math.sign(compareEvents(event(idA, { occurredAt: atA, sequence: seqA }), event(idB, { occurredAt: atB, sequence: seqB })))).toBe(sign);
  });

  test.each([
    ["e1", 30, 3, "e2", 10, 1, ["e2", "e1"]], ["e1", 10, 3, "e2", 10, 2, ["e2", "e1"]], ["a", 10, 0, "b", 10, 0, ["a", "b"]],
  ])("keeps per-lead history canonical %#", (a, atA, seqA, b, atB, seqB, expected) => {
    let state = stateWithLead(); state = appendEvent(state, event(a, { occurredAt: atA, sequence: seqA })).value!.state; state = appendEvent(state, event(b, { occurredAt: atB, sequence: seqB })).value!.state;
    expect(getLeadEvents(state, "lead-1").map((item) => item.id)).toEqual(expected);
  });

  test("reports exact duplicate without changing state", () => {
    const first = appendEvent(stateWithLead(), event("same")).value!;
    const second = appendEvent(first.state, event("same")).value!;
    expect(second.duplicate).toBe(true); expect(second.state).toBe(first.state);
  });

  test("rejects conflicting duplicate ids", () => expect(appendEvent(appendEvent(stateWithLead(), event("same")).value!.state, event("same", { type: "other" })).ok).toBe(false));

  test.each([[{ type: "email.open" }, 1], [{ category: "intent" }, 0], [{ from: 101 }, 0], [{ to: 100 }, 1], [{ leadId: "other" }, 0]])("queries events %#", (query, count) => {
    const state = appendEvent(stateWithLead(), event("a")).value!.state; expect(queryEvents(state, query).length).toBe(count);
  });
});
