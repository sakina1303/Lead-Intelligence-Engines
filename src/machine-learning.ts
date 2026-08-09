import type { EngineState, Lead } from "./contracts.js";
import { getLeadEvents } from "./event-ledger.js";

// --- Deterministic Pseudo-ML Analytics for Leads ---
// This module provides deterministic, pure-function implementations of classical ML algorithms
// adapted for Lead Intelligence. It avoids Math.random() entirely, using stable hashing
// for any required seed initialization.

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
          newCentroids[c]![d] += v.vec[d] ?? 0;
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
  readonly states: readonly string[];
  readonly matrix: readonly (readonly number[])[];
}

export function buildLifecycleMarkovChain(state: EngineState): TransitionMatrix {
  const transitions = new Map<string, Map<string, number>>();
  const statesSet = new Set<string>();
  
  for (const lead of Object.values(state.leads)) {
    // In a real system, we'd look at audit log / history for state transitions.
    // Here we'll simulate by assuming creation -> current lifecycle.
    statesSet.add("new");
    statesSet.add(lead.lifecycle);
    
    if (lead.lifecycle !== "new") {
      if (!transitions.has("new")) transitions.set("new", new Map());
      const map = transitions.get("new")!;
      map.set(lead.lifecycle, (map.get(lead.lifecycle) ?? 0) + 1);
    }
  }
  
  const states = [...statesSet].sort();
  const matrix: number[][] = [];
  
  for (let i = 0; i < states.length; i++) {
    const row = new Array(states.length).fill(0);
    matrix.push(row);
    
    const fromState = states[i]!;
    const map = transitions.get(fromState);
    if (!map) {
      // Absorbing state (100% chance to stay)
      row[i] = 1.0;
      continue;
    }
    
    let total = 0;
    for (const count of map.values()) {
      total += count;
    }
    
    if (total === 0) {
      row[i] = 1.0;
    } else {
      for (const [toState, count] of map.entries()) {
        const j = states.indexOf(toState);
        row[j] = count / total;
      }
    }
  }
  
  return { states, matrix };
}
