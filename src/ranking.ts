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
