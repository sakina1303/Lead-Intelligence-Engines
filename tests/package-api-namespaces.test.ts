import { describe, expect, test } from "vitest";
import {
  analytics,
  batches,
  configuration,
  engine,
  eventLedger,
  events,
  intelligenceModels,
  leadHistory,
  leadProfiles,
  qualification,
  ranking,
  ruleExpressions,
  scoringRules,
  scoreProjections,
  segmentation,
  simulations,
  stateSnapshots,
} from "../src/index.js";

describe("package-root domain namespaces", () => {
  test.each([
    [configuration, "validateEngineConfig"],
    [engine, "processEvent"],
    [batches, "processBatch"],
    [leadProfiles, "createLead"],
    [leadHistory, "recordLeadChange"],
    [events, "createEvent"],
    [eventLedger, "appendEvent"],
    [scoringRules, "validateRule"],
    [ruleExpressions, "evaluateRuleExpression"],
    [scoreProjections, "scoreEvent"],
    [qualification, "evaluateQualification"],
    [segmentation, "assignSegment"],
    [ranking, "rankLeads"],
    [analytics, "summarize"],
    [simulations, "evaluateWhatIfScenario"],
    [intelligenceModels, "buildMarkovConversionModel"],
    [stateSnapshots, "serializeAndCompressState"],
  ])("exposes %s through the package root", (namespace, capability) => {
    expect(namespace).toHaveProperty(capability);
    expect(namespace[capability as keyof typeof namespace]).toBeTypeOf("function");
  });
});
