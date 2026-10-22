const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;

export class EnvConfigError extends Error {}

export function parsePort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;
  const parsed = Number.parseInt(value, 10);
  if (!isIntInRange(parsed, 1, MAX_PORT)) {
    throw new EnvConfigError(`PORT must be an integer between 1 and ${MAX_PORT}, got "${value}".`);
  }
  return parsed;
}

export function parseIntEnv(
  name: string,
  value: string | undefined,
  min: 0 | 1,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!isIntInRange(parsed, min, Number.POSITIVE_INFINITY)) {
    throw new EnvConfigError(`${name} must be an integer >= ${min}, got "${value}".`);
  }
  if (parsed > max) {
    throw new EnvConfigError(`${name} must be <= ${max}, got "${value}".`);
  }
  return parsed;
}

function isIntInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
