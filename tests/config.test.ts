import { describe, expect, test } from "vitest";
import { validateEngineConfig, validateRuleSet } from "../src/index.js";
import { config, rules } from "./helpers.js";

describe("configuration validation", () => {
  test.each([
    [config, true], [{ ...config, scorePolicy: { ...config.scorePolicy, cap: -1 } }, false], [{ ...config, scorePolicy: { ...config.scorePolicy, floor: 101 } }, false],
    [{ ...config, qualificationPolicies: [...config.qualificationPolicies, config.qualificationPolicies[0]!] }, false],
    [{ ...config, segmentPolicy: { ...config.segmentPolicy, fallback: "" } }, false],
    [{ ...config, segmentPolicy: { ...config.segmentPolicy, rules: [{ id: "a", name: "A", priority: 1, minimumScore: 10, maximumScore: 5 }] } }, false],
  ])("validates engine config %#", (input, accepted) => expect(validateEngineConfig(input).ok).toBe(accepted));

  test.each([[rules, true], [[...rules, { ...rules[0]!, id: "open" }], false], [[{ ...rules[0]!, condition: { attributes: [{ key: "", exists: true }] } }], false]])("validates rules %#", (input, accepted) => expect(validateRuleSet(input).ok).toBe(accepted));
});
