# Event-Driven Lead Intelligence Engine

A pure, deterministic TypeScript domain library for turning lead profiles and ordered event evidence into explainable scoring, qualification, segmentation, ranking, and analytics outcomes.

It has no server, database, queue, browser, filesystem, clock, random-ID generator, or network dependency. Callers supply all IDs, timestamps, and policy inputs.

## Domain flow

`Lead → Event ledger → Rule evaluation → Score history → Qualification → Segmentation → Ranking and analytics`

The package preserves the source event ledger, score projections, explanations, lead history, and decision results as immutable state. Equal inputs always produce equal outputs.

## Architecture

The engine has four interacting domain areas:

- **Lead and event ledger** manages profiles, consent, ownership, lifecycle history, event schemas, canonical ordering, idempotency, querying, and state integrity.
- **Scoring and projection** validates prioritized rules, evaluates composable expressions, applies conflicts and caps, records dimensional score history, and supports replay and what-if simulation.
- **Intelligence and decisioning** evaluates qualification and segmentation policies, derives explainable behavioral signals, and ranks leads with stable tie-breaking.
- **Analytics and orchestration** processes deterministic batches, reconciles projections, and calculates funnel, cohort, attribution, trend, distribution, and policy-impact summaries.

These areas operate over the same `EngineState`; analytics and decisions do not maintain separate copies of lead or event truth.

## Install and verify

Requires Node 24.

```bash
npm ci
npm run typecheck
npm run build
npm test
```

The test command writes native Vitest JUnit XML to `reports/junit.xml`. To verify the packaged environment:

```bash
docker build -t lead-intelligence .
docker run --rm --network none lead-intelligence
```

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

- create, merge, route, and update immutable leads while recording profile and lifecycle evidence
- normalize typed events; append, query, correlate, canonically order, and de-duplicate ledger entries
- validate, match, prioritize, and apply rules with dimensions, caps, conflict modes, and composable expressions
- inspect score explanations and dimensional history; replay policies and compare deterministic scenarios
- qualify and segment leads with evidence-bearing policy decisions
- derive lead-intelligence signals such as engagement change, intent, staleness, progression, concentration, and qualification risk
- rank leads using stable strategies and deterministic tie-breakers
- process ordered batches, audit invariants, reconcile derived state, and create verifiable state snapshots
- summarize cohorts, funnels, event paths, score distributions, experiments, attribution, and policy impact

All supported APIs are available from the package root. Direct exports preserve the compact core API, while namespaces such as `eventLedger`, `scoreProjections`, `qualification`, `segmentation`, `intelligence`, `ranking`, `analytics`, `simulations`, and `stateSnapshots` expose the broader domain.

## Deterministic inputs

Callers supply every ID, timestamp, evaluation window, policy, and exploration decision. The domain does not read wall-clock time or generate identifiers, and ranking/event ordering always has an explicit stable tie-break. The library performs no network, filesystem, database, queue, or external-service I/O.
