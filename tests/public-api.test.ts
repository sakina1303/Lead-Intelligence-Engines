import { describe, expect, test } from "vitest";
import * as domain from "../src/index.js";

describe("public package API", () => {
  test.each(["createEngine", "createLead", "appendEvent", "processEvent", "processBatch", "rankLeads", "summarize", "validateEngineConfig", "replayLeadScoring"] as const)("exports %s", (name) => {
    expect(domain[name]).toBeTypeOf("function");
  });
});
