import type { CreateLeadInput, EngineState, Lead, LifecycleState, Outcome, Timestamp } from "./contracts.js";
import { failure, success, validEmail, validId, validTimestamp, validateAttributes } from "./validation.js";

const transitions: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = {
  new: ["contacted", "nurturing", "qualified", "rejected"],
  contacted: ["nurturing", "qualified", "rejected"],
  nurturing: ["contacted", "qualified", "rejected"],
  qualified: ["converted", "rejected"],
  converted: [],
  rejected: [],
};

export function createLead(input: CreateLeadInput): Outcome<Lead> {
  const errors = [
    ...(!validId(input.id) ? ["lead id is required"] : []),
    ...(input.name.trim().length < 2 ? ["lead name must contain at least two characters"] : []),
    ...(!validEmail(input.email) ? ["lead email must be valid"] : []),
    ...(!validTimestamp(input.createdAt) ? ["lead createdAt must be a non-negative safe integer"] : []),
    ...validateAttributes(input.attributes ?? {}),
  ];
  if (errors.length > 0) return failure(...errors);
  return success({
    id: input.id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company?.trim() ?? "",
    attributes: { ...(input.attributes ?? {}) },
    lifecycle: input.lifecycle ?? "new",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function addLead(state: EngineState, input: CreateLeadInput): Outcome<EngineState> {
  const result = createLead(input);
  if (!result.ok) return result;
  if (state.leads[result.value.id]) return failure(`lead '${result.value.id}' already exists`);
  return success({
    ...state,
    leads: { ...state.leads, [result.value.id]: result.value },
    scores: { ...state.scores, [result.value.id]: 0 },
    eventIdsByLead: { ...state.eventIdsByLead, [result.value.id]: [] },
    scoreHistory: { ...state.scoreHistory, [result.value.id]: [] },
  });
}

export function updateLeadAttributes(state: EngineState, leadId: string, attributes: Readonly<Record<string, string | number | boolean>>, updatedAt: Timestamp): Outcome<EngineState> {
  const lead = state.leads[leadId];
  if (!lead) return failure(`lead '${leadId}' does not exist`);
  const errors = [...(!validTimestamp(updatedAt) ? ["updatedAt must be valid"] : []), ...validateAttributes(attributes)];
  if (errors.length > 0) return failure(...errors);
  if (updatedAt < lead.updatedAt) return failure("updatedAt cannot precede the current lead update");
  return success({ ...state, leads: { ...state.leads, [leadId]: { ...lead, attributes: { ...lead.attributes, ...attributes }, updatedAt } } });
}

export function transitionLifecycle(state: EngineState, leadId: string, target: LifecycleState, updatedAt: Timestamp): Outcome<EngineState> {
  const lead = state.leads[leadId];
  if (!lead) return failure(`lead '${leadId}' does not exist`);
  if (!validTimestamp(updatedAt) || updatedAt < lead.updatedAt) return failure("updatedAt must not precede the current lead update");
  if (lead.lifecycle === target) return success(state);
  if (!transitions[lead.lifecycle].includes(target)) return failure(`cannot transition from '${lead.lifecycle}' to '${target}'`);
  return success({ ...state, leads: { ...state.leads, [leadId]: { ...lead, lifecycle: target, updatedAt } } });
}

export function allowedLifecycleTransitions(lifecycle: LifecycleState): readonly LifecycleState[] {
  return transitions[lifecycle];
}

// --- Deterministic Ownership & Capacity Routing ---

export interface SalesRep {
  readonly id: string;
  readonly name: string;
  readonly territoryId: string;
  readonly currentActiveLeads: number;
  readonly maxCapacity: number;
  readonly isActive: boolean;
  readonly skills: readonly string[];
}

export interface RoutingTerritory {
  readonly id: string;
  readonly name: string;
  readonly requiredAttributes: Readonly<Record<string, string>>;
  readonly fallbackRepId?: string;
  readonly isGlobal: boolean;
}

export interface RoutingResult {
  readonly leadId: string;
  readonly repId: string | null;
  readonly territoryId: string | null;
  readonly reasons: readonly string[];
}

export function evaluateRoutingTerritory(lead: Lead, territories: readonly RoutingTerritory[]): RoutingTerritory | undefined {
  const sorted = [...territories].sort((a, b) => b.isGlobal === a.isGlobal ? a.id.localeCompare(b.id) : a.isGlobal ? 1 : -1);
  return sorted.find(t => {
    return Object.entries(t.requiredAttributes).every(([k, v]) => lead.attributes[k] === v);
  });
}

export function assignSalesRep(lead: Lead, territory: RoutingTerritory, reps: readonly SalesRep[], timestamp: Timestamp): RoutingResult {
  const eligibleReps = reps.filter(r => r.isActive && (r.territoryId === territory.id || territory.isGlobal) && r.currentActiveLeads < r.maxCapacity);
  
  if (eligibleReps.length === 0) {
    if (territory.fallbackRepId) {
      const fallback = reps.find(r => r.id === territory.fallbackRepId);
      if (fallback && fallback.isActive) return { leadId: lead.id, repId: fallback.id, territoryId: territory.id, reasons: ["assigned to territory fallback due to capacity"] };
    }
    return { leadId: lead.id, repId: null, territoryId: territory.id, reasons: ["no active reps with capacity in territory"] };
  }

  // Deterministic round-robin based on state hash mapping to rep index
  const hashVal = lead.id.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0) + timestamp;
  const sortedEligible = eligibleReps.sort((a, b) => a.id.localeCompare(b.id));
  const selectedIndex = Math.abs(hashVal) % sortedEligible.length;
  const selected = sortedEligible[selectedIndex]!;
  
  return { leadId: lead.id, repId: selected.id, territoryId: territory.id, reasons: ["assigned via deterministic hashing"] };
}

export function mergeLeadsDeterministic(primary: Lead, secondary: Lead, timestamp: Timestamp): Outcome<Lead> {
  if (primary.id === secondary.id) return failure("cannot merge lead with itself");
  if (!validTimestamp(timestamp)) return failure("timestamp must be valid");
  if (timestamp < primary.updatedAt || timestamp < secondary.updatedAt) return failure("merge timestamp cannot precede lead updates");

  // Deterministic attribute resolution: longest string wins, true wins over false, higher number wins
  const mergedAttributes = { ...primary.attributes };
  for (const [key, val] of Object.entries(secondary.attributes)) {
    const existing = mergedAttributes[key];
    if (existing === undefined) {
      mergedAttributes[key] = val;
    } else if (typeof existing === 'string' && typeof val === 'string') {
      if (val.length > existing.length) mergedAttributes[key] = val;
      else if (val.length === existing.length && val.localeCompare(existing) > 0) mergedAttributes[key] = val;
    } else if (typeof existing === 'number' && typeof val === 'number') {
      if (val > existing) mergedAttributes[key] = val;
    } else if (typeof existing === 'boolean' && typeof val === 'boolean') {
      if (val === true) mergedAttributes[key] = true;
    }
  }

  return success({
    id: primary.id,
    name: primary.name,
    email: primary.email,
    company: primary.company || secondary.company,
    attributes: mergedAttributes,
    lifecycle: primary.lifecycle, 
    createdAt: Math.min(primary.createdAt, secondary.createdAt),
    updatedAt: timestamp
  });
}
