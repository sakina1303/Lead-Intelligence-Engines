import { describe, expect, test } from "vitest";
import { addLead, assignSegment, createEngine, evaluateQualification, processEvent, rankLeads, summarize } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

function engineWithLead(id = "lead-1") { return addLead(createEngine(config), { id, name: `Lead ${id}`, email: `${id}@test.dev`, createdAt: 0 }).value!; }

describe("lead intelligence", () => {
  test.each([
    [0, [], "unqualified"], [29, [event("a")], "unqualified"], [30, [event("a")], "marketing-qualified"], [31, [event("a")], "marketing-qualified"],
  ])("qualifies from score and event evidence %#", (score, events, expected) => expect(evaluateQualification(engineWithLead().leads["lead-1"]!, score, events, config.qualificationPolicies[0]!, 10).state).toBe(expected));

  test.each([
    [0, "emerging"], [30, "qualified"], [50, "high-intent"], [100, "high-intent"],
  ])("assigns segment %#", (score, segment) => {
    const lead = engineWithLead().leads["lead-1"]!;
    const qualification = evaluateQualification(lead, score, [event("a")], config.qualificationPolicies[0]!, 10);
    expect(assignSegment(lead, score, [event("a")], qualification, config.segmentPolicy).segment).toBe(segment);
  });

  test("refreshes qualification and segment after scoring", () => {
    const result = processEvent(engineWithLead(), event("demo", { type: "demo.request", category: "intent" }), rules, 1);
    expect(result.qualification?.state).toBe("marketing-qualified"); expect(result.segment?.segment).toBe("qualified");
  });

  test.each([
    [[["a", 10], ["b", 20]], ["b", "a"]], [[["b", 10], ["a", 10]], ["a", "b"]], [[["a", 0], ["b", 0]], ["a", "b"]],
  ])("ranks leads stably %#", (items, expected) => {
    let state = createEngine(config);
    for (const [id, score] of items as [string, number][]) { state = addLead(state, { id, name: id + id, email: `${id}@test.dev`, createdAt: 0 }).value!; state = { ...state, scores: { ...state.scores, [id]: score } }; }
    expect(rankLeads(state).map((entry) => entry.leadId)).toEqual(expected);
  });

  test.each([[0, 0], [1, 10], [2, 20], [3, 30], [4, 40]])("summarizes score %#", (count, score) => {
    let state = createEngine(config);
    for (let index = 0; index < count; index++) { const id = `l${index}`; state = addLead(state, { id, name: `Lead ${index}`, email: `l${index}@test.dev`, createdAt: 0 }).value!; state = { ...state, scores: { ...state.scores, [id]: score / Math.max(1, count) } }; }
    expect(summarize(state).totalScore).toBe(score);
  });
});
