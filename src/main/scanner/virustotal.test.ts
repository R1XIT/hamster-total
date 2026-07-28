import { describe, it, expect } from 'vitest';
import { normalizeVerdict, hashLookup, VtError, uploadBytes, pollAnalysis } from './virustotal';

describe('normalizeVerdict', () => {
  it('counts clean vs detected and builds the engine list', () => {
    const results = {
      EngineA: { category: 'undetected', engine_name: 'EngineA' },
      EngineB: { category: 'harmless', engine_name: 'EngineB' },
      EngineC: { category: 'malicious', engine_name: 'EngineC' },
      EngineD: { category: 'suspicious', engine_name: 'EngineD' },
    };
    const v = normalizeVerdict(results);
    expect(v.clean).toBe(2);
    expect(v.detected).toBe(2);
    expect(v.total).toBe(4);
    expect(v.engines).toContainEqual({ name: 'EngineC', passed: false });
    expect(v.engines).toContainEqual({ name: 'EngineA', passed: true });
  });

  it('excludes timeout/unsupported engines from the totals', () => {
    const results = {
      EngineA: { category: 'undetected', engine_name: 'EngineA' },
      EngineX: { category: 'timeout', engine_name: 'EngineX' },
      EngineY: { category: 'type-unsupported', engine_name: 'EngineY' },
    };
    const v = normalizeVerdict(results);
    expect(v.total).toBe(1);
    expect(v.engines).toHaveLength(1);
  });

  it('handles empty/undefined results', () => {
    expect(normalizeVerdict({}).total).toBe(0);
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('hashLookup', () => {
  it('returns a normalized verdict for a known hash (200)', async () => {
    const fetchImpl = async () =>
      jsonResponse(200, {
        data: { attributes: { last_analysis_results: { A: { category: 'malicious', engine_name: 'A' } } } },
      });
    const v = await hashLookup('key', 'abc', fetchImpl as typeof fetch);
    expect(v?.detected).toBe(1);
  });

  it('returns null for an unknown hash (404)', async () => {
    const fetchImpl = async () => jsonResponse(404, {});
    expect(await hashLookup('key', 'abc', fetchImpl as typeof fetch)).toBeNull();
  });

  it('throws VtError("auth") on 401', async () => {
    const fetchImpl = async () => jsonResponse(401, {});
    await expect(hashLookup('key', 'abc', fetchImpl as typeof fetch)).rejects.toMatchObject({ code: 'auth' });
  });

  it('throws VtError("quota") on 429', async () => {
    const fetchImpl = async () => jsonResponse(429, {});
    await expect(hashLookup('key', 'abc', fetchImpl as typeof fetch)).rejects.toMatchObject({ code: 'quota' });
  });

  it('throws VtError("network") when fetch rejects', async () => {
    const fetchImpl = async () => {
      throw new Error('boom');
    };
    await expect(hashLookup('key', 'abc', fetchImpl as typeof fetch)).rejects.toMatchObject({ code: 'network' });
  });
});

describe('uploadBytes', () => {
  it('returns the analysis id from a successful upload', async () => {
    const fetchImpl = async () => jsonResponse(200, { data: { id: 'analysis-123' } });
    const id = await uploadBytes('key', 'f.bin', new Uint8Array([1, 2, 3]), fetchImpl as typeof fetch);
    expect(id).toBe('analysis-123');
  });

  it('throws VtError("quota") on 429', async () => {
    const fetchImpl = async () => jsonResponse(429, {});
    await expect(
      uploadBytes('key', 'f.bin', new Uint8Array([1]), fetchImpl as typeof fetch)
    ).rejects.toMatchObject({ code: 'quota' });
  });
});

describe('pollAnalysis', () => {
  it('polls until completed and returns the verdict', async () => {
    const responses = [
      jsonResponse(200, { data: { attributes: { status: 'in-progress' } } }),
      jsonResponse(200, {
        data: { attributes: { status: 'completed', results: { A: { category: 'harmless', engine_name: 'A' } } } },
      }),
    ];
    let call = 0;
    const fetchImpl = async () => responses[call++];
    const v = await pollAnalysis('key', 'id', fetchImpl as typeof fetch, { intervalMs: 0, timeoutMs: 1000 });
    expect(v.clean).toBe(1);
    expect(call).toBe(2);
  });

  it('throws VtError("timeout") when never completing', async () => {
    const fetchImpl = async () => jsonResponse(200, { data: { attributes: { status: 'queued' } } });
    await expect(
      pollAnalysis('key', 'id', fetchImpl as typeof fetch, { intervalMs: 0, timeoutMs: -1 })
    ).rejects.toMatchObject({ code: 'timeout' });
  });
});
