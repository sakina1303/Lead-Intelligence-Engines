import { expect, test } from "vitest";
import { calibrateThresholds, createEngine } from "../src/index.js";
import { config } from "./helpers.js";

test("threshold calibration records the caller supplied evaluation time", () => {
  const threshold = calibrateThresholds(createEngine(config), "percentile", 4321);
  expect(threshold.lastCalibratedAt).toBe(4321);
});
