import { createHash } from 'crypto';
import { createReadStream } from 'fs';

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

export type VtErrorCode = 'quota' | 'auth' | 'network' | 'timeout' | 'too-large' | 'unknown';

export class VtError extends Error {
  constructor(public code: VtErrorCode) {
    super(code);
    this.name = 'VtError';
  }
}

export type FetchImpl = typeof fetch;

function throwForStatus(status: number): void {
  if (status === 401) throw new VtError('auth');
  if (status === 429) throw new VtError('quota');
  throw new VtError('unknown');
}

export async function hashLookup(
  apiKey: string,
  sha256: string,
  fetchImpl: FetchImpl = fetch
): Promise<VtVerdict | null> {
  let res: Response;
  try {
    res = await fetchImpl(`${VT_BASE}/files/${sha256}`, { headers: { 'x-apikey': apiKey } });
  } catch {
    throw new VtError('network');
  }
  if (res.status === 404) return null;
  if (!res.ok) throwForStatus(res.status);
  const body = (await res.json()) as {
    data?: { attributes?: { last_analysis_results?: Record<string, { category?: string; engine_name?: string }> } };
  };
  return normalizeVerdict(body?.data?.attributes?.last_analysis_results ?? {});
}

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
