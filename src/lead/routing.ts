import type { Lead, Timestamp } from "../contracts.js";

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
  return sorted.find((territory) => Object.entries(territory.requiredAttributes).every(([key, value]) => lead.attributes[key] === value));
}

export function assignSalesRep(lead: Lead, territory: RoutingTerritory, reps: readonly SalesRep[], timestamp: Timestamp): RoutingResult {
  const eligibleReps = reps.filter((rep) => rep.isActive && (rep.territoryId === territory.id || territory.isGlobal) && rep.currentActiveLeads < rep.maxCapacity);
  if (eligibleReps.length === 0) {
    if (territory.fallbackRepId) {
      const fallback = reps.find((rep) => rep.id === territory.fallbackRepId);
      if (fallback?.isActive) return { leadId: lead.id, repId: fallback.id, territoryId: territory.id, reasons: ["assigned to territory fallback due to capacity"] };
    }
    return { leadId: lead.id, repId: null, territoryId: territory.id, reasons: ["no active reps with capacity in territory"] };
  }
  const hash = lead.id.split("").reduce((value, character) => ((value << 5) - value) + character.charCodeAt(0), 0) + timestamp;
  const sortedEligible = eligibleReps.sort((left, right) => left.id.localeCompare(right.id));
  const selected = sortedEligible[Math.abs(hash) % sortedEligible.length]!;
  return { leadId: lead.id, repId: selected.id, territoryId: territory.id, reasons: ["assigned via deterministic hashing"] };
}
