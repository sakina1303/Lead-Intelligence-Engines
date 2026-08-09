import type { CreateLeadInput, EngineState, Lead, LifecycleState, Outcome, Timestamp } from "./contracts.js";
import { failure, success, validEmail, validId, validTimestamp, validateAttributes } from "./validation.js";

const transitions: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = {
  new: ["contacted", "nurturing", "qualified", "rejected"],
  contacted: ["nurturing", "qualified", "rejected"],
  nurturing: ["contacted", "qualified", "rejected"],
  qualified: ["converted", "rejected"],
  converted: [],
  rejected: [],
};

export function createLead(input: CreateLeadInput): Outcome<Lead> {
  const errors = [
    ...(!validId(input.id) ? ["lead id is required"] : []),
    ...(input.name.trim().length < 2 ? ["lead name must contain at least two characters"] : []),
    ...(!validEmail(input.email) ? ["lead email must be valid"] : []),
    ...(!validTimestamp(input.createdAt) ? ["lead createdAt must be a non-negative safe integer"] : []),
    ...validateAttributes(input.attributes ?? {}),
  ];
  if (errors.length > 0) return failure(...errors);
  return success({
    id: input.id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company?.trim() ?? "",
    attributes: { ...(input.attributes ?? {}) },
    lifecycle: input.lifecycle ?? "new",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function addLead(state: EngineState, input: CreateLeadInput): Outcome<EngineState> {
  const result = createLead(input);
  if (!result.ok) return result;
  if (state.leads[result.value.id]) return failure(`lead '${result.value.id}' already exists`);
  return success({
    ...state,
    leads: { ...state.leads, [result.value.id]: result.value },
    scores: { ...state.scores, [result.value.id]: 0 },
    eventIdsByLead: { ...state.eventIdsByLead, [result.value.id]: [] },
    scoreHistory: { ...state.scoreHistory, [result.value.id]: [] },
  });
}

export function updateLeadAttributes(state: EngineState, leadId: string, attributes: Readonly<Record<string, string | number | boolean>>, updatedAt: Timestamp): Outcome<EngineState> {
  const lead = state.leads[leadId];
  if (!lead) return failure(`lead '${leadId}' does not exist`);
  const errors = [...(!validTimestamp(updatedAt) ? ["updatedAt must be valid"] : []), ...validateAttributes(attributes)];
  if (errors.length > 0) return failure(...errors);
  if (updatedAt < lead.updatedAt) return failure("updatedAt cannot precede the current lead update");
  return success({ ...state, leads: { ...state.leads, [leadId]: { ...lead, attributes: { ...lead.attributes, ...attributes }, updatedAt } } });
}

export function transitionLifecycle(state: EngineState, leadId: string, target: LifecycleState, updatedAt: Timestamp): Outcome<EngineState> {
  const lead = state.leads[leadId];
  if (!lead) return failure(`lead '${leadId}' does not exist`);
  if (!validTimestamp(updatedAt) || updatedAt < lead.updatedAt) return failure("updatedAt must not precede the current lead update");
  if (lead.lifecycle === target) return success(state);
  if (!transitions[lead.lifecycle].includes(target)) return failure(`cannot transition from '${lead.lifecycle}' to '${target}'`);
  return success({ ...state, leads: { ...state.leads, [leadId]: { ...lead, lifecycle: target, updatedAt } } });
}

export function allowedLifecycleTransitions(lifecycle: LifecycleState): readonly LifecycleState[] {
  return transitions[lifecycle];
}

// --- Deterministic Ownership & Capacity Routing ---

export interface SalesRep {
  readonly id: string;
  readonly name: string;
  readonly territoryId: string;
  readonly currentActiveLeads: number;
  readonly maxCapacity: number;
  readonly isActive: boolean;
  readonly skills: readonly string[];
}

export interface RoutingTerritory {
  readonly id: string;
  readonly name: string;
  readonly requiredAttributes: Readonly<Record<string, string>>;
  readonly fallbackRepId?: string;
  readonly isGlobal: boolean;
}

export interface RoutingResult {
  readonly leadId: string;
  readonly repId: string | null;
  readonly territoryId: string | null;
  readonly reasons: readonly string[];
}

export function evaluateRoutingTerritory(lead: Lead, territories: readonly RoutingTerritory[]): RoutingTerritory | undefined {
  const sorted = [...territories].sort((a, b) => b.isGlobal === a.isGlobal ? a.id.localeCompare(b.id) : a.isGlobal ? 1 : -1);
  return sorted.find(t => {
    return Object.entries(t.requiredAttributes).every(([k, v]) => lead.attributes[k] === v);
  });
}

export function assignSalesRep(lead: Lead, territory: RoutingTerritory, reps: readonly SalesRep[], timestamp: Timestamp): RoutingResult {
  const eligibleReps = reps.filter(r => r.isActive && (r.territoryId === territory.id || territory.isGlobal) && r.currentActiveLeads < r.maxCapacity);
  
  if (eligibleReps.length === 0) {
    if (territory.fallbackRepId) {
      const fallback = reps.find(r => r.id === territory.fallbackRepId);
      if (fallback && fallback.isActive) return { leadId: lead.id, repId: fallback.id, territoryId: territory.id, reasons: ["assigned to territory fallback due to capacity"] };
    }
    return { leadId: lead.id, repId: null, territoryId: territory.id, reasons: ["no active reps with capacity in territory"] };
  }

  // Deterministic round-robin based on state hash mapping to rep index
  const hashVal = lead.id.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0) + timestamp;
  const sortedEligible = eligibleReps.sort((a, b) => a.id.localeCompare(b.id));
  const selectedIndex = Math.abs(hashVal) % sortedEligible.length;
  const selected = sortedEligible[selectedIndex]!;
  
  return { leadId: lead.id, repId: selected.id, territoryId: territory.id, reasons: ["assigned via deterministic hashing"] };
}

export function mergeLeadsDeterministic(primary: Lead, secondary: Lead, timestamp: Timestamp): Outcome<Lead> {
  if (primary.id === secondary.id) return failure("cannot merge lead with itself");
  if (!validTimestamp(timestamp)) return failure("timestamp must be valid");
  if (timestamp < primary.updatedAt || timestamp < secondary.updatedAt) return failure("merge timestamp cannot precede lead updates");

  // Deterministic attribute resolution: longest string wins, true wins over false, higher number wins
  const mergedAttributes = { ...primary.attributes };
  for (const [key, val] of Object.entries(secondary.attributes)) {
    const existing = mergedAttributes[key];
    if (existing === undefined) {
      mergedAttributes[key] = val;
    } else if (typeof existing === 'string' && typeof val === 'string') {
      if (val.length > existing.length) mergedAttributes[key] = val;
      else if (val.length === existing.length && val.localeCompare(existing) > 0) mergedAttributes[key] = val;
    } else if (typeof existing === 'number' && typeof val === 'number') {
      if (val > existing) mergedAttributes[key] = val;
    } else if (typeof existing === 'boolean' && typeof val === 'boolean') {
      if (val === true) mergedAttributes[key] = true;
    }
  }

  return success({
    id: primary.id,
    name: primary.name,
    email: primary.email,
    company: primary.company || secondary.company,
    attributes: mergedAttributes,
    lifecycle: primary.lifecycle, 
    createdAt: Math.min(primary.createdAt, secondary.createdAt),
    updatedAt: timestamp
  });
}

// --- Advanced Lead Identity Resolution (Deterministic Deduplication) ---

export interface IdentityResolutionConfig {
  readonly exactMatchAttributes: readonly string[];
  readonly fuzzyMatchAttributes: readonly string[];
  readonly emailDomainMatchWeight: number;
  readonly similarityThreshold: number;
}

export interface IdentityMatch {
  readonly leadIdA: string;
  readonly leadIdB: string;
  readonly confidence: number;
  readonly matchReasons: readonly string[];
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(matrix[i - 1]![j - 1]! + 1, Math.min(matrix[i]![j - 1]! + 1, matrix[i - 1]![j]! + 1));
      }
    }
  }
  return matrix[b.length]![a.length]!;
}

export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - (levenshteinDistance(a, b) / maxLen);
}

export function getEmailDomain(email: string): string {
  const parts = email.split('@');
  if (parts.length === 2) return parts[1]!;
  return "";
}

export function evaluateLeadSimilarity(leadA: Lead, leadB: Lead, config: IdentityResolutionConfig): IdentityMatch {
  let score = 0;
  const reasons: string[] = [];
  let maxPossibleScore = 0;
  
  // Exact matches
  for (const attr of config.exactMatchAttributes) {
    maxPossibleScore += 1.0;
    if (leadA.attributes[attr] !== undefined && leadA.attributes[attr] === leadB.attributes[attr]) {
      score += 1.0;
      reasons.push(`Exact match on attribute ${attr}`);
    }
  }
  
  // Fuzzy matches
  for (const attr of config.fuzzyMatchAttributes) {
    maxPossibleScore += 1.0;
    const valA = leadA.attributes[attr];
    const valB = leadB.attributes[attr];
    if (typeof valA === 'string' && typeof valB === 'string') {
      const sim = stringSimilarity(valA.toLowerCase(), valB.toLowerCase());
      score += sim;
      if (sim > 0.8) {
        reasons.push(`Fuzzy match on attribute ${attr} (sim: ${sim.toFixed(2)})`);
      }
    } else if (valA !== undefined && valA === valB) {
      score += 1.0;
      reasons.push(`Exact match on fuzzy attribute ${attr}`);
    }
  }
  
  // Email and Name base comparison
  maxPossibleScore += 2.0; // 1 for name, 1 for email domain
  
  const nameSim = stringSimilarity(leadA.name.toLowerCase(), leadB.name.toLowerCase());
  score += nameSim;
  if (nameSim > 0.8) reasons.push(`Similar name (sim: ${nameSim.toFixed(2)})`);
  
  const domainA = getEmailDomain(leadA.email);
  const domainB = getEmailDomain(leadB.email);
  if (domainA !== "" && domainA === domainB && domainA !== "gmail.com" && domainA !== "yahoo.com" && domainA !== "hotmail.com") {
    score += config.emailDomainMatchWeight;
    reasons.push(`Matching corporate email domain (${domainA})`);
  }
  maxPossibleScore += config.emailDomainMatchWeight - 1.0; // Adjust max score for domain weight
  
  const confidence = maxPossibleScore === 0 ? 0 : score / maxPossibleScore;
  
  return {
    leadIdA: leadA.id,
    leadIdB: leadB.id,
    confidence,
    matchReasons: reasons
  };
}

export function resolveIdentities(state: EngineState, config: IdentityResolutionConfig): readonly IdentityMatch[] {
  const matches: IdentityMatch[] = [];
  const leads = Object.values(state.leads);
  
  for (let i = 0; i < leads.length; i++) {
    for (let j = i + 1; j < leads.length; j++) {
      const a = leads[i]!;
      const b = leads[j]!;
      const match = evaluateLeadSimilarity(a, b, config);
      if (match.confidence >= config.similarityThreshold) {
        matches.push(match);
      }
    }
  }
  
  return matches.sort((a, b) => b.confidence - a.confidence);
}

// --- Graph-based Lead Associations (Accounts / Buying Centers) ---

export interface LeadAssociation {
  readonly sourceLeadId: string;
  readonly targetLeadId: string;
  readonly relationType: "colleague" | "manager" | "subordinate" | "referrer" | "similar_profile";
  readonly strength: number; // 0.0 to 1.0
}

export interface BuyingCenter {
  readonly id: string;
  readonly name: string;
  readonly memberLeadIds: readonly string[];
  readonly totalScore: number;
}

export function buildLeadAssociations(state: EngineState): readonly LeadAssociation[] {
  const associations: LeadAssociation[] = [];
  const leads = Object.values(state.leads);
  
  // 1. Colleague Associations (Same Corporate Domain)
  const domainGroups: Record<string, Lead[]> = {};
  for (const lead of leads) {
    const domain = getEmailDomain(lead.email);
    if (domain && domain !== "gmail.com" && domain !== "yahoo.com") {
      if (!domainGroups[domain]) domainGroups[domain] = [];
      domainGroups[domain]!.push(lead);
    }
  }
  
  for (const [_, domainLeads] of Object.entries(domainGroups)) {
    for (let i = 0; i < domainLeads.length; i++) {
      for (let j = i + 1; j < domainLeads.length; j++) {
        associations.push({
          sourceLeadId: domainLeads[i]!.id,
          targetLeadId: domainLeads[j]!.id,
          relationType: "colleague",
          strength: 0.8
        });
        // Bi-directional
        associations.push({
          sourceLeadId: domainLeads[j]!.id,
          targetLeadId: domainLeads[i]!.id,
          relationType: "colleague",
          strength: 0.8
        });
      }
    }
  }
  
  // 2. Referrer Associations (Based on specific attributes)
  for (const lead of leads) {
    const referrerId = lead.attributes["referred_by_lead_id"];
    if (typeof referrerId === "string" && state.leads[referrerId]) {
      associations.push({
        sourceLeadId: referrerId,
        targetLeadId: lead.id,
        relationType: "referrer",
        strength: 0.95
      });
    }
  }
  
  return associations;
}

export function identifyBuyingCenters(state: EngineState, associations: readonly LeadAssociation[]): readonly BuyingCenter[] {
  const uf = new Map<string, string>();
  
  function find(i: string): string {
    if (uf.get(i) === i) return i;
    const parent = uf.get(i);
    if (!parent) return i;
    const root = find(parent);
    uf.set(i, root);
    return root;
  }
  
  function union(i: string, j: string) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      if (rootI.localeCompare(rootJ) < 0) {
        uf.set(rootJ, rootI);
      } else {
        uf.set(rootI, rootJ);
      }
    }
  }
  
  for (const lead of Object.values(state.leads)) {
    uf.set(lead.id, lead.id);
  }
  
  for (const assoc of associations) {
    if (assoc.relationType === "colleague") {
      union(assoc.sourceLeadId, assoc.targetLeadId);
    }
  }
  
  const centersMap = new Map<string, string[]>();
  for (const lead of Object.values(state.leads)) {
    const root = find(lead.id);
    if (!centersMap.has(root)) centersMap.set(root, []);
    centersMap.get(root)!.push(lead.id);
  }
  
  const centers: BuyingCenter[] = [];
  let centerIdx = 1;
  for (const [root, members] of centersMap.entries()) {
    if (members.length > 1) { // Only groups of 2+ are interesting buying centers
      let totalScore = 0;
      let primaryDomain = "";
      for (const id of members) {
        totalScore += (state.scores[id] ?? 0);
        if (primaryDomain === "") {
          const d = getEmailDomain(state.leads[id]!.email);
          if (d && d !== "gmail.com") primaryDomain = d;
        }
      }
      
      centers.push({
        id: `bc_${primaryDomain || root}_${centerIdx++}`,
        name: primaryDomain ? `${primaryDomain} Buying Center` : `Buying Center ${centerIdx}`,
        memberLeadIds: members.sort(),
        totalScore
      });
    }
  }
  
  return centers.sort((a, b) => b.totalScore - a.totalScore);
}

// --- Lead Enrichment Models ---

export interface EnrichmentRule {
  readonly id: string;
  readonly triggerAttributes: readonly string[];
  readonly enrichedAttributes: Readonly<Record<string, string | number | boolean>>;
  readonly condition: (lead: Lead) => boolean;
}

export function enrichLead(lead: Lead, rules: readonly EnrichmentRule[], timestamp: Timestamp): Outcome<Lead> {
  const mergedAttributes = { ...lead.attributes };
  let modified = false;
  
  for (const rule of rules) {
    if (rule.condition(lead)) {
      for (const [k, v] of Object.entries(rule.enrichedAttributes)) {
        if (mergedAttributes[k] === undefined) { // Don't overwrite existing
          mergedAttributes[k] = v;
          modified = true;
        }
      }
    }
  }
  
  if (!modified) return success(lead);
  
  return success({
    ...lead,
    attributes: mergedAttributes,
    updatedAt: timestamp
  });
}
