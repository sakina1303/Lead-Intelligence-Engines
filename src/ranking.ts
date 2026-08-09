import type { EngineState, RankEntry, QualificationState } from "./contracts.js";

const qualificationWeight: Record<QualificationState, number> = { "sales-qualified": 3, "marketing-qualified": 2, unqualified: 1, disqualified: 0 };

export interface AdvancedRankConfig {
  readonly useRecency?: boolean;
  readonly useDimensions?: readonly string[];
  readonly useEngagementVelocity?: boolean;
}

export function rankLeads(state: EngineState, config?: AdvancedRankConfig): readonly RankEntry[] {
  return Object.values(state.leads).map((lead) => {
    const score = state.scores[lead.id] ?? 0;
    const qualification = state.qualifications[lead.id]?.state ?? "unqualified";
    
    // Compute recency hash (deterministic) based on latest event timestamp
    const latestEventId = state.eventIdsByLead[lead.id]?.slice(-1)[0];
    const latestEvent = latestEventId ? state.events[latestEventId] : undefined;
    const recencyTs = latestEvent ? latestEvent.occurredAt : 0;
    
    // Dimension fallback values
    const projection = state.scoreProjections[lead.id];
    const dimensions = projection?.dimensions ?? {};
    
    return {
      leadId: lead.id,
      score,
      qualification,
      recencyTs,
      dimensions
    };
  }).sort((left, right) => {
    // 1. Primary total score
    if (right.score !== left.score) return right.score - left.score;
    
    // 2. Secondary: Qualification state weight
    const qualDiff = qualificationWeight[right.qualification] - qualificationWeight[left.qualification];
    if (qualDiff !== 0) return qualDiff;
    
    // 3. Optional Dimension fallbacks
    if (config?.useDimensions) {
      for (const dim of config.useDimensions) {
        const rDim = right.dimensions[dim] ?? 0;
        const lDim = left.dimensions[dim] ?? 0;
        if (rDim !== lDim) return rDim - lDim;
      }
    }
    
    // 4. Optional Recency
    if (config?.useRecency) {
      if (right.recencyTs !== left.recencyTs) return right.recencyTs - left.recencyTs;
    }
    
    // 5. Lexical deterministic tie-breaker
    return left.leadId.localeCompare(right.leadId);
  }).map((entry, index) => ({ 
    leadId: entry.leadId,
    score: entry.score,
    qualification: entry.qualification,
    rank: index + 1 
  }));
}

// --- Cohort-Based Rank Percentiles ---

export interface RankPercentileResult {
  readonly leadId: string;
  readonly globalPercentile: number;
  readonly segmentPercentile?: number;
  readonly lifecyclePercentile: number;
}

export function computeRankPercentiles(state: EngineState): readonly RankPercentileResult[] {
  const globalRank = rankLeads(state);
  const totalLeads = globalRank.length;
  
  const leadsBySegment = new Map<string, string[]>();
  const leadsByLifecycle = new Map<string, string[]>();
  
  for (const lead of Object.values(state.leads)) {
    const seg = state.segments[lead.id]?.segment ?? "unsegmented";
    if (!leadsBySegment.has(seg)) leadsBySegment.set(seg, []);
    leadsBySegment.get(seg)!.push(lead.id);
    
    if (!leadsByLifecycle.has(lead.lifecycle)) leadsByLifecycle.set(lead.lifecycle, []);
    leadsByLifecycle.get(lead.lifecycle)!.push(lead.id);
  }
  
  const results: RankPercentileResult[] = [];
  
  for (const entry of globalRank) {
    const lead = state.leads[entry.leadId]!;
    const seg = state.segments[entry.leadId]?.segment ?? "unsegmented";
    
    // Global percentile
    const globalPercentile = totalLeads <= 1 ? 100 : ((totalLeads - entry.rank) / (totalLeads - 1)) * 100;
    
    // Segment percentile
    let segmentPercentile: number | undefined = undefined;
    const segLeads = leadsBySegment.get(seg)!;
    if (segLeads.length > 1) {
      const segRank = segLeads.sort((a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0)).indexOf(lead.id);
      segmentPercentile = ((segLeads.length - 1 - segRank) / (segLeads.length - 1)) * 100;
    } else if (segLeads.length === 1) {
      segmentPercentile = 100;
    }
    
    // Lifecycle percentile
    let lifecyclePercentile = 100;
    const lfLeads = leadsByLifecycle.get(lead.lifecycle)!;
    if (lfLeads.length > 1) {
      const lfRank = lfLeads.sort((a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0)).indexOf(lead.id);
      lifecyclePercentile = ((lfLeads.length - 1 - lfRank) / (lfLeads.length - 1)) * 100;
    }
    
    results.push({
      leadId: lead.id,
      globalPercentile,
      segmentPercentile,
      lifecyclePercentile
    });
  }
  
  return results;
}

// --- Deterministic Elo-Style Pairwise Ranking ---

export interface EloConfig {
  readonly kFactor: number;
  readonly baseRating: number;
}

export interface EloMatchup {
  readonly winnerLeadId: string;
  readonly loserLeadId: string;
  readonly matchScoreDiff: number;
}

export function computeEloRatings(state: EngineState, matchups: readonly EloMatchup[], config: EloConfig = { kFactor: 32, baseRating: 1200 }): Readonly<Record<string, number>> {
  const ratings: Record<string, number> = {};
  
  // Initialize all leads to base rating
  for (const leadId of Object.keys(state.leads)) {
    ratings[leadId] = config.baseRating;
  }
  
  // Deterministically sort matchups by some canonical property (e.g. string representation) to ensure same results regardless of array order
  const sortedMatchups = [...matchups].sort((a, b) => 
    a.winnerLeadId.localeCompare(b.winnerLeadId) || 
    a.loserLeadId.localeCompare(b.loserLeadId) || 
    a.matchScoreDiff - b.matchScoreDiff
  );
  
  for (const matchup of sortedMatchups) {
    if (!ratings[matchup.winnerLeadId] || !ratings[matchup.loserLeadId]) continue;
    
    const rA = ratings[matchup.winnerLeadId]!;
    const rB = ratings[matchup.loserLeadId]!;
    
    // Expected scores (logistic curve)
    const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
    const eB = 1 / (1 + Math.pow(10, (rA - rB) / 400));
    
    // Outcome: winner is A (score 1), loser is B (score 0)
    // We also scale kFactor by the matchScoreDiff to give more weight to decisive wins
    const dynamicK = config.kFactor * Math.max(1, Math.min(3, matchup.matchScoreDiff / 10));
    
    ratings[matchup.winnerLeadId] = rA + dynamicK * (1 - eA);
    ratings[matchup.loserLeadId] = rB + dynamicK * (0 - eB);
  }
  
  return ratings;
}

export function generateSyntheticMatchupsFromScoreProjections(state: EngineState): readonly EloMatchup[] {
  const matchups: EloMatchup[] = [];
  const leads = Object.values(state.leads);
  
  for (let i = 0; i < leads.length; i++) {
    for (let j = i + 1; j < leads.length; j++) {
      const a = leads[i]!;
      const b = leads[j]!;
      
      const scoreA = state.scores[a.id] ?? 0;
      const scoreB = state.scores[b.id] ?? 0;
      
      const projA = state.scoreProjections[a.id]?.total ?? scoreA;
      const projB = state.scoreProjections[b.id]?.total ?? scoreB;
      
      if (projA > projB) {
        matchups.push({ winnerLeadId: a.id, loserLeadId: b.id, matchScoreDiff: projA - projB });
      } else if (projB > projA) {
        matchups.push({ winnerLeadId: b.id, loserLeadId: a.id, matchScoreDiff: projB - projA });
      }
    }
  }
  
  return matchups;
}
