import type { CreateEventInput, EngineState, EventProcessResult, ScoringRule, Timestamp } from "./contracts.js";
import { compareEvents } from "./events.js";
import { processEvent } from "./engine.js";

export interface BatchResult {
  readonly state: EngineState;
  readonly results: readonly EventProcessResult[];
}

export function processBatch(state: EngineState, inputs: readonly CreateEventInput[], rules: readonly ScoringRule[], evaluatedAt: Timestamp): BatchResult {
  let next = state;
  const results: EventProcessResult[] = [];
  for (const input of [...inputs].sort(compareEvents)) {
    const result = processEvent(next, input, rules, evaluatedAt);
    next = result.state;
    results.push(result);
  }
  return { state: next, results };
}
