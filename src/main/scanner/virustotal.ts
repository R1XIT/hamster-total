export const VT_BASE = 'https://www.virustotal.com/api/v3';
export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

export interface EngineResult {
  name: string;
  passed: boolean;
}

export interface VtVerdict {
  clean: number;
  detected: number;
  total: number;
  engines: EngineResult[];
}

const PASS_CATEGORIES = new Set(['harmless', 'undetected']);
const FAIL_CATEGORIES = new Set(['malicious', 'suspicious']);

export function normalizeVerdict(
  results: Record<string, { category?: string; engine_name?: string }>
): VtVerdict {
  const engines: EngineResult[] = [];
  for (const [key, value] of Object.entries(results ?? {})) {
    const category = value?.category ?? '';
    const name = value?.engine_name ?? key;
    if (PASS_CATEGORIES.has(category)) engines.push({ name, passed: true });
    else if (FAIL_CATEGORIES.has(category)) engines.push({ name, passed: false });
  }
  const clean = engines.filter((e) => e.passed).length;
  return { clean, detected: engines.length - clean, total: engines.length, engines };
}
