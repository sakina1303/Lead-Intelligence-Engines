import type { Attributes, Outcome, Scalar, Timestamp } from "./contracts.js";

export function validId(value: string): boolean {
  return value.trim().length > 0;
}

export function validTimestamp(value: Timestamp): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validSequence(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validEmail(value: string): boolean {
  const at = value.indexOf("@");
  return at > 0 && at < value.length - 1 && value.indexOf(".", at) > at + 1;
}

export function validScalar(value: unknown): value is Scalar {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function validateAttributes(attributes: Attributes): readonly string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (!validId(key)) errors.push("attribute keys must be non-empty");
    if (!validScalar(value)) errors.push(`attribute '${key}' must be a scalar`);
  }
  return errors;
}

export function success<T>(value: T): Outcome<T> {
  return { ok: true, value };
}

export function failure<T = never>(...errors: readonly string[]): Outcome<T> {
  return { ok: false, errors };
}
