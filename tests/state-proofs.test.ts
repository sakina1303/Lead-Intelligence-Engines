import { describe, expect, test } from "vitest";
import type { EngineState } from "../src/index.js";
import { eventLedger, stateSnapshots } from "../src/index.js";

function proofState(): EngineState {
  const state = stateSnapshots.createEngineState();
  return {
    ...state,
    leads: { lead: { id: "lead", name: "Ada", email: "ada@example.test", company: "Engine", attributes: { tier: "enterprise" }, lifecycle: "new", createdAt: 1, updatedAt: 1 } },
    events: { event: { id: "event", leadId: "lead", type: "demo", category: "intent", occurredAt: 2, sequence: 1, attributes: { channel: "web" } } },
    eventIdsByLead: { lead: ["event"] },
    scores: { lead: 25 },
  };
}

describe("state integrity proofs", () => {
  test("uses the canonical full-state digest", () => {
    const state = proofState();
    expect(eventLedger.generateStateProof(state, 100).stateHash).toBe(stateSnapshots.computeStateHash(state));
  });

  test("changes the entity root when event evidence changes", () => {
    const state = proofState();
    const changed: EngineState = { ...state, events: { event: { ...state.events["event"]!, attributes: { channel: "partner" } } } };
    expect(eventLedger.generateStateProof(changed, 100).merkleRoot).not.toBe(eventLedger.generateStateProof(state, 100).merkleRoot);
  });

  test("keeps proof content stable when only the supplied audit timestamp changes", () => {
    const first = eventLedger.generateStateProof(proofState(), 100);
    const second = eventLedger.generateStateProof(proofState(), 200);
    expect(second).toEqual({ ...first, generatedAt: 200 });
  });

  test("rejects non-finite audit timestamps", () => {
    expect(() => eventLedger.generateStateProof(proofState(), Number.NaN)).toThrow("state proof timestamp must be finite");
  });
});
