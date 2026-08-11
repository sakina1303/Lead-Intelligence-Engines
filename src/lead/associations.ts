import type { EngineState, Lead } from "../contracts.js";
import { getEmailDomain } from "./identity.js";

export interface LeadAssociation {
  readonly sourceLeadId: string;
  readonly targetLeadId: string;
  readonly relationType: "colleague" | "manager" | "subordinate" | "referrer" | "similar_profile";
  readonly strength: number;
}

export interface BuyingCenter {
  readonly id: string;
  readonly name: string;
  readonly memberLeadIds: readonly string[];
  readonly totalScore: number;
}

export function buildLeadAssociations(state: EngineState): readonly LeadAssociation[] {
  const associations: LeadAssociation[] = [];
  const domainGroups: Record<string, Lead[]> = {};
  for (const lead of Object.values(state.leads)) {
    const domain = getEmailDomain(lead.email);
    if (domain && !["gmail.com", "yahoo.com"].includes(domain)) (domainGroups[domain] ??= []).push(lead);
  }
  for (const domainLeads of Object.values(domainGroups)) {
    for (let left = 0; left < domainLeads.length; left += 1) {
      for (let right = left + 1; right < domainLeads.length; right += 1) {
        associations.push({ sourceLeadId: domainLeads[left]!.id, targetLeadId: domainLeads[right]!.id, relationType: "colleague", strength: 0.8 });
        associations.push({ sourceLeadId: domainLeads[right]!.id, targetLeadId: domainLeads[left]!.id, relationType: "colleague", strength: 0.8 });
      }
    }
  }
  for (const lead of Object.values(state.leads)) {
    const referrerId = lead.attributes["referred_by_lead_id"];
    if (typeof referrerId === "string" && state.leads[referrerId]) associations.push({ sourceLeadId: referrerId, targetLeadId: lead.id, relationType: "referrer", strength: 0.95 });
  }
  return associations;
}

export function identifyBuyingCenters(state: EngineState, associations: readonly LeadAssociation[]): readonly BuyingCenter[] {
  const parents = new Map(Object.keys(state.leads).map((leadId) => [leadId, leadId]));
  const find = (leadId: string): string => {
    const parent = parents.get(leadId);
    if (!parent || parent === leadId) return leadId;
    const root = find(parent);
    parents.set(leadId, root);
    return root;
  };
  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents.set(leftRoot.localeCompare(rightRoot) < 0 ? rightRoot : leftRoot, leftRoot.localeCompare(rightRoot) < 0 ? leftRoot : rightRoot);
  };
  for (const association of associations) if (association.relationType === "colleague") union(association.sourceLeadId, association.targetLeadId);
  const groups = new Map<string, string[]>();
  for (const leadId of Object.keys(state.leads)) (groups.get(find(leadId)) ?? (() => { const group: string[] = []; groups.set(find(leadId), group); return group; })()).push(leadId);
  let index = 1;
  return [...groups.entries()].filter(([, members]) => members.length > 1).map(([root, members]) => {
    const orderedMembers = [...members].sort();
    const domain = orderedMembers.map((leadId) => getEmailDomain(state.leads[leadId]!.email)).find((value) => value && value !== "gmail.com") ?? "";
    const center: BuyingCenter = { id: `bc_${domain || root}_${index}`, name: domain ? `${domain} Buying Center` : `Buying Center ${index}`, memberLeadIds: orderedMembers, totalScore: orderedMembers.reduce((sum, leadId) => sum + (state.scores[leadId] ?? 0), 0) };
    index += 1;
    return center;
  }).sort((left, right) => right.totalScore - left.totalScore || left.id.localeCompare(right.id));
}
