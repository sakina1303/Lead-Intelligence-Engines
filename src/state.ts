import type { EngineConfig, EngineState } from "./contracts.js";

export const defaultEngineConfig: EngineConfig = {
  scorePolicy: { cap: 1000, floor: 0, conflictMode: "stack" },
  qualificationPolicies: [],
  segmentPolicy: { rules: [], fallback: "unsegmented" },
};

export function createEngineState(config: EngineConfig = defaultEngineConfig): EngineState {
  return {
    config,
    leads: {},
    events: {},
    eventIdsByLead: {},
    scores: {},
    scoreHistory: {},
    qualifications: {},
    segments: {},
  };
}

export function replaceState(state: EngineState, patch: Partial<EngineState>): EngineState {
  return { ...state, ...patch };
}
