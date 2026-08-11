import { describe, expect, test } from "vitest";
import { configuration, ruleExpressions } from "../src/index.js";

describe("untrusted input boundaries", () => {
  test("migrates known legacy configuration fields", () => {
    const result = configuration.migrateConfigV1ToV2({ maxScore: 500, minScore: -10, thresholds: [{ name: "Hot Lead", value: 80 }] });
    expect(result).toMatchObject({ ok: true, value: { scorePolicy: { cap: 500, floor: -10 }, qualificationPolicies: [{ id: "qual-hot-lead", minimumScore: 80 }] } });
  });

  test.each([null, undefined, 12, "legacy", [], { thresholds: [null, "bad"] }])("handles malformed legacy input %#", (input) => {
    const result = configuration.migrateConfigV1ToV2(input);
    expect(result.ok).toBe(true);
  });

  test("AST member evaluation only indexes typed object values", () => {
    const expression: ruleExpressions.MemberExpressionNode = {
      type: "MemberExpression",
      object: { type: "Identifier", name: "lead" } as ruleExpressions.IdentifierNode,
      property: { type: "Identifier", name: "industry" } as ruleExpressions.IdentifierNode,
      computed: false,
    };
    expect(ruleExpressions.evaluateAST(expression, { lead: { industry: "software" } })).toBe("software");
    expect(ruleExpressions.evaluateAST(expression, { lead: "not-an-object" })).toBeUndefined();
  });
});
