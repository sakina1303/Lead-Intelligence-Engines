import { describe, expect, test } from "vitest";
import { addLead, createEngine, processEvent } from "../src/index.js";
import { config, event, rules } from "./helpers.js";

describe("domain error outcomes", () => {
  test.each(Array.from({ length: 12 }, (_, index) => index))("rejects unknown lead %i", (index) => {
    const result = processEvent(createEngine(config), event(`bad-${index}`, { leadId: `missing-${index}` }), rules, 0);
    expect(result.outcome).toBe("rejected"); expect(result.errors?.[0]).toContain("does not exist");
  });
});
