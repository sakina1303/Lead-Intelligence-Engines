import type { EngineState, Lead } from "../contracts.js";

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
  const matrix: number[][] = [];
  for (let index = 0; index <= b.length; index += 1) matrix[index] = [index];
  for (let index = 0; index <= a.length; index += 1) matrix[0]![index] = index;
  for (let row = 1; row <= b.length; row += 1) {
    for (let column = 1; column <= a.length; column += 1) {
      matrix[row]![column] = b.charAt(row - 1) === a.charAt(column - 1)
        ? matrix[row - 1]![column - 1]!
        : Math.min(matrix[row - 1]![column - 1]! + 1, matrix[row]![column - 1]! + 1, matrix[row - 1]![column]! + 1);
    }
  }
  return matrix[b.length]![a.length]!;
}

export function stringSimilarity(a: string, b: string): number {
  const maximumLength = Math.max(a.length, b.length);
  return maximumLength === 0 ? 1 : 1 - levenshteinDistance(a, b) / maximumLength;
}

export function getEmailDomain(email: string): string {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1]! : "";
}

export function evaluateLeadSimilarity(leadA: Lead, leadB: Lead, config: IdentityResolutionConfig): IdentityMatch {
  let score = 0;
  let maximumScore = 0;
  const reasons: string[] = [];
  for (const attribute of config.exactMatchAttributes) {
    maximumScore += 1;
    if (leadA.attributes[attribute] !== undefined && leadA.attributes[attribute] === leadB.attributes[attribute]) {
      score += 1;
      reasons.push(`Exact match on attribute ${attribute}`);
    }
  }
  for (const attribute of config.fuzzyMatchAttributes) {
    maximumScore += 1;
    const left = leadA.attributes[attribute];
    const right = leadB.attributes[attribute];
    if (typeof left === "string" && typeof right === "string") {
      const similarity = stringSimilarity(left.toLowerCase(), right.toLowerCase());
      score += similarity;
      if (similarity > 0.8) reasons.push(`Fuzzy match on attribute ${attribute} (sim: ${similarity.toFixed(2)})`);
    } else if (left !== undefined && left === right) {
      score += 1;
      reasons.push(`Exact match on fuzzy attribute ${attribute}`);
    }
  }
  maximumScore += 1 + config.emailDomainMatchWeight;
  const nameSimilarity = stringSimilarity(leadA.name.toLowerCase(), leadB.name.toLowerCase());
  score += nameSimilarity;
  if (nameSimilarity > 0.8) reasons.push(`Similar name (sim: ${nameSimilarity.toFixed(2)})`);
  const leftDomain = getEmailDomain(leadA.email);
  const rightDomain = getEmailDomain(leadB.email);
  if (leftDomain && leftDomain === rightDomain && !["gmail.com", "yahoo.com", "hotmail.com"].includes(leftDomain)) {
    score += config.emailDomainMatchWeight;
    reasons.push(`Matching corporate email domain (${leftDomain})`);
  }
  return { leadIdA: leadA.id, leadIdB: leadB.id, confidence: maximumScore === 0 ? 0 : score / maximumScore, matchReasons: reasons };
}

export function resolveIdentities(state: EngineState, config: IdentityResolutionConfig): readonly IdentityMatch[] {
  const matches: IdentityMatch[] = [];
  const leads = Object.values(state.leads);
  for (let left = 0; left < leads.length; left += 1) {
    for (let right = left + 1; right < leads.length; right += 1) {
      const match = evaluateLeadSimilarity(leads[left]!, leads[right]!, config);
      if (match.confidence >= config.similarityThreshold) matches.push(match);
    }
  }
  return matches.sort((left, right) => right.confidence - left.confidence || left.leadIdA.localeCompare(right.leadIdA) || left.leadIdB.localeCompare(right.leadIdB));
}
