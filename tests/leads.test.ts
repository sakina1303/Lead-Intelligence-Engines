import { describe, expect, test } from "vitest";
import { addLead, allowedLifecycleTransitions, createEngine, createLead, transitionLifecycle, updateLeadAttributes } from "../src/index.js";
import { config } from "./helpers.js";

describe("lead lifecycle", () => {
  test.each([
    ["lead-1", "Ada Lovelace", "ada@example.test", 0, true],
    ["lead-2", "Bo", "bo@example.test", 1, true],
    ["", "Ada", "ada@example.test", 0, false],
    ["lead", "A", "ada@example.test", 0, false],
    ["lead", "Ada", "invalid", 0, false],
    ["lead", "Ada", "ada@example.test", -1, false],
  ])("creates valid and rejects invalid lead %s", (id, name, email, createdAt, accepted) => {
    expect(createLead({ id, name, email, createdAt }).ok).toBe(accepted);
  });

  test.each([
    ["new", "contacted", true], ["new", "nurturing", true], ["new", "qualified", true], ["new", "rejected", true],
    ["contacted", "nurturing", true], ["contacted", "qualified", true], ["contacted", "rejected", true],
    ["nurturing", "contacted", true], ["nurturing", "qualified", true], ["nurturing", "rejected", true],
    ["qualified", "converted", true], ["qualified", "rejected", true], ["converted", "new", false], ["rejected", "new", false],
  ] as const)("transition %s to %s is %s", (from, to, accepted) => {
    let state = createEngine(config);
    state = addLead(state, { id: "lead", name: "Ada", email: "ada@test.dev", lifecycle: from, createdAt: 1 }).value!;
    expect(transitionLifecycle(state, "lead", to, 2).ok).toBe(accepted);
  });

  test.each([[{}, true], [{ tier: "enterprise" }, true], [{ count: 3 }, true], [{ optedIn: false }, true]])("accepts scalar attributes %#", (attributes, accepted) => {
    expect(createLead({ id: "a", name: "Ada", email: "a@b.co", createdAt: 0, attributes }).ok).toBe(accepted);
  });

  test("updates attributes immutably", () => {
    const first = addLead(createEngine(config), { id: "lead", name: "Ada", email: "a@b.co", createdAt: 1 }).value!;
    const second = updateLeadAttributes(first, "lead", { tier: "gold" }, 2).value!;
    expect(first.leads.lead!.attributes).toEqual({});
    expect(second.leads.lead!.attributes).toEqual({ tier: "gold" });
  });

  test.each(["new", "contacted", "nurturing", "qualified", "converted", "rejected"] as const)("lists transitions for %s", (state) => {
    expect(Array.isArray(allowedLifecycleTransitions(state))).toBe(true);
  });
});
