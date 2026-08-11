import type { DomainEvent, EngineState, Lead, LifecycleState, Outcome } from "./contracts.js";
import { getLeadEvents } from "./event-ledger.js";

// Deterministic, state-derived models for lead intelligence.

export type LeadSignalKind =
  | "increasing-engagement"
  | "declining-engagement"
  | "high-intent"
  | "stale-activity"
  | "rapid-progression"
  | "repeated-decision-behavior"
  | "strong-fit-low-engagement"
  | "strong-engagement-weak-fit"
  | "qualification-risk"
  | "opportunity-acceleration"
  | "behavioral-concentration";

export interface LeadSignalEvidence {
  readonly metric: string;
  readonly actual: number;
  readonly threshold: number;
  readonly eventIds: readonly string[];
  readonly explanation: string;
}

export interface LeadIntelligenceSignal {
  readonly kind: LeadSignalKind;
  readonly disposition: "opportunity" | "risk" | "observation";
  readonly strength: number;
  readonly evidence: LeadSignalEvidence;
}

export interface LeadSignalPolicy {
  readonly evaluatedAt: number;
  readonly recentWindowMs: number;
  readonly comparisonWindowMs: number;
  readonly staleAfterMs: number;
  readonly highIntentEventTypes: readonly string[];
  readonly decisionEventTypes: readonly string[];
  readonly highIntentMinimum: number;
  readonly repeatedDecisionMinimum: number;
  readonly engagementChangeRatio: number;
  readonly concentrationRatio: number;
  readonly rapidProgressionMs: number;
  readonly fitDimension: string;
  readonly engagementDimension: string;
  readonly strongDimensionThreshold: number;
  readonly weakDimensionThreshold: number;
}

export interface LeadIntelligenceReport {
  readonly leadId: string;
  readonly evaluatedAt: number;
  readonly recentWindowStart: number;
  readonly comparisonWindowStart: number;
  readonly signals: readonly LeadIntelligenceSignal[];
}

function signalPolicyErrors(policy: LeadSignalPolicy): string[] {
  const errors: string[] = [];
  const positiveDurations: readonly [string, number][] = [
    ["recentWindowMs", policy.recentWindowMs],
    ["comparisonWindowMs", policy.comparisonWindowMs],
    ["staleAfterMs", policy.staleAfterMs],
    ["rapidProgressionMs", policy.rapidProgressionMs],
  ];
  for (const [name, value] of positiveDurations) {
    if (!Number.isFinite(value) || value <= 0) errors.push(`${name} must be a positive finite number`);
  }
  const nonNegativeCounts: readonly [string, number][] = [
    ["highIntentMinimum", policy.highIntentMinimum],
    ["repeatedDecisionMinimum", policy.repeatedDecisionMinimum],
  ];
  for (const [name, value] of nonNegativeCounts) {
    if (!Number.isInteger(value) || value < 1) errors.push(`${name} must be a positive integer`);
  }
  if (!Number.isFinite(policy.evaluatedAt)) errors.push("evaluatedAt must be finite");
  if (!Number.isFinite(policy.engagementChangeRatio) || policy.engagementChangeRatio <= 1) errors.push("engagementChangeRatio must be greater than 1");
  if (!Number.isFinite(policy.concentrationRatio) || policy.concentrationRatio <= 0 || policy.concentrationRatio > 1) errors.push("concentrationRatio must be in (0, 1]");
  if (!policy.fitDimension.trim()) errors.push("fitDimension is required");
  if (!policy.engagementDimension.trim()) errors.push("engagementDimension is required");
  if (!Number.isFinite(policy.strongDimensionThreshold)) errors.push("strongDimensionThreshold must be finite");
  if (!Number.isFinite(policy.weakDimensionThreshold)) errors.push("weakDimensionThreshold must be finite");
  return errors;
}

function strength(actual: number, threshold: number): number {
  if (threshold <= 0) return actual > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, actual / threshold));
}

function evidence(
  metric: string,
  actual: number,
  threshold: number,
  events: readonly DomainEvent[],
  explanation: string,
): LeadSignalEvidence {
  return { metric, actual, threshold, eventIds: events.map((event) => event.id), explanation };
}

export function evaluateLeadIntelligence(
  state: EngineState,
  leadId: string,
  policy: LeadSignalPolicy,
): Outcome<LeadIntelligenceReport> {
  const errors = signalPolicyErrors(policy);
  const lead = state.leads[leadId];
  if (!lead) errors.push(`lead ${leadId} does not exist`);
  if (errors.length > 0 || !lead) return { ok: false, errors };

  const allEvents = getLeadEvents(state, leadId).filter((event) => event.occurredAt <= policy.evaluatedAt);
  const recentStart = policy.evaluatedAt - policy.recentWindowMs;
  const comparisonStart = recentStart - policy.comparisonWindowMs;
  const recent = allEvents.filter((event) => event.occurredAt >= recentStart);
  const previous = allEvents.filter((event) => event.occurredAt >= comparisonStart && event.occurredAt < recentStart);
  const signals: LeadIntelligenceSignal[] = [];

  const normalizedRecentRate = recent.length / policy.recentWindowMs;
  const normalizedPreviousRate = previous.length / policy.comparisonWindowMs;
  const increasing = normalizedRecentRate > normalizedPreviousRate * policy.engagementChangeRatio && recent.length > 0;
  const declining = normalizedPreviousRate > normalizedRecentRate * policy.engagementChangeRatio && previous.length > 0;

  if (increasing) {
    const ratio = normalizedPreviousRate === 0 ? policy.engagementChangeRatio : normalizedRecentRate / normalizedPreviousRate;
    signals.push({
      kind: "increasing-engagement",
      disposition: "opportunity",
      strength: strength(ratio, policy.engagementChangeRatio),
      evidence: evidence("engagement-rate-ratio", ratio, policy.engagementChangeRatio, recent, "recent event frequency exceeds the comparison window"),
    });
  }

  if (declining) {
    const ratio = normalizedRecentRate === 0 ? policy.engagementChangeRatio : normalizedPreviousRate / normalizedRecentRate;
    signals.push({
      kind: "declining-engagement",
      disposition: "risk",
      strength: strength(ratio, policy.engagementChangeRatio),
      evidence: evidence("engagement-decline-ratio", ratio, policy.engagementChangeRatio, previous, "recent event frequency is below the comparison window"),
    });
  }

  const highIntent = recent.filter((event) => policy.highIntentEventTypes.includes(event.type));
  if (highIntent.length >= policy.highIntentMinimum) {
    signals.push({
      kind: "high-intent",
      disposition: "opportunity",
      strength: strength(highIntent.length, policy.highIntentMinimum),
      evidence: evidence("high-intent-event-count", highIntent.length, policy.highIntentMinimum, highIntent, "high-intent event threshold was reached"),
    });
  }

  const latest = allEvents.at(-1);
  const inactiveFor = latest ? policy.evaluatedAt - latest.occurredAt : policy.evaluatedAt - lead.createdAt;
  if (inactiveFor >= policy.staleAfterMs) {
    signals.push({
      kind: "stale-activity",
      disposition: "risk",
      strength: strength(inactiveFor, policy.staleAfterMs),
      evidence: evidence("inactive-duration-ms", inactiveFor, policy.staleAfterMs, latest ? [latest] : [], "no lead activity occurred within the freshness threshold"),
    });
  }

  const decisionEvents = recent.filter((event) => policy.decisionEventTypes.includes(event.type));
  if (decisionEvents.length >= policy.repeatedDecisionMinimum) {
    signals.push({
      kind: "repeated-decision-behavior",
      disposition: "opportunity",
      strength: strength(decisionEvents.length, policy.repeatedDecisionMinimum),
      evidence: evidence("decision-event-count", decisionEvents.length, policy.repeatedDecisionMinimum, decisionEvents, "decision-stage behavior repeated within the recent window"),
    });
  }

  const lifecycleChanges = (state.leadHistory[leadId] ?? [])
    .filter((change) => change.kind === "lifecycle-transitioned" && change.occurredAt <= policy.evaluatedAt)
    .sort((left, right) => left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id));
  const firstLifecycleChange = lifecycleChanges[0];
  const lastLifecycleChange = lifecycleChanges.at(-1);
  const progressionDuration = firstLifecycleChange && lastLifecycleChange
    ? lastLifecycleChange.occurredAt - firstLifecycleChange.occurredAt
    : Number.POSITIVE_INFINITY;
  if (lifecycleChanges.length >= 2 && progressionDuration <= policy.rapidProgressionMs) {
    signals.push({
      kind: "rapid-progression",
      disposition: "opportunity",
      strength: 1 - Math.min(1, progressionDuration / policy.rapidProgressionMs),
      evidence: evidence("lifecycle-progression-ms", progressionDuration, policy.rapidProgressionMs, [], "multiple lifecycle transitions completed within the progression threshold"),
    });
  }

  const dimensions = state.scoreProjections[leadId]?.dimensions ?? {};
  const fit = dimensions[policy.fitDimension] ?? 0;
  const engagement = dimensions[policy.engagementDimension] ?? 0;
  if (fit >= policy.strongDimensionThreshold && engagement <= policy.weakDimensionThreshold) {
    signals.push({
      kind: "strong-fit-low-engagement",
      disposition: "observation",
      strength: strength(fit, policy.strongDimensionThreshold),
      evidence: evidence("fit-dimension", fit, policy.strongDimensionThreshold, recent, "fit is strong while engagement remains weak"),
    });
  }
  if (engagement >= policy.strongDimensionThreshold && fit <= policy.weakDimensionThreshold) {
    signals.push({
      kind: "strong-engagement-weak-fit",
      disposition: "observation",
      strength: strength(engagement, policy.strongDimensionThreshold),
      evidence: evidence("engagement-dimension", engagement, policy.strongDimensionThreshold, recent, "engagement is strong while fit remains weak"),
    });
  }

  const qualification = state.qualifications[leadId]?.state;
  if (declining && (qualification === "marketing-qualified" || qualification === "sales-qualified")) {
    signals.push({
      kind: "qualification-risk",
      disposition: "risk",
      strength: 1,
      evidence: evidence("qualified-lead-recent-events", recent.length, previous.length, recent, "a qualified lead has materially declining engagement"),
    });
  }
  if (increasing && highIntent.length >= policy.highIntentMinimum) {
    signals.push({
      kind: "opportunity-acceleration",
      disposition: "opportunity",
      strength: 1,
      evidence: evidence("accelerating-high-intent-events", highIntent.length, policy.highIntentMinimum, highIntent, "engagement acceleration includes sufficient high-intent behavior"),
    });
  }

  const categoryCounts = new Map<string, number>();
  for (const event of recent) categoryCounts.set(event.category, (categoryCounts.get(event.category) ?? 0) + 1);
  const dominantCategoryCount = Math.max(0, ...categoryCounts.values());
  const concentration = recent.length === 0 ? 0 : dominantCategoryCount / recent.length;
  if (recent.length > 1 && concentration >= policy.concentrationRatio) {
    const concentratedEvents = recent.filter((event) => (categoryCounts.get(event.category) ?? 0) === dominantCategoryCount);
    signals.push({
      kind: "behavioral-concentration",
      disposition: "observation",
      strength: concentration,
      evidence: evidence("dominant-category-ratio", concentration, policy.concentrationRatio, concentratedEvents, "recent behavior is concentrated in one event category"),
    });
  }

  return {
    ok: true,
    value: { leadId, evaluatedAt: policy.evaluatedAt, recentWindowStart: recentStart, comparisonWindowStart: comparisonStart, signals },
  };
}

export interface Vector {
  [dimension: string]: number;
}

export interface ClusteringConfig {
  readonly maxIterations: number;
  readonly tolerance: number;
  readonly k: number;
}

export interface ClusterResult {
  readonly clusterId: number;
  readonly centroid: Vector;
  readonly leadIds: readonly string[];
}

// 1. K-Means Clustering for Leads (Deterministic Initialization)
export function kMeansClustering(state: EngineState, config: ClusteringConfig = { k: 3, maxIterations: 100, tolerance: 0.001 }): readonly ClusterResult[] {
  const leads = Object.values(state.leads).sort((a, b) => a.id.localeCompare(b.id));
  if (leads.length === 0) return [];
  if (leads.length <= config.k) {
    return leads.map((lead, i) => ({ clusterId: i, centroid: leadToVector(lead, state), leadIds: [lead.id] }));
  }

  const vectors = leads.map(l => ({ id: l.id, vec: leadToVector(l, state) }));
  const dimensions = Object.keys(vectors[0]!.vec);
  
  // Deterministic Initialization (K-Means++)
  const centroids: Vector[] = [];
  centroids.push({ ...vectors[0]!.vec });
  
  for (let i = 1; i < config.k; i++) {
    // Find the vector that maximizes distance to the nearest existing centroid
    let maxDist = -1;
    let bestCandidate: Vector | undefined = undefined;
    
    for (const v of vectors) {
      let minDist = Infinity;
      for (const c of centroids) {
        const d = euclideanDistance(v.vec, c, dimensions);
        if (d < minDist) minDist = d;
      }
      if (minDist > maxDist) {
        maxDist = minDist;
        bestCandidate = { ...v.vec };
      }
    }
    if (bestCandidate) centroids.push(bestCandidate);
  }
  
  let iterations = 0;
  let changed = true;
  let assignments = new Map<string, number>(); // leadId -> clusterId
  
  while (changed && iterations < config.maxIterations) {
    changed = false;
    iterations++;
    
    // Assignment Step
    const newAssignments = new Map<string, number>();
    for (const v of vectors) {
      let bestCluster = 0;
      let minDist = Infinity;
      for (let i = 0; i < config.k; i++) {
        const d = euclideanDistance(v.vec, centroids[i]!, dimensions);
        if (d < minDist) {
          minDist = d;
          bestCluster = i;
        }
      }
      newAssignments.set(v.id, bestCluster);
      if (assignments.get(v.id) !== bestCluster) changed = true;
    }
    assignments = newAssignments;
    
    // Update Step
    if (changed) {
      const clusterCounts = new Array(config.k).fill(0);
      const newCentroids: Record<string, number>[] = Array.from({ length: config.k }, () => ({}));
      
      for (const d of dimensions) {
        for (let i = 0; i < config.k; i++) {
          newCentroids[i]![d] = 0;
        }
      }
      
      for (const v of vectors) {
        const c = assignments.get(v.id)!;
        clusterCounts[c]++;
        for (const d of dimensions) {
          newCentroids[c]![d] = (newCentroids[c]![d] ?? 0) + (v.vec[d] ?? 0);
        }
      }
      
      for (let i = 0; i < config.k; i++) {
        const count = clusterCounts[i] ?? 0;
        const centroid = centroids[i];
        if (count > 0 && centroid) {
          for (const d of dimensions) {
            centroid[d] = (newCentroids[i]![d] ?? 0) / count;
          }
        }
      }
    }
  }
  
  const results: ClusterResult[] = [];
  for (let i = 0; i < config.k; i++) {
    const leadIds = vectors.filter(v => assignments.get(v.id) === i).map(v => v.id);
    if (leadIds.length > 0) {
      results.push({ clusterId: i, centroid: centroids[i]!, leadIds });
    }
  }
  
  return results;
}

function leadToVector(lead: Lead, state: EngineState): Vector {
  // Convert lead attributes and state into a numerical vector
  const vec: Record<string, number> = {};
  
  // Base Score
  vec['base_score'] = state.scores[lead.id] ?? 0;
  
  // Event category counts
  const events = state.eventIdsByLead[lead.id]?.map(id => state.events[id]!) ?? [];
  const cats: Record<string, number> = {};
  for (const e of events) cats[e.category] = (cats[e.category] ?? 0) + 1;
  
  vec['cat_engagement'] = cats['engagement'] ?? 0;
  vec['cat_intent'] = cats['intent'] ?? 0;
  vec['cat_commercial'] = cats['commercial'] ?? 0;
  vec['total_events'] = events.length;
  
  // Numerical attributes
  for (const [k, v] of Object.entries(lead.attributes)) {
    if (typeof v === 'number') vec[`attr_${k}`] = v;
    if (typeof v === 'boolean') vec[`attr_${k}`] = v ? 1 : 0;
  }
  
  return vec;
}

function euclideanDistance(a: Vector, b: Vector, dimensions: readonly string[]): number {
  let sumSq = 0;
  for (const d of dimensions) {
    const valA = a[d] ?? 0;
    const valB = b[d] ?? 0;
    sumSq += (valA - valB) * (valA - valB);
  }
  return Math.sqrt(sumSq);
}

// 2. Naive Bayes Classification (Predicting Qualification State)
export interface BayesModel {
  readonly classProbabilities: Readonly<Record<string, number>>;
  readonly featureProbabilities: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export function trainQualificationBayesClassifier(state: EngineState): BayesModel {
  const leads = Object.values(state.leads);
  const classCounts: Record<string, number> = {};
  const featureCounts: Record<string, Record<string, number>> = {};
  
  // Vocabulary for smoothing
  const vocab = new Set<string>();
  
  for (const lead of leads) {
    const qual = state.qualifications[lead.id]?.state ?? "unqualified";
    classCounts[qual] = (classCounts[qual] ?? 0) + 1;
    
    if (!featureCounts[qual]) featureCounts[qual] = {};
    
    // Extract features (categorical strings and event types)
    const features = extractCategoricalFeatures(lead, state);
    for (const f of features) {
      vocab.add(f);
      featureCounts[qual]![f] = (featureCounts[qual]![f] ?? 0) + 1;
    }
  }
  
  const V = vocab.size;
  const classProbs: Record<string, number> = {};
  const featProbs: Record<string, Record<string, number>> = {};
  
  for (const [cls, count] of Object.entries(classCounts)) {
    classProbs[cls] = count / leads.length;
    featProbs[cls] = {};
    
    // Total features in this class
    const totalFeatsInClass = Object.values(featureCounts[cls]!).reduce((a, b) => a + b, 0);
    
    for (const v of vocab) {
      const featCount = featureCounts[cls]![v] ?? 0;
      // Laplace smoothing
      featProbs[cls]![v] = (featCount + 1) / (totalFeatsInClass + V);
    }
  }
  
  return { classProbabilities: classProbs, featureProbabilities: featProbs };
}

export function predictQualificationBayes(lead: Lead, state: EngineState, model: BayesModel): string {
  const features = extractCategoricalFeatures(lead, state);
  let bestClass = "unqualified";
  let maxLogProb = -Infinity;
  
  for (const [cls, classProb] of Object.entries(model.classProbabilities)) {
    let logProb = Math.log(classProb);
    
    for (const f of features) {
      if (model.featureProbabilities[cls]![f]) {
        logProb += Math.log(model.featureProbabilities[cls]![f]!);
      }
    }
    
    if (logProb > maxLogProb) {
      maxLogProb = logProb;
      bestClass = cls;
    }
  }
  
  return bestClass;
}

function extractCategoricalFeatures(lead: Lead, state: EngineState): readonly string[] {
  const features: string[] = [];
  
  // Categorical attributes
  for (const [k, v] of Object.entries(lead.attributes)) {
    if (typeof v === 'string') {
      features.push(`attr_${k}_${v}`);
    }
  }
  
  // Event types
  const events = state.eventIdsByLead[lead.id]?.map(id => state.events[id]!) ?? [];
  const eventTypes = new Set(events.map(e => e.type));
  for (const t of eventTypes) {
    features.push(`has_event_${t}`);
  }
  
  return features;
}

// 3. DBSCAN for Outlier Detection (Deterministic)
export interface DBSCANConfig {
  readonly epsilon: number;
  readonly minPoints: number;
}

export interface DBSCANResult {
  readonly outliers: readonly string[]; // Lead IDs
  readonly clusters: readonly (readonly string[])[];
}

export function dbscanLeads(state: EngineState, config: DBSCANConfig = { epsilon: 10, minPoints: 3 }): DBSCANResult {
  const leads = Object.values(state.leads).sort((a, b) => a.id.localeCompare(b.id));
  const vectors = leads.map(l => ({ id: l.id, vec: leadToVector(l, state) }));
  const dimensions = vectors.length > 0 ? Object.keys(vectors[0]!.vec) : [];
  
  const visited = new Set<string>();
  const isNoise = new Set<string>();
  const clusters: string[][] = [];
  
  function regionQuery(p: { id: string, vec: Vector }): typeof vectors {
    return vectors.filter(q => euclideanDistance(p.vec, q.vec, dimensions) <= config.epsilon);
  }
  
  for (const p of vectors) {
    if (visited.has(p.id)) continue;
    visited.add(p.id);
    
    const neighbors = regionQuery(p);
    if (neighbors.length < config.minPoints) {
      isNoise.add(p.id);
    } else {
      const c: string[] = [];
      clusters.push(c);
      
      c.push(p.id);
      
      // Expand cluster
      const queue = [...neighbors];
      while (queue.length > 0) {
        const q = queue.shift()!;
        if (isNoise.has(q.id)) {
          isNoise.delete(q.id);
          c.push(q.id);
        }
        if (!visited.has(q.id)) {
          visited.add(q.id);
          const qNeighbors = regionQuery(q);
          if (qNeighbors.length >= config.minPoints) {
            queue.push(...qNeighbors);
          }
          c.push(q.id);
        }
      }
    }
  }
  
  return {
    outliers: [...isNoise].sort(),
    clusters: clusters.map(c => c.sort()),
  };
}

// 4. Collaborative Filtering: Lead Similarity Matrix
export interface SimilarityPair {
  readonly leadIdA: string;
  readonly leadIdB: string;
  readonly similarityScore: number;
}

export function computeLeadSimilarities(state: EngineState, topN: number = 10): readonly SimilarityPair[] {
  const leads = Object.values(state.leads).sort((a, b) => a.id.localeCompare(b.id));
  const vectors = leads.map(l => ({ id: l.id, vec: leadToVector(l, state) }));
  const dimensions = vectors.length > 0 ? Object.keys(vectors[0]!.vec) : [];
  
  const pairs: SimilarityPair[] = [];
  
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const a = vectors[i]!;
      const b = vectors[j]!;
      
      // Cosine Similarity
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      
      for (const d of dimensions) {
        const valA = a.vec[d] ?? 0;
        const valB = b.vec[d] ?? 0;
        dotProduct += valA * valB;
        normA += valA * valA;
        normB += valB * valB;
      }
      
      const similarity = (normA === 0 || normB === 0) ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      
      if (similarity > 0) {
        pairs.push({ leadIdA: a.id, leadIdB: b.id, similarityScore: similarity });
      }
    }
  }
  
  return pairs.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, topN);
}

// 5. Linear Regression Trend Prediction (Events over Time)
export interface TrendPrediction {
  readonly slope: number;
  readonly intercept: number;
  readonly rSquared: number;
  readonly futurePrediction: number; // Value at next interval
}

export function predictEventVolumeTrend(state: EngineState, leadId: string, intervalMs: number = 86400000): TrendPrediction {
  const events = getLeadEvents(state, leadId);
  if (events.length < 2) return { slope: 0, intercept: 0, rSquared: 0, futurePrediction: 0 };
  
  const minTime = events[0]!.occurredAt;
  const maxTime = events[events.length - 1]!.occurredAt;
  
  // Bin events into intervals
  const bins = new Map<number, number>();
  for (const e of events) {
    const binIdx = Math.floor((e.occurredAt - minTime) / intervalMs);
    bins.set(binIdx, (bins.get(binIdx) ?? 0) + 1);
  }
  
  const maxBin = Math.floor((maxTime - minTime) / intervalMs);
  const xs: number[] = [];
  const ys: number[] = [];
  
  for (let i = 0; i <= maxBin; i++) {
    xs.push(i);
    ys.push(bins.get(i) ?? 0);
  }
  
  // Linear regression
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i]!, 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: ys[0]!, rSquared: 0, futurePrediction: ys[0]! };
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // R-squared
  const yMean = sumY / n;
  const ssTotal = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
  const ssResidual = ys.reduce((s, y, i) => {
    const predicted = slope * xs[i]! + intercept;
    return s + Math.pow(y - predicted, 2);
  }, 0);
  const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
  
  return {
    slope,
    intercept,
    rSquared,
    futurePrediction: Math.max(0, slope * (maxBin + 1) + intercept)
  };
}

// 6. Markov Chain Lead Lifecycle Transitions
export interface TransitionMatrix {
  readonly states: readonly LifecycleState[];
  readonly matrix: readonly (readonly number[])[];
}

export function buildLifecycleMarkovChain(state: EngineState): TransitionMatrix {
  const lifecycleStates: readonly LifecycleState[] = ["new", "contacted", "nurturing", "qualified", "converted", "rejected"];
  const isLifecycleState = (value: unknown): value is LifecycleState => typeof value === "string" && lifecycleStates.includes(value as LifecycleState);
  const transitions = new Map<LifecycleState, Map<LifecycleState, number>>();
  const statesSet = new Set<LifecycleState>(Object.values(state.leads).map((lead) => lead.lifecycle));

  for (const changes of Object.values(state.leadHistory)) {
    const ordered = [...changes].sort((left, right) => left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id));
    for (const change of ordered) {
      if (change.kind !== "lifecycle-transitioned") continue;
      const from = change.previous["lifecycle"];
      const to = change.next["lifecycle"];
      if (!isLifecycleState(from) || !isLifecycleState(to)) continue;
      statesSet.add(from);
      statesSet.add(to);
      const departures = transitions.get(from) ?? new Map<LifecycleState, number>();
      departures.set(to, (departures.get(to) ?? 0) + 1);
      transitions.set(from, departures);
    }
  }

  const states = lifecycleStates.filter((lifecycle) => statesSet.has(lifecycle));
  const matrix: number[][] = [];
  
  for (let i = 0; i < states.length; i++) {
    const row = new Array(states.length).fill(0);
    matrix.push(row);
    
    const fromState = states[i]!;
    const map = transitions.get(fromState);
    if (!map || map.size === 0) {
      row[i] = 1.0;
      continue;
    }
    
    let total = 0;
    for (const count of map.values()) {
      total += count;
    }
    
    for (const [toState, count] of map.entries()) {
      const j = states.indexOf(toState);
      if (j >= 0) row[j] = count / total;
    }
  }
  
  return { states, matrix };
}

// --- Linear margin classifier ---

export interface SVMModel {
  readonly weights: Readonly<Record<string, number>>;
  readonly bias: number;
}

export function trainLinearSVM(state: EngineState, epochs: number = 100, learningRate: number = 0.01): SVMModel {
  const leads = Object.values(state.leads);
  const weights: Record<string, number> = {};
  let bias = 0;
  
  const dataset = leads.map(l => {
    const vec = leadToVector(l, state);
    const isQual = state.qualifications[l.id]?.state === "marketing-qualified" || state.qualifications[l.id]?.state === "sales-qualified";
    const label = isQual ? 1 : -1;
    return { vec, label };
  });
  
  // Initialize weights
  if (dataset.length > 0) {
    for (const d of Object.keys(dataset[0]!.vec)) {
      weights[d] = 0;
    }
  }
  
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const { vec, label } of dataset) {
      let wx = bias;
      for (const [k, v] of Object.entries(vec)) {
        wx += (weights[k] ?? 0) * v;
      }
      
      const condition = label * wx < 1;
      
      for (const [k, v] of Object.entries(vec)) {
        if (condition) {
          weights[k] = (weights[k] ?? 0) + learningRate * (label * v - 2 * 0.01 * (weights[k] ?? 0));
        } else {
          weights[k] = (weights[k] ?? 0) + learningRate * (-2 * 0.01 * (weights[k] ?? 0));
        }
      }
      if (condition) bias += learningRate * label;
    }
  }
  
  return { weights, bias };
}

export function predictSVM(lead: Lead, state: EngineState, model: SVMModel): number {
  const vec = leadToVector(lead, state);
  let wx = model.bias;
  for (const [k, v] of Object.entries(vec)) {
    wx += (model.weights[k] ?? 0) * v;
  }
  return wx; // > 0 means positive class
}

// --- Median isolation forest ---

export interface IsolationNode {
  readonly feature?: string;
  readonly splitValue?: number;
  readonly size: number;
  readonly left?: IsolationNode;
  readonly right?: IsolationNode;
}

export interface IsolationForest {
  readonly trees: readonly IsolationNode[];
  readonly sampleSize: number;
}

export function buildIsolationForest(state: EngineState, numTrees: number = 50, sampleSize: number = 256): IsolationForest {
  const leads = Object.values(state.leads).sort((left, right) => left.id.localeCompare(right.id));
  const vectors = leads.map(l => leadToVector(l, state));
  const dimensions = vectors.length > 0 ? Object.keys(vectors[0]!) : [];
  
  if (vectors.length === 0 || dimensions.length === 0) return { trees: [], sampleSize: 0 };
  
  const trees: IsolationNode[] = [];
  
  for (let t = 0; t < numTrees; t++) {
    // Rotate the ledger-ordered population. This keeps every input observable
    // while varying the bounded sample without randomness.
    const limit = Math.min(sampleSize, vectors.length);
    const offset = vectors.length === 0 ? 0 : (t * limit) % vectors.length;
    const sample = Array.from({ length: limit }, (_, index) => vectors[(offset + index) % vectors.length]!);
    if (sample.length === 0) continue;
    
    function buildNode(data: Vector[], depth: number): IsolationNode {
      if (data.length <= 1 || depth > 10) return { size: data.length };
      
      const featureIdx = (t + depth) % dimensions.length;
      const feature = dimensions[featureIdx]!;
      const ordered = [...data].sort((left, right) => (left[feature] ?? 0) - (right[feature] ?? 0));
      const splitValue = ordered[Math.floor((ordered.length - 1) / 2)]![feature] ?? 0;
      if ((ordered[0]![feature] ?? 0) === (ordered[ordered.length - 1]![feature] ?? 0)) return { size: data.length };
      
      const leftData = data.filter(v => (v[feature] ?? 0) <= splitValue);
      const rightData = data.filter(v => (v[feature] ?? 0) > splitValue);
      
      return {
        feature,
        splitValue,
        size: data.length,
        left: buildNode(leftData, depth + 1),
        right: buildNode(rightData, depth + 1)
      };
    }
    
    trees.push(buildNode(sample, 0));
  }
  
  return { trees, sampleSize };
}

export function isolationForestPredict(lead: Lead, state: EngineState, forest: IsolationForest): number {
  if (forest.trees.length === 0) return 0;
  
  const vec = leadToVector(lead, state);
  let pathLengthSum = 0;
  
  for (const tree of forest.trees) {
    let current: IsolationNode | undefined = tree;
    let pathLength = 0;
    
    while (current && current.feature && current.splitValue !== undefined) {
      pathLength++;
      const val = vec[current.feature] ?? 0;
      if (val <= current.splitValue) {
        current = current.left;
      } else {
        current = current.right;
      }
    }
    
    // c(size) adjustment
    if (current && current.size > 1) {
      const c = 2 * (Math.log(current.size - 1) + 0.5772156649) - (2 * (current.size - 1) / current.size);
      pathLength += c;
    }
    
    pathLengthSum += pathLength;
  }
  
  const avgPathLength = pathLengthSum / forest.trees.length;
  const cSampleSize = forest.sampleSize > 1 ? 2 * (Math.log(forest.sampleSize - 1) + 0.5772156649) - (2 * (forest.sampleSize - 1) / forest.sampleSize) : 1;
  
  return Math.pow(2, -avgPathLength / cSampleSize);
}

// --- Collaborative Filtering (Lead-Segment Recommendation) ---

export function recommendSegments(lead: Lead, state: EngineState, topN: number = 3): string[] {
  const leadVec = leadToVector(lead, state);
  const dims = Object.keys(leadVec);
  
  const others = Object.values(state.leads).filter(l => l.id !== lead.id);
  
  // Calculate similarity to all other leads
  const similarities = others.map(l => {
    const v = leadToVector(l, state);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const d of dims) {
      const a = leadVec[d] ?? 0;
      const b = v[d] ?? 0;
      dot += a * b;
      normA += a * a;
      normB += b * b;
    }
    const sim = (normA === 0 || normB === 0) ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return { id: l.id, sim };
  });
  
  similarities.sort((a, b) => b.sim - a.sim);
  const topK = similarities.slice(0, 10); // K nearest neighbors
  
  const segmentScores = new Map<string, number>();
  
  for (const neighbor of topK) {
    const seg = state.segments[neighbor.id]?.segment;
    if (seg) {
      segmentScores.set(seg, (segmentScores.get(seg) ?? 0) + neighbor.sim);
    }
  }
  
  return Array.from(segmentScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(e => e[0]);
}

// --- Markov Chain Conversion Forecaster ---

export interface ConversionProbability {
  readonly lifecycle: string;
  readonly conversionProb: number;
}

export function buildMarkovConversionModel(state: EngineState): readonly ConversionProbability[] {
  const lifecycles = ["new", "contacted", "nurturing", "qualified", "converted", "rejected"] as const;
  const transitions: Record<string, { departures: number; conversions: number }> = Object.fromEntries(lifecycles.map((lifecycle) => [lifecycle, { departures: 0, conversions: 0 }]));
  for (const changes of Object.values(state.leadHistory)) {
    for (const change of changes) {
      if (change.kind !== "lifecycle-transitioned") continue;
      const from = typeof change.previous.lifecycle === "string" ? change.previous.lifecycle : undefined;
      const to = typeof change.next.lifecycle === "string" ? change.next.lifecycle : undefined;
      if (!from || !to || !transitions[from]) continue;
      transitions[from]!.departures += 1;
      if (to === "converted") transitions[from]!.conversions += 1;
    }
  }
  return lifecycles.map((lifecycle) => {
    if (lifecycle === "converted") return { lifecycle, conversionProb: 1 };
    if (lifecycle === "rejected") return { lifecycle, conversionProb: 0 };
    const observed = transitions[lifecycle]!;
    return { lifecycle, conversionProb: observed.departures === 0 ? 0 : observed.conversions / observed.departures };
  });
}
