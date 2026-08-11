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

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("state contains a non-finite number");
    return Object.is(value, -0) ? "-0" : String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }

  throw new Error(`state contains an unsupported ${typeof value} value`);
}

export function computeStateHash(state: EngineState): string {
  const canonicalState = canonicalize(state);
  let hash = 2166136261;

  for (let index = 0; index < canonicalState.length; index += 1) {
    hash ^= canonicalState.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
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
  readonly payload: string;
  readonly hash: string;
}

export function serializeAndCompressState(state: EngineState): CompressedState {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64");
  return {
    version: 1,
    payload,
    hash: computeStateHash(state),
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const stateRecordFields = [
  "config",
  "leads",
  "events",
  "eventIdsByLead",
  "scores",
  "scoreProjections",
  "scoreHistory",
  "qualifications",
  "segments",
  "profiles",
  "leadHistory",
] as const;

function assertSerializedState(value: unknown): asserts value is EngineState {
  if (!isRecord(value)) throw new Error("snapshot payload must contain an engine state object");

  for (const field of stateRecordFields) {
    if (!isRecord(value[field])) throw new Error(`snapshot field ${field} must be an object`);
  }

  const config = value["config"];
  if (!isRecord(config) || !isRecord(config["scorePolicy"]) || !Array.isArray(config["qualificationPolicies"]) || !isRecord(config["segmentPolicy"])) {
    throw new Error("snapshot config is invalid");
  }

  const eventIdsByLead = value["eventIdsByLead"];
  if (!isRecord(eventIdsByLead)) throw new Error("snapshot event index is invalid");
  if (Object.values(eventIdsByLead).some((eventIds) => !Array.isArray(eventIds) || eventIds.some((eventId) => typeof eventId !== "string"))) {
    throw new Error("snapshot event index is invalid");
  }

  const scores = value["scores"];
  if (!isRecord(scores)) throw new Error("snapshot scores are invalid");
  if (Object.values(scores).some((score) => typeof score !== "number" || !Number.isFinite(score))) {
    throw new Error("snapshot scores are invalid");
  }
}

export function decompressAndDeserializeState(compressed: CompressedState): EngineState {
  if (compressed.version !== 1) throw new Error(`unsupported snapshot version: ${String(compressed.version)}`);

  let parsed: unknown;
  try {
    const serialized = Buffer.from(compressed.payload, "base64").toString("utf8");
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error("snapshot payload is not valid base64-encoded JSON");
  }

  assertSerializedState(parsed);
  const actualHash = computeStateHash(parsed);
  if (actualHash !== compressed.hash) {
    throw new Error(`snapshot integrity check failed: expected ${compressed.hash}, received ${actualHash}`);
  }

  return parsed;
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
