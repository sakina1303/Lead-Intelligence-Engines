import type { CreateEventInput, EngineState, EventProcessResult, ScoringRule, Timestamp } from "../contracts.js";
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

// --- Chunked Batch Processing ---

export interface ChunkedBatchResult {
  readonly finalState: EngineState;
  readonly chunksProcessed: number;
  readonly totalEventsProcessed: number;
  readonly failures: number;
  readonly results: readonly EventProcessResult[];
}

export function processBatchInChunks(
  state: EngineState,
  inputs: readonly CreateEventInput[],
  rules: readonly ScoringRule[],
  evaluatedAt: Timestamp,
  chunkSize: number,
  config?: BatchConfig
): ChunkedBatchResult {
  let currentState = state;
  let allResults: EventProcessResult[] = [];
  let failures = 0;
  
  for (let i = 0; i < inputs.length; i += chunkSize) {
    const chunk = inputs.slice(i, i + chunkSize);
    const { state: nextState, results } = processBatch(currentState, chunk, rules, evaluatedAt, config);
    
    currentState = nextState;
    allResults = allResults.concat(results);
    
    // Count failures
    for (const res of results) {
      if (res.outcome !== "accepted" && res.outcome !== "duplicate") {
        failures++;
      }
    }
    
    if (config?.abortOnFailure && failures > 0) {
      return {
        finalState: state, // full rollback on first chunk failure
        chunksProcessed: Math.floor(i / chunkSize) + 1,
        totalEventsProcessed: allResults.length,
        failures,
        results: allResults
      };
    }
  }
  
  return {
    finalState: currentState,
    chunksProcessed: Math.ceil(inputs.length / chunkSize),
    totalEventsProcessed: allResults.length,
    failures,
    results: allResults,
  };
}

// --- Batch Deduplication and Normalization ---

export function deduplicateAndNormalizeBatch(inputs: readonly CreateEventInput[]): readonly CreateEventInput[] {
  const normalized: CreateEventInput[] = [];
  const seenIds = new Set<string>();
  
  // Sort reverse chronologically to keep the latest event when duplicate IDs exist
  const reversed = [...inputs].sort((a, b) => b.occurredAt - a.occurredAt);
  
  for (const input of reversed) {
    if (!seenIds.has(input.id)) {
      seenIds.add(input.id);
      normalized.push(input);
    }
  }
  
  // Restore chronological order
  return normalized.sort((a, b) => a.occurredAt - b.occurredAt);
}

// --- State Rollback / Checkpointing ---

export interface Checkpoint {
  readonly id: string;
  readonly state: EngineState;
  readonly timestamp: number;
}

export class BatchTransactionManager {
  private checkpoints = new Map<string, Checkpoint>();
  
  public createCheckpoint(id: string, state: EngineState, timestamp: number): void {
    this.checkpoints.set(id, { id, state, timestamp });
  }
  
  public rollbackToCheckpoint(id: string): EngineState | undefined {
    const cp = this.checkpoints.get(id);
    if (!cp) return undefined;
    
    // We do a deep clone conceptually, but since EngineState is immutable, 
    // returning the reference is perfectly safe and deterministic.
    return cp.state;
  }
  
  public clearCheckpoints(): void {
    this.checkpoints.clear();
  }
}
