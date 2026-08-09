import type { CreateEventInput, EngineState, EventProcessResult, ScoringRule, Timestamp, DomainEvent } from "./contracts.js";
import { compareEvents } from "./events.js";
import { processEvent } from "./engine.js";

export interface BatchResult {
  readonly state: EngineState;
  readonly results: readonly EventProcessResult[];
}

export interface BatchConfig {
  readonly abortOnFailure?: boolean;
  readonly allowDuplicateEvents?: boolean;
  readonly enableConflictResolution?: boolean;
}

export function processBatch(state: EngineState, inputs: readonly CreateEventInput[], rules: readonly ScoringRule[], evaluatedAt: Timestamp, config?: BatchConfig): BatchResult {
  let next = state;
  const results: EventProcessResult[] = [];
  
  // Deterministic chronological ordering
  const sortedInputs = [...inputs].sort((a, b) => 
    a.occurredAt - b.occurredAt || 
    a.sequence - b.sequence || 
    a.id.localeCompare(b.id)
  );

  const seenEventIds = new Set<string>();

  for (const input of sortedInputs) {
    if (config?.enableConflictResolution && (next.events[input.id] || seenEventIds.has(input.id))) {
      input.id = `${input.id}-resolved`;
    }
    
    seenEventIds.add(input.id);
    const result = processEvent(next, input, rules, evaluatedAt);
    
    if (config?.abortOnFailure && (!result.outcome || result.outcome !== "accepted" && result.outcome !== "duplicate")) {
      return { state, results: [] };
    }
    
    next = result.state;
    results.push(result);
  }
  return { state: next, results };
}
