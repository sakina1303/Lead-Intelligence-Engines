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

export * from "./lead/routing.js";
export * from "./lead/merge.js";
export * from "./lead/identity.js";
export * from "./lead/associations.js";
export * from "./lead/enrichment.js";
