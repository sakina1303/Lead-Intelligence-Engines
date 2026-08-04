import type { CreateEventInput, CreateLeadInput, EngineConfig, EngineState, EventProcessResult, ScoringRule, Timestamp } from "./contracts.js";
import { appendEvent, getLeadEvents } from "./event-ledger.js";
import { addLead } from "./leads.js";
import { evaluateQualification, selectQualification } from "./qualification.js";
import { replayLeadScoring } from "./replay.js";
import { assignSegment } from "./segmentation.js";
import { createEngineState } from "./state.js";

export function createEngine(config: EngineConfig): EngineState {
  return createEngineState(config);
}

export function createLeadInEngine(state: EngineState, input: CreateLeadInput): EventProcessResult {
  const result = addLead(state, input);
  return result.ok ? { state: result.value, outcome: "accepted" } : { state, outcome: "rejected", errors: result.errors };
}

export function processEvent(state: EngineState, input: CreateEventInput, rules: readonly ScoringRule[], evaluatedAt: Timestamp): EventProcessResult {
  const appended = appendEvent(state, input);
  if (!appended.ok) return { state, outcome: "rejected", errors: appended.errors };
  if (appended.value.duplicate) return { state, outcome: "duplicate", event: appended.value.event };
  const replayed = replayLeadScoring(appended.value.state, appended.value.event.leadId, rules);
  if (!replayed.ok) return { state: appended.value.state, outcome: "rejected", errors: replayed.errors };
  const explanation = replayed.value.history.find((item) => item.eventId === appended.value.event.id);
  return refreshLeadIntelligence(replayed.value.state, appended.value.event.leadId, evaluatedAt, explanation === undefined ? { event: appended.value.event } : { event: appended.value.event, explanation });
}

export function refreshLeadIntelligence(state: EngineState, leadId: string, evaluatedAt: Timestamp, base: Pick<EventProcessResult, "event" | "explanation"> = {}): EventProcessResult {
  const lead = state.leads[leadId];
  if (!lead) return { state, outcome: "rejected", errors: [`lead '${leadId}' does not exist`] };
  const events = getLeadEvents(state, leadId);
  const results = state.config.qualificationPolicies.map((policy) => evaluateQualification(lead, state.scores[leadId] ?? 0, events, policy, evaluatedAt));
  const qualification = selectQualification(results) ?? { leadId, policyId: "default", state: "unqualified" as const, evaluatedAt, reasons: ["no qualification policy matched"] };
  const segment = assignSegment(lead, state.scores[leadId] ?? 0, events, qualification, state.config.segmentPolicy);
  const next = { ...state, qualifications: { ...state.qualifications, [leadId]: qualification }, segments: { ...state.segments, [leadId]: segment } };
  return { state: next, outcome: "accepted", ...base, qualification, segment };
}
