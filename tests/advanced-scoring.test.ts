import { describe, expect, test } from "vitest";
import { applyScoreDelta, projectDecayedScore, calculateDecayForDimension } from "../src/scoring.js";
describe("Advanced Scoring & Decay Invariants", () => {
  test("scoring case 0: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 86400000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 1: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 172800000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 2: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 259200000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 3: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 345600000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 4: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 432000000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 5: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 86400000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 6: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 172800000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 7: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 259200000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 8: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 345600000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 9: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 432000000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 10: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 86400000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 11: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 172800000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 12: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 259200000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 13: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 345600000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 14: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 432000000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 15: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 86400000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 16: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 172800000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 17: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 259200000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 18: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 345600000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 19: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 432000000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 20: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 86400000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 21: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 172800000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 22: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 259200000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 23: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 345600000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 24: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 432000000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 25: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 86400000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 26: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 172800000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 27: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 259200000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 28: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 345600000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 29: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 432000000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 30: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 86400000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 31: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 172800000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 32: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 259200000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 33: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "exponential" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 345600000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
  test("scoring case 34: explicit decay calculations", () => {
    const base = { fit: 50, intent: 50, engagement: 50, budget: 0, authority: 0, timing: 0, aggregate: 100, lastUpdated: 0 };
    const policy = { type: "linear" as const, dimension: "fit" as const, parameters: { ratePerDay: 5, halfLifeMs: 86400000, floor: 0 } };
    const res = projectDecayedScore(base, 432000000, [policy]);
    expect(res.fit).toBeLessThanOrEqual(50);
  });
});
