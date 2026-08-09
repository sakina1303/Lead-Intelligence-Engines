import type { ConsentState, EngineState, LeadChange, LeadChangeKind, LeadProfile, LeadOwnership, Outcome, Scalar, Timestamp } from "./contracts.js";
import { failure, success, validId, validSequence, validTimestamp } from "./validation.js";

export interface RecordLeadChangeInput {
  readonly id: string;
  readonly leadId: string;
  readonly kind: LeadChangeKind;
  readonly occurredAt: Timestamp;
  readonly sequence: number;
  readonly previous: Readonly<Record<string, Scalar | undefined>>;
  readonly next: Readonly<Record<string, Scalar | undefined>>;
  readonly reason: string;
}

export function compareLeadChanges(left: LeadChange, right: LeadChange): number {
  return left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id);
}

export function recordLeadChange(state: EngineState, input: RecordLeadChangeInput): Outcome<EngineState> {
  const errors = [
    ...(!state.leads[input.leadId] ? [`lead '${input.leadId}' does not exist`] : []),
    ...(!validId(input.id) ? ["lead change id is required"] : []),
    ...(!validTimestamp(input.occurredAt) ? ["lead change timestamp is invalid"] : []),
    ...(!validSequence(input.sequence) ? ["lead change sequence is invalid"] : []),
    ...(input.reason.trim().length === 0 ? ["lead change reason is required"] : []),
  ];
  if (errors.length > 0) return failure(...errors);
  const changes = state.leadHistory[input.leadId] ?? [];
  if (changes.some((change) => change.id === input.id)) return failure(`lead change '${input.id}' already exists`);
  const change: LeadChange = { ...input, reason: input.reason.trim() };
  return success({ ...state, leadHistory: { ...state.leadHistory, [input.leadId]: [...changes, change].sort(compareLeadChanges) } });
}

export function getLeadHistory(state: EngineState, leadId: string, kinds?: readonly LeadChangeKind[]): readonly LeadChange[] {
  return (state.leadHistory[leadId] ?? []).filter((change) => kinds === undefined || kinds.includes(change.kind)).sort(compareLeadChanges);
}

export function createLeadProfile(leadId: string, updatedAt: Timestamp): Outcome<LeadProfile> {
  if (!validId(leadId) || !validTimestamp(updatedAt)) return failure("lead profile requires a valid lead id and timestamp");
  return success({ leadId, consent: { email: "unknown", phone: "unknown", updatedAt }, tags: [] });
}

function emptyProfile(leadId: string, updatedAt: Timestamp): LeadProfile {
  return { leadId, consent: { email: "unknown", phone: "unknown", updatedAt }, tags: [] };
}

export function setLeadOwnership(state: EngineState, leadId: string, ownership: LeadOwnership): Outcome<EngineState> {
  if (!state.leads[leadId]) return failure(`lead '${leadId}' does not exist`);
  if (!validId(ownership.ownerId) || !validId(ownership.territory) || !validTimestamp(ownership.assignedAt)) return failure("ownership is invalid");
  const profile = state.profiles[leadId] ?? emptyProfile(leadId, ownership.assignedAt);
  return success({ ...state, profiles: { ...state.profiles, [leadId]: { ...profile, ownership } } });
}

export function updateConsent(state: EngineState, leadId: string, consent: ConsentState): Outcome<EngineState> {
  if (!state.leads[leadId]) return failure(`lead '${leadId}' does not exist`);
  if (!validTimestamp(consent.updatedAt)) return failure("consent timestamp is invalid");
  const profile = state.profiles[leadId] ?? emptyProfile(leadId, consent.updatedAt);
  if (consent.updatedAt < profile.consent.updatedAt) return failure("consent timestamp cannot move backwards");
  return success({ ...state, profiles: { ...state.profiles, [leadId]: { ...profile, consent } } });
}

export function addLeadTag(state: EngineState, leadId: string, tag: string): Outcome<EngineState> {
  if (!state.leads[leadId]) return failure(`lead '${leadId}' does not exist`);
  if (!validId(tag)) return failure("tag is required");
  const profile = state.profiles[leadId] ?? emptyProfile(leadId, state.leads[leadId]!.updatedAt);
  const tags = [...new Set([...profile.tags, tag.trim()])].sort((left, right) => left.localeCompare(right));
  return success({ ...state, profiles: { ...state.profiles, [leadId]: { ...profile, tags } } });
}

export function removeLeadTag(state: EngineState, leadId: string, tag: string): Outcome<EngineState> {
  if (!state.leads[leadId]) return failure(`lead '${leadId}' does not exist`);
  const profile = state.profiles[leadId] ?? emptyProfile(leadId, state.leads[leadId]!.updatedAt);
  return success({ ...state, profiles: { ...state.profiles, [leadId]: { ...profile, tags: profile.tags.filter((item) => item !== tag) } } });
}
