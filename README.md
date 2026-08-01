# Event-Driven Lead Intelligence Engine

A pure, deterministic TypeScript domain library for turning explicit lead events into scoring, qualification, segmentation, ranking, and analytics outcomes.

It has no server, database, queue, browser, filesystem, clock, random-ID generator, or network dependency. Callers supply all IDs, timestamps, and policy inputs.

## Domain flow

`Lead → Event ledger → Rule evaluation → Score history → Qualification → Segmentation → Ranking and analytics`

The package preserves event history and returns immutable next-state values. Equal inputs always produce equal outputs.

## Install and verify

Requires Node 24.

```bash
npm ci
npm run build
npm test
```

The test command writes native Vitest JUnit XML to `reports/junit.xml`.

## Example

```ts
import { addLead, createEngine, processEvent, rankLeads } from "event-driven-lead-intelligence-engine";

const engine = createEngine({
  scorePolicy: { floor: 0, cap: 1000, conflictMode: "stack" },
  qualificationPolicies: [],
  segmentPolicy: { rules: [], fallback: "unsegmented" },
});

const withLead = addLead(engine, {
  id: "lead-ada",
  name: "Ada Lovelace",
  email: "ada@example.test",
  createdAt: 1_700_000_000_000,
}).value;

if (!withLead) throw new Error("invalid lead");

const result = processEvent(withLead, {
  id: "event-001",
  leadId: "lead-ada",
  type: "demo.request",
  category: "intent",
  occurredAt: 1_700_000_000_100,
  sequence: 0,
  attributes: {},
}, [{
  id: "demo-request",
  name: "Demo request",
  enabled: true,
  priority: 10,
  delta: 50,
  condition: { eventType: "demo.request" },
}], 1_700_000_000_200);

const ranking = rankLeads(result.state);
```

## Public capabilities

- create and update immutable leads; transition their lifecycle
- append, query, canonically order, and de-duplicate explicit events
- validate, match, prioritize, and apply scoring rules
- inspect score explanations and score history
- evaluate qualification and segments
- rank leads with stable ties
- process deterministic event batches
- summarize lead, event, score, qualification, and segmentation data

All public APIs are exported from the package root.
