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
    scoreProjections: {},
    scoreHistory: {},
    qualifications: {},
    segments: {},
    profiles: {},
    leadHistory: {},
  };
}

export function replaceState(state: EngineState, patch: Partial<EngineState>): EngineState {
  return { ...state, ...patch };
}

// --- Deterministic State Hashing ---

export function computeStateHash(state: EngineState): string {
  // A deterministic hash function for EngineState.
  // In a real system, you might use a crypto hash like SHA-256 over a canonical JSON representation.
  // Here we use a fast djb2 variant over sorted keys for performance while retaining determinism.
  
  let h = 5381;
  
  function mixStr(str: string) {
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i); 
    }
  }
  
  function mixNum(num: number) {
    // Basic float to bits conversion approximation for hashing
    const str = num.toString();
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i); 
    }
  }
  
  // Hash Leads
  const leadIds = Object.keys(state.leads).sort();
  for (const id of leadIds) {
    mixStr(id);
    const lead = state.leads[id]!;
    mixStr(lead.lifecycle);
    mixNum(lead.updatedAt);
    mixNum(state.scores[id] ?? 0);
  }
  
  // Hash Events
  const eventIds = Object.keys(state.events).sort();
  for (const id of eventIds) {
    mixStr(id);
    mixStr(state.events[id]!.type);
    mixNum(state.events[id]!.occurredAt);
  }
  
  // Hash Config (basic)
  mixNum(state.config.scorePolicy.cap);
  mixNum(state.config.scorePolicy.floor);
  mixStr(state.config.scorePolicy.conflictMode);
  
  return (h >>> 0).toString(16);
}

// --- Differential State Merging ---

export interface StatePatch {
  readonly addedLeads: readonly import("./contracts.js").Lead[];
  readonly updatedLeads: readonly import("./contracts.js").Lead[];
  readonly addedEvents: readonly import("./contracts.js").DomainEvent[];
  readonly updatedScores: Readonly<Record<string, number>>;
  readonly updatedQualifications: Readonly<Record<string, import("./contracts.js").QualificationResult>>;
}

export function computeStateDiff(oldState: EngineState, newState: EngineState): StatePatch {
  const addedLeads: import("./contracts.js").Lead[] = [];
  const updatedLeads: import("./contracts.js").Lead[] = [];
  const addedEvents: import("./contracts.js").DomainEvent[] = [];
  const updatedScores: Record<string, number> = {};
  const updatedQualifications: Record<string, import("./contracts.js").QualificationResult> = {};
  
  for (const [id, newLead] of Object.entries(newState.leads)) {
    const oldLead = oldState.leads[id];
    if (!oldLead) {
      addedLeads.push(newLead);
    } else if (oldLead.updatedAt !== newLead.updatedAt) {
      updatedLeads.push(newLead);
    }
  }
  
  for (const [id, newEvent] of Object.entries(newState.events)) {
    if (!oldState.events[id]) {
      addedEvents.push(newEvent);
    }
  }
  
  for (const [id, newScore] of Object.entries(newState.scores)) {
    if (oldState.scores[id] !== newScore) {
      updatedScores[id] = newScore;
    }
  }
  
  for (const [id, newQual] of Object.entries(newState.qualifications)) {
    const oldQual = oldState.qualifications[id];
    if (!oldQual || oldQual.state !== newQual.state || oldQual.evaluatedAt !== newQual.evaluatedAt) {
      updatedQualifications[id] = newQual;
    }
  }
  
  return {
    addedLeads,
    updatedLeads,
    addedEvents,
    updatedScores,
    updatedQualifications
  };
}

export function applyStatePatch(state: EngineState, patch: StatePatch): EngineState {
  const nextLeads = { ...state.leads };
  const nextEvents = { ...state.events };
  const nextEventIdsByLead = { ...state.eventIdsByLead };
  const nextScores = { ...state.scores };
  const nextQual = { ...state.qualifications };
  
  for (const lead of patch.addedLeads) {
    nextLeads[lead.id] = lead;
    nextEventIdsByLead[lead.id] = [];
  }
  
  for (const lead of patch.updatedLeads) {
    nextLeads[lead.id] = lead;
  }
  
  for (const event of patch.addedEvents) {
    nextEvents[event.id] = event;
    if (nextEventIdsByLead[event.leadId]) {
      nextEventIdsByLead[event.leadId] = [...nextEventIdsByLead[event.leadId]!, event.id];
    }
  }
  
  for (const [id, score] of Object.entries(patch.updatedScores)) {
    nextScores[id] = score;
  }
  
  for (const [id, qual] of Object.entries(patch.updatedQualifications)) {
    nextQual[id] = qual;
  }
  
  return {
    ...state,
    leads: nextLeads,
    events: nextEvents,
    eventIdsByLead: nextEventIdsByLead,
    scores: nextScores,
    qualifications: nextQual
  };
}

// --- State Serialization & Compression ---

export interface CompressedState {
  readonly version: 1;
  readonly payload: string; // Base64 encoded or similar stringified representation
  readonly hash: string;
}

export function serializeAndCompressState(state: EngineState): CompressedState {
  // A simplistic mock for state compression. 
  // Real implementation would use pako (zlib) or LZ4.
  // Here we just strip out some indexes that can be rebuilt, and JSON stringify.
  
  const minimalistState = {
    c: state.config,
    l: state.leads,
    e: state.events,
    s: state.scores,
    q: state.qualifications,
    // eventIdsByLead, scoreHistory, scoreProjections, segments, profiles can be rebuilt or are ephemeral
  };
  
  const str = JSON.stringify(minimalistState);
  const payload = Buffer.from(str).toString("base64");
  
  return {
    version: 1,
    payload,
    hash: computeStateHash(state),
  };
}

export function decompressAndDeserializeState(compressed: CompressedState): EngineState {
  const str = Buffer.from(compressed.payload, "base64").toString("utf8");
  const parsed = JSON.parse(str);
  
  const state = createEngineState(parsed.c);
  state.leads = parsed.l ?? {};
  state.events = parsed.e ?? {};
  state.scores = parsed.s ?? {};
  state.qualifications = parsed.q ?? {};
  
  // Rebuild indexes
  const eventIdsByLead: Record<string, string[]> = {};
  for (const [id, event] of Object.entries(state.events)) {
    if (!eventIdsByLead[(event as any).leadId]) {
       eventIdsByLead[(event as any).leadId] = [];
    }
    eventIdsByLead[(event as any).leadId]!.push(id);
  }
  
  // Sort them just in case
  for (const leadId of Object.keys(eventIdsByLead)) {
    eventIdsByLead[leadId]!.sort((a, b) => state.events[a]!.occurredAt - state.events[b]!.occurredAt);
  }
  
  state.eventIdsByLead = eventIdsByLead;
  
  return state;
}

// --- Audit Log Generation ---

export interface StateAuditEntry {
  readonly timestamp: number;
  readonly entityType: "lead" | "event" | "score" | "qualification" | "segment";
  readonly entityId: string;
  readonly action: "created" | "updated" | "deleted";
  readonly details: Record<string, unknown>;
}

export function generateAuditLog(oldState: EngineState, newState: EngineState, timestamp: number): readonly StateAuditEntry[] {
  const entries: StateAuditEntry[] = [];
  const patch = computeStateDiff(oldState, newState);
  
  for (const lead of patch.addedLeads) {
    entries.push({ timestamp, entityType: "lead", entityId: lead.id, action: "created", details: { lifecycle: lead.lifecycle } });
  }
  for (const lead of patch.updatedLeads) {
    entries.push({ timestamp, entityType: "lead", entityId: lead.id, action: "updated", details: { lifecycle: lead.lifecycle } });
  }
  
  for (const event of patch.addedEvents) {
    entries.push({ timestamp, entityType: "event", entityId: event.id, action: "created", details: { type: event.type, leadId: event.leadId } });
  }
  
  for (const [id, score] of Object.entries(patch.updatedScores)) {
    entries.push({ timestamp, entityType: "score", entityId: id, action: "updated", details: { score } });
  }
  
  for (const [id, qual] of Object.entries(patch.updatedQualifications)) {
    entries.push({ timestamp, entityType: "qualification", entityId: id, action: "updated", details: { state: qual.state, policyId: qual.policyId } });
  }
  
  return entries;
}
