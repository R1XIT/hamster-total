import { describe, it, expect } from 'vitest';
import { normalizeVerdict } from './virustotal';

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
