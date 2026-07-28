import { AppConfig } from './config';

/**
 * Fields on AppConfig that are used as timer durations and therefore must be
 * finite, whole, positive numbers. A NaN/0/negative value here would make
 * setInterval/setTimeout fire immediately or in a tight loop (Node clamps
 * near-zero delays to ~1ms), so anything invalid must never reach ConfigStore.
 */
const POSITIVE_INTEGER_FIELDS = ['scanIntervalHours', 'sleepTimeoutMinutes'] as const;

function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 1;
}

/**
 * Validates a partial config update coming from the settings UI (IPC) before
 * it is persisted by ConfigStore.
 *
 * Behavior: any of POSITIVE_INTEGER_FIELDS present in `partial` that is not a
 * finite integer >= 1 (e.g. NaN from an empty input, 0, or a negative number)
 * is dropped from the returned partial entirely. This means the field is left
 * untouched by the resulting ConfigStore.update() call, so the previously
 * stored value is preserved rather than persisting a broken one. Fields not
 * mentioned in `partial` are left alone; fields that pass validation are
 * copied through unchanged.
 */
export function sanitizeConfigUpdate(partial: Partial<AppConfig>): Partial<AppConfig> {
  const sanitized: Partial<AppConfig> = { ...partial };
  for (const field of POSITIVE_INTEGER_FIELDS) {
    if (field in sanitized && !isValidPositiveInteger(sanitized[field])) {
      delete sanitized[field];
    }
  }
  if ('virusTotalApiKey' in sanitized) {
    const key = sanitized.virusTotalApiKey;
    if (typeof key === 'string') {
      sanitized.virusTotalApiKey = key.trim();
    } else {
      delete sanitized.virusTotalApiKey;
    }
  }
  return sanitized;
}
