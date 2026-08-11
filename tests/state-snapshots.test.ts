import { describe, expect, test } from "vitest";
import type { EngineState } from "../src/index.js";
import { stateSnapshots } from "../src/index.js";

function populatedState(): EngineState {
  const lead = {
    id: "lead-1",
    name: "Ada Lovelace",
    email: "ada@example.test",
    company: "Analytical Engines",
    attributes: { region: "emea", employees: 75 },
    lifecycle: "qualified" as const,
    createdAt: 100,
    updatedAt: 300,
  };
  const event = {
    id: "event-1",
    leadId: lead.id,
    type: "pricing-viewed",
    category: "intent" as const,
    occurredAt: 200,
    sequence: 1,
    attributes: { plan: "enterprise" },
  };

  return {
    config: {
      scorePolicy: { cap: 500, floor: -50, conflictMode: "stack" },
      qualificationPolicies: [],
      segmentPolicy: { rules: [], fallback: "unsegmented" },
    },
    leads: { [lead.id]: lead },
    events: { [event.id]: event },
    eventIdsByLead: { [lead.id]: [event.id] },
    scores: { [lead.id]: 45 },
    scoreProjections: {
      [lead.id]: { leadId: lead.id, total: 45, dimensions: { intent: 45 }, updatedAt: 200 },
    },
    scoreHistory: {
      [lead.id]: [{ eventId: event.id, leadId: lead.id, occurredAt: 200, previousScore: 0, nextScore: 45, requestedDelta: 45, appliedDelta: 45, ruleIds: ["intent-rule"], reason: "scored" }],
    },
    qualifications: {
      [lead.id]: { leadId: lead.id, policyId: "enterprise", state: "sales-qualified", evaluatedAt: 300, reasons: ["score threshold met"] },
    },
    segments: { [lead.id]: { leadId: lead.id, segment: "high-intent", matchedRuleId: "high-intent-rule" } },
    profiles: {
      [lead.id]: { leadId: lead.id, consent: { email: "granted", phone: "unknown", updatedAt: 150 }, source: "webinar", tags: ["enterprise"] },
    },
    leadHistory: {
      [lead.id]: [{ id: "change-1", leadId: lead.id, kind: "created", occurredAt: 100, sequence: 1, previous: {}, next: { lifecycle: "new" }, reason: "created" }],
    },
  };
}

describe("deterministic state snapshots", () => {
  test("round-trips every engine projection without discarding domain state", () => {
    const state = populatedState();
    const snapshot = stateSnapshots.serializeAndCompressState(state);

    expect(stateSnapshots.decompressAndDeserializeState(snapshot)).toEqual(state);
  });

  test("hashes equivalent records independently of insertion order", () => {
    const state = populatedState();
    const reordered: EngineState = {
      ...state,
      scores: { "lead-2": 5, "lead-1": 45 },
    };
    const sameValuesDifferentOrder: EngineState = {
      ...state,
      scores: { "lead-1": 45, "lead-2": 5 },
    };

    expect(stateSnapshots.computeStateHash(reordered)).toBe(stateSnapshots.computeStateHash(sameValuesDifferentOrder));
  });

  test("detects payloads changed after snapshot creation", () => {
    const snapshot = stateSnapshots.serializeAndCompressState(populatedState());
    const decoded = JSON.parse(Buffer.from(snapshot.payload, "base64").toString("utf8")) as { scores: Record<string, number> };
    decoded.scores["lead-1"] = 999;

    expect(() => stateSnapshots.decompressAndDeserializeState({
      ...snapshot,
      payload: Buffer.from(JSON.stringify(decoded), "utf8").toString("base64"),
    })).toThrow("snapshot integrity check failed");
  });

  test("rejects malformed snapshot payloads", () => {
    expect(() => stateSnapshots.decompressAndDeserializeState({ version: 1, payload: "%%%", hash: "00000000" })).toThrow(
      "snapshot payload is not valid base64-encoded JSON",
    );
  });

  test("state proofs cover event attributes and full engine projections", () => {
    const state = populatedState();
    const original = stateSnapshots.computeStateHash(state);
    const changed: EngineState = {
      ...state,
      events: { ...state.events, "event-1": { ...state.events["event-1"]!, attributes: { plan: "starter" } } },
    };
    expect(stateSnapshots.computeStateHash(changed)).not.toBe(original);
  });

  test("generic digests are stable across record insertion order", () => {
    expect(stateSnapshots.computeDeterministicDigest({ alpha: 1, beta: 2 })).toBe(
      stateSnapshots.computeDeterministicDigest({ beta: 2, alpha: 1 }),
    );
  });
});
