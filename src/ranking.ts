import type { EngineState, RankEntry } from "./contracts.js";

const qualificationWeight = { "sales-qualified": 3, "marketing-qualified": 2, unqualified: 1, disqualified: 0 } as const;

export function rankLeads(state: EngineState): readonly RankEntry[] {
  return Object.values(state.leads).map((lead) => ({
    leadId: lead.id,
    score: state.scores[lead.id] ?? 0,
    qualification: state.qualifications[lead.id]?.state ?? "unqualified",
  })).sort((left, right) =>
    right.score - left.score ||
    qualificationWeight[right.qualification] - qualificationWeight[left.qualification] ||
    left.leadId.localeCompare(right.leadId),
  ).map((entry, index) => ({ ...entry, rank: index + 1 }));
}
