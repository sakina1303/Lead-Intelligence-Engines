import type { CreateEventInput, DomainEvent, EngineState, EventCategory, Outcome, Timestamp } from "../contracts.js";
import { compareEvents, createEvent } from "./core.js";
import { computeDeterministicDigest, computeStateHash } from "../state.js";
import { failure, success } from "../validation.js";

export interface EventQuery {
  readonly leadId?: string;
  readonly type?: string;
  readonly category?: DomainEvent["category"];
  readonly from?: number;
  readonly to?: number;
}

export interface EventQueryFilter {
  readonly leadIds?: readonly string[];
  readonly types?: readonly string[];
  readonly categories?: readonly EventCategory[];
  readonly from?: Timestamp;
  readonly to?: Timestamp;
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
  readonly limit?: number;
}

export interface EventWindow {
  readonly from: Timestamp;
  readonly to: Timestamp;
}

export interface EventTypeSummary {
  readonly type: string;
  readonly count: number;
  readonly firstOccurredAt: Timestamp;
  readonly lastOccurredAt: Timestamp;
  readonly leadIds: readonly string[];
}

export interface EventEvidence {
  readonly leadId: string;
  readonly window: EventWindow;
  readonly eventCount: number;
  readonly distinctTypes: readonly string[];
  readonly categories: Readonly<Record<EventCategory, number>>;
  readonly firstOccurredAt?: Timestamp;
  readonly lastOccurredAt?: Timestamp;
}

const allCategories: readonly EventCategory[] = ["engagement", "intent", "profile", "commercial", "support", "custom"];

export function appendEvent(state: EngineState, input: CreateEventInput): Outcome<{ readonly state: EngineState; readonly event: DomainEvent; readonly duplicate: boolean }> {
  const eventResult = createEvent(input);
  if (!eventResult.ok) return eventResult;
  const event = eventResult.value;
  if (!state.leads[event.leadId]) return failure(`lead '${event.leadId}' does not exist`);
  const existing = state.events[event.id];
  if (existing) {
    const same = JSON.stringify(existing) === JSON.stringify(event);
    return same ? success({ state, event: existing, duplicate: true }) : failure(`event id '${event.id}' conflicts with an existing event`);
  }
  const previousIds = state.eventIdsByLead[event.leadId] ?? [];
  const ids = [...previousIds, event.id].sort((left, right) => compareEvents(eventFor(state, event, left), eventFor(state, event, right)));
  return success({
    state: {
      ...state,
      events: { ...state.events, [event.id]: event },
      eventIdsByLead: { ...state.eventIdsByLead, [event.leadId]: ids },
    },
    event,
    duplicate: false,
  });
}

function eventFor(state: EngineState, newEvent: DomainEvent, id: string): DomainEvent {
  return id === newEvent.id ? newEvent : state.events[id]!;
}

export function getLeadEvents(state: EngineState, leadId: string): readonly DomainEvent[] {
  return (state.eventIdsByLead[leadId] ?? []).map((id) => state.events[id]!).sort(compareEvents);
}

export function queryEvents(state: EngineState, query: EventQuery = {}): readonly DomainEvent[] {
  return Object.values(state.events).filter((event) =>
    (query.leadId === undefined || event.leadId === query.leadId) &&
    (query.type === undefined || event.type === query.type) &&
    (query.category === undefined || event.category === query.category) &&
    (query.from === undefined || event.occurredAt >= query.from) &&
    (query.to === undefined || event.occurredAt <= query.to),
  ).sort(compareEvents);
}

function matchesAttributes(event: DomainEvent, expected: Readonly<Record<string, string | number | boolean>>): boolean {
  return Object.entries(expected).every(([key, value]) => event.attributes[key] === value);
}

export function queryEventLedger(state: EngineState, filter: EventQueryFilter = {}): readonly DomainEvent[] {
  const candidates = Object.values(state.events).filter((event) =>
    (filter.leadIds === undefined || filter.leadIds.includes(event.leadId)) &&
    (filter.types === undefined || filter.types.includes(event.type)) &&
    (filter.categories === undefined || filter.categories.includes(event.category)) &&
    (filter.from === undefined || event.occurredAt >= filter.from) &&
    (filter.to === undefined || event.occurredAt <= filter.to) &&
    (filter.attributes === undefined || matchesAttributes(event, filter.attributes)),
  ).sort(compareEvents);
  return filter.limit === undefined ? candidates : candidates.slice(0, Math.max(0, filter.limit));
}

export function eventsInWindow(state: EngineState, leadId: string, window: EventWindow): readonly DomainEvent[] {
  return queryEventLedger(state, { leadIds: [leadId], from: window.from, to: window.to });
}

export function summarizeEventTypes(events: readonly DomainEvent[]): readonly EventTypeSummary[] {
  const summaries = new Map<string, { count: number; firstOccurredAt: Timestamp; lastOccurredAt: Timestamp; leadIds: Set<string> }>();
  for (const event of [...events].sort(compareEvents)) {
    const existing = summaries.get(event.type);
    if (existing) {
      existing.count += 1;
      existing.lastOccurredAt = event.occurredAt;
      existing.leadIds.add(event.leadId);
    } else {
      summaries.set(event.type, { count: 1, firstOccurredAt: event.occurredAt, lastOccurredAt: event.occurredAt, leadIds: new Set([event.leadId]) });
    }
  }
  return [...summaries.entries()].map(([type, summary]) => ({ type, count: summary.count, firstOccurredAt: summary.firstOccurredAt, lastOccurredAt: summary.lastOccurredAt, leadIds: [...summary.leadIds].sort((left, right) => left.localeCompare(right)) })).sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
}

export function collectEventEvidence(state: EngineState, leadId: string, window: EventWindow): EventEvidence {
  const events = eventsInWindow(state, leadId, window);
  const categories = Object.fromEntries(allCategories.map((category) => [category, 0])) as Record<EventCategory, number>;
  for (const event of events) categories[event.category] += 1;
  return {
    leadId,
    window,
    eventCount: events.length,
    distinctTypes: [...new Set(events.map((event) => event.type))].sort((left, right) => left.localeCompare(right)),
    categories,
    ...(events.length === 0 ? {} : { firstOccurredAt: events[0]!.occurredAt, lastOccurredAt: events[events.length - 1]!.occurredAt }),
  };
}

export function countEventsByLead(state: EngineState, filter: Omit<EventQueryFilter, "leadIds" | "limit"> = {}): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const event of queryEventLedger(state, filter)) counts[event.leadId] = (counts[event.leadId] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

// --- Multi-Touch Attribution Models ---

import type { AttributionModelType, AttributionResult, AttributionWeight, TouchPoint } from "../contracts.js";

export function buildTouchPoints(state: EngineState, leadId: string, channelAttributeKey: string = "channel", conversionEventType: string = "conversion"): readonly TouchPoint[] {
  const events = getLeadEvents(state, leadId);
  
  return events.map(event => {
    const isConversion = event.type === conversionEventType;
    return {
      eventId: event.id,
      leadId: event.leadId,
      channel: typeof event.attributes[channelAttributeKey] === "string" ? event.attributes[channelAttributeKey] as string : "direct",
      category: event.category,
      occurredAt: event.occurredAt,
      isConversion,
    };
  });
}

export function computeAttribution(touchPoints: readonly TouchPoint[], model: AttributionModelType, decayHalfLifeMs: number = 86400000 * 7): AttributionResult {
  const leadId = touchPoints.length > 0 ? touchPoints[0]!.leadId : "";
  const conversionPoint = touchPoints.find(tp => tp.isConversion);
  const relevantPoints = conversionPoint 
    ? touchPoints.filter(tp => tp.occurredAt <= conversionPoint.occurredAt)
    : touchPoints;
  
  if (relevantPoints.length === 0) {
    return { leadId, model, touchPoints: relevantPoints, weights: [], totalWeight: 0 };
  }
  
  const n = relevantPoints.length;
  let rawWeights: number[];
  
  switch (model) {
    case "first-touch":
      rawWeights = relevantPoints.map((_, i) => i === 0 ? 1 : 0);
      break;
    
    case "last-touch":
      rawWeights = relevantPoints.map((_, i) => i === n - 1 ? 1 : 0);
      break;
    
    case "linear":
      rawWeights = relevantPoints.map(() => 1 / n);
      break;
    
    case "time-decay": {
      const lastTimestamp = relevantPoints[n - 1]!.occurredAt;
      rawWeights = relevantPoints.map(tp => {
        const ageMs = lastTimestamp - tp.occurredAt;
        return Math.pow(0.5, ageMs / decayHalfLifeMs);
      });
      break;
    }
    
    case "position-based":
      rawWeights = relevantPoints.map((_, i) => {
        if (n === 1) return 1;
        if (i === 0 || i === n - 1) return 0.4;
        return 0.2 / (n - 2);
      });
      break;
    
    case "w-shaped":
      rawWeights = relevantPoints.map((_, i) => {
        if (n <= 3) return 1 / n;
        const midIdx = Math.floor(n / 2);
        if (i === 0 || i === midIdx || i === n - 1) return 0.3;
        return 0.1 / (n - 3);
      });
      break;
  }
  
  const totalRaw = rawWeights.reduce((sum, w) => sum + w, 0);
  
  const weights: AttributionWeight[] = relevantPoints.map((tp, i) => ({
    touchPointEventId: tp.eventId,
    weight: rawWeights[i]!,
    normalizedWeight: totalRaw > 0 ? rawWeights[i]! / totalRaw : 0,
    position: i,
    totalTouchPoints: n,
  }));
  
  return {
    leadId,
    model,
    touchPoints: relevantPoints,
    weights,
    ...(conversionPoint ? { conversionEventId: conversionPoint.eventId } : {}),
    totalWeight: totalRaw,
  };
}

export function compareAttributionModels(touchPoints: readonly TouchPoint[], models: readonly AttributionModelType[]): readonly AttributionResult[] {
  return models.map(model => computeAttribution(touchPoints, model));
}

// --- Cross-Lead Event Correlation ---

export interface CrossLeadCorrelation {
  readonly eventType: string;
  readonly leadIds: readonly string[];
  readonly occurrences: number;
  readonly earliestAt: number;
  readonly latestAt: number;
  readonly averageScore: number;
}

export function findCrossLeadEventCorrelations(state: EngineState, minLeadCount: number = 2): readonly CrossLeadCorrelation[] {
  const typeToLeads = new Map<string, Map<string, { count: number; earliest: number; latest: number }>>();
  
  for (const event of Object.values(state.events)) {
    const leadMap = typeToLeads.get(event.type) ?? new Map();
    const existing = leadMap.get(event.leadId);
    if (existing) {
      existing.count += 1;
      existing.earliest = Math.min(existing.earliest, event.occurredAt);
      existing.latest = Math.max(existing.latest, event.occurredAt);
    } else {
      leadMap.set(event.leadId, { count: 1, earliest: event.occurredAt, latest: event.occurredAt });
    }
    typeToLeads.set(event.type, leadMap);
  }
  
  const correlations: CrossLeadCorrelation[] = [];
  
  for (const [eventType, leadMap] of typeToLeads) {
    if (leadMap.size < minLeadCount) continue;
    
    const leadIds = [...leadMap.keys()].sort();
    let totalOccurrences = 0;
    let earliest = Infinity;
    let latest = 0;
    let totalScore = 0;
    
    for (const [leadId, data] of leadMap) {
      totalOccurrences += data.count;
      earliest = Math.min(earliest, data.earliest);
      latest = Math.max(latest, data.latest);
      totalScore += state.scores[leadId] ?? 0;
    }
    
    correlations.push({
      eventType,
      leadIds,
      occurrences: totalOccurrences,
      earliestAt: earliest === Infinity ? 0 : earliest,
      latestAt: latest,
      averageScore: leadIds.length > 0 ? totalScore / leadIds.length : 0,
    });
  }
  
  return correlations.sort((a, b) => b.leadIds.length - a.leadIds.length || a.eventType.localeCompare(b.eventType));
}

// --- Event Stream Compaction ---

export interface CompactionResult {
  readonly originalEventCount: number;
  readonly compactedEventCount: number;
  readonly removedDuplicates: number;
  readonly removedOutOfOrder: number;
  readonly compactedState: EngineState;
}

export function compactEventStream(state: EngineState, leadId: string): CompactionResult {
  const events = getLeadEvents(state, leadId);
  const originalCount = events.length;
  const seenHashes = new Set<string>();
  const compacted: DomainEvent[] = [];
  let removedDups = 0;
  let removedOutOfOrder = 0;
  let prevTimestamp = -1;
  
  for (const event of events) {
    // Build content hash for dedup
    const hashParts = [event.type, event.category, String(event.occurredAt),
      ...Object.entries(event.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`)];
    let hash = 5381;
    const content = hashParts.join("|");
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
    }
    const hashStr = String(hash >>> 0);
    
    if (seenHashes.has(hashStr)) {
      removedDups++;
      continue;
    }
    
    if (event.occurredAt < prevTimestamp) {
      removedOutOfOrder++;
      continue;
    }
    
    seenHashes.add(hashStr);
    prevTimestamp = event.occurredAt;
    compacted.push(event);
  }
  
  const newEvents = { ...state.events };
  const removedIds = new Set(events.filter(e => !compacted.some(c => c.id === e.id)).map(e => e.id));
  for (const id of removedIds) delete (newEvents as Record<string, DomainEvent>)[id];
  
  const compactedState: EngineState = {
    ...state,
    events: newEvents,
    eventIdsByLead: {
      ...state.eventIdsByLead,
      [leadId]: compacted.map(e => e.id),
    },
  };
  
  return {
    originalEventCount: originalCount,
    compactedEventCount: compacted.length,
    removedDuplicates: removedDups,
    removedOutOfOrder: removedOutOfOrder,
    compactedState,
  };
}

// --- Data Lineage Tracking ---

export interface LineageTrace {
  readonly leadId: string;
  readonly creationEventId: string | null;
  readonly lastModifiedEventId: string | null;
  readonly totalTransformations: number;
  readonly modificationPath: readonly string[]; // event IDs that modified state
}

export function traceLeadLineage(state: EngineState, leadId: string): Outcome<LineageTrace> {
  const events = getLeadEvents(state, leadId);
  if (!state.leads[leadId]) return failure(`lead '${leadId}' does not exist`);
  
  const creationEvent = events.find(e => e.type.toLowerCase().includes("create") || e.type.toLowerCase().includes("new"));
  const modEvents = events.filter(e => e.type.toLowerCase().includes("update") || e.type.toLowerCase().includes("change") || e.type.toLowerCase().includes("modify"));
  
  return success({
    leadId,
    creationEventId: creationEvent ? creationEvent.id : (events.length > 0 ? events[0]!.id : null),
    lastModifiedEventId: modEvents.length > 0 ? modEvents[modEvents.length - 1]!.id : (events.length > 0 ? events[events.length - 1]!.id : null),
    totalTransformations: modEvents.length,
    modificationPath: modEvents.map(e => e.id)
  });
}

// --- Complex Event Sequences (with variables) ---

export interface SequenceVariable {
  readonly name: string;
  readonly fromAttribute: string;
}

export interface SequenceStep {
  readonly eventType: string;
  readonly extractVariables?: readonly SequenceVariable[];
  readonly requireVariablesMatch?: Readonly<Record<string, string>>; // attribute name -> variable name
  readonly maxDelayMs?: number;
}

export interface SequenceDefinition {
  readonly id: string;
  readonly steps: readonly SequenceStep[];
}

export interface SequenceMatch {
  readonly sequenceId: string;
  readonly leadId: string;
  readonly matchedEventIds: readonly string[];
  readonly variables: Readonly<Record<string, string | number | boolean>>;
  readonly completedAt: number;
}

export function matchComplexSequences(state: EngineState, leadId: string, sequences: readonly SequenceDefinition[]): readonly SequenceMatch[] {
  const events = getLeadEvents(state, leadId);
  if (events.length === 0) return [];
  
  const matches: SequenceMatch[] = [];
  
  for (const seq of sequences) {
    if (seq.steps.length === 0) continue;
    if (events.length < seq.steps.length) continue;
    
    for (let i = 0; i <= events.length - seq.steps.length; i++) {
      if (events[i]!.type !== seq.steps[0]!.eventType) continue;
      
      let patternIdx = 0;
      let j = i;
      const matchedIds: string[] = [];
      const vars: Record<string, string | number | boolean> = {};
      let isValidMatch = true;
      let lastMatchTime = events[i]!.occurredAt;
      
      while (patternIdx < seq.steps.length && j < events.length) {
        const candidate = events[j]!;
        const step = seq.steps[patternIdx]!;
        
        if (candidate.type === step.eventType) {
          // Check delay
          if (patternIdx > 0 && step.maxDelayMs !== undefined) {
            if (candidate.occurredAt - lastMatchTime > step.maxDelayMs) {
              isValidMatch = false;
              break;
            }
          }
          
          // Check variable matching requirements
          let reqsMet = true;
          if (step.requireVariablesMatch) {
            for (const [attrName, varName] of Object.entries(step.requireVariablesMatch)) {
              if (candidate.attributes[attrName] !== vars[varName]) {
                reqsMet = false;
                break;
              }
            }
          }
          
          if (!reqsMet) {
            j++;
            continue; // Not a match for this step, keep looking forward? (Or break depending on strict contiguity)
            // For this implementation, we allow non-contiguous matches as long as order is preserved
          }
          
          // Extract variables
          if (step.extractVariables) {
            for (const v of step.extractVariables) {
              const val = candidate.attributes[v.fromAttribute];
              if (val !== undefined) vars[v.name] = val;
            }
          }
          
          matchedIds.push(candidate.id);
          lastMatchTime = candidate.occurredAt;
          patternIdx++;
        }
        
        j++;
      }
      
      if (isValidMatch && patternIdx === seq.steps.length) {
        matches.push({
          sequenceId: seq.id,
          leadId,
          matchedEventIds: matchedIds,
          variables: vars,
          completedAt: lastMatchTime
        });
      }
    }
  }
  
  return matches;
}

// --- Immutable State Proof Generation ---

export interface StateProof {
  readonly stateHash: string;
  readonly leadCount: number;
  readonly eventCount: number;
  readonly totalScore: number;
  readonly generatedAt: number;
  readonly merkleRoot: string;
}

export function generateStateProof(state: EngineState, timestamp: number): StateProof {
  if (!Number.isFinite(timestamp)) throw new Error("state proof timestamp must be finite");
  const leadIds = Object.keys(state.leads).sort();
  const eventIds = Object.keys(state.events).sort();

  const totalScore = leadIds.reduce((sum, leadId) => sum + (state.scores[leadId] ?? 0), 0);
  const entityDigests = [
    ...leadIds.map((leadId) => computeDeterministicDigest({ entity: "lead", value: state.leads[leadId] })),
    ...eventIds.map((eventId) => computeDeterministicDigest({ entity: "event", value: state.events[eventId] })),
  ];

  let currentLayer = entityDigests;
  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i]!;
      const right = currentLayer[i + 1] ?? left;
      nextLayer.push(computeDeterministicDigest([left, right]));
    }
    currentLayer = nextLayer;
  }

  return {
    stateHash: computeStateHash(state),
    leadCount: leadIds.length,
    eventCount: eventIds.length,
    totalScore,
    generatedAt: timestamp,
    merkleRoot: currentLayer[0] ?? computeDeterministicDigest([]),
  };
}
