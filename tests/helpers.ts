import type { CreateEventInput, EngineConfig, ScoringRule } from "../src/index.js";

export const config: EngineConfig = {
  scorePolicy: { cap: 100, floor: 0, conflictMode: "stack" },
  qualificationPolicies: [{ id: "mql", minimumScore: 30, minimumEvents: 1, qualification: "marketing-qualified" }],
  segmentPolicy: { rules: [{ id: "high", name: "high-intent", priority: 10, minimumScore: 50 }, { id: "mql", name: "qualified", priority: 5, qualificationStates: ["marketing-qualified"] }], fallback: "emerging" },
};

export const rules: readonly ScoringRule[] = [
  { id: "open", name: "Open email", enabled: true, priority: 1, delta: 10, condition: { eventType: "email.open" } },
  { id: "demo", name: "Demo request", enabled: true, priority: 5, delta: 40, condition: { eventType: "demo.request" } },
  { id: "intent", name: "Intent category", enabled: true, priority: 2, delta: 5, condition: { category: "intent" } },
];

export function event(id: string, overrides: Partial<CreateEventInput> = {}): CreateEventInput {
  return { id, leadId: "lead-1", type: "email.open", category: "engagement", occurredAt: 100, sequence: 0, attributes: {}, ...overrides };
}
