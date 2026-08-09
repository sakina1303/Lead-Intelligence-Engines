import type { CreateEventInput, EngineState, EventProcessResult, ScoringRule, Timestamp } from "./contracts.js";
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
    let eventInput = input;
    if (config?.enableConflictResolution && (next.events[eventInput.id] || seenEventIds.has(eventInput.id))) {
      eventInput = { ...eventInput, id: `${eventInput.id}-resolved` };
    }
    
    seenEventIds.add(eventInput.id);
    const result = processEvent(next, eventInput, rules, evaluatedAt);
    
    if (config?.abortOnFailure && (!result.outcome || result.outcome !== "accepted" && result.outcome !== "duplicate")) {
      return { state, results: [] };
    }
    
    next = result.state;
    results.push(result);
  }
  return { state: next, results };
}
