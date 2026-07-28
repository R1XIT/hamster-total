import { describe, it, expect, vi } from 'vitest';
import { runVtCheck, VtCheckDeps } from './vtFlow';
import { VtError, VtVerdict } from './scanner/virustotal';

const VERDICT: VtVerdict = { clean: 1, detected: 0, total: 1, engines: [{ name: 'A', passed: true }] };

function baseDeps(overrides: Partial<VtCheckDeps> = {}): VtCheckDeps {
  return {
    sha256File: async () => 'sha',
    hashLookup: async () => null,
    fileSize: () => 10,
    readFile: () => new Uint8Array([1]),
    fileName: () => 'f.bin',
    uploadBytes: async () => 'id',
    pollAnalysis: async () => VERDICT,
    ...overrides,
  };
}

describe('runVtCheck', () => {
  it('returns no-key when the api key is blank', async () => {
    const res = await runVtCheck('C:/f.bin', '   ', baseDeps());
    expect(res).toEqual({ ok: false, code: 'no-key' });
  });

  it('returns the hash-hit verdict without uploading', async () => {
    const uploadBytes = vi.fn();
    const res = await runVtCheck('C:/f.bin', 'key', baseDeps({ hashLookup: async () => VERDICT, uploadBytes }));
    expect(res).toEqual({ ok: true, verdict: VERDICT });
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('uploads and polls on a hash miss', async () => {
    const res = await runVtCheck('C:/f.bin', 'key', baseDeps({ hashLookup: async () => null }));
    expect(res).toEqual({ ok: true, verdict: VERDICT });
  });

  it('returns too-large before uploading an oversized file', async () => {
    const uploadBytes = vi.fn();
    const res = await runVtCheck(
      'C:/big.bin',
      'key',
      baseDeps({ hashLookup: async () => null, fileSize: () => 999 * 1024 * 1024, uploadBytes })
    );
    expect(res).toEqual({ ok: false, code: 'too-large' });
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('maps a VtError to its code', async () => {
    const res = await runVtCheck(
      'C:/f.bin',
      'key',
      baseDeps({ hashLookup: async () => { throw new VtError('quota'); } })
    );
    expect(res).toEqual({ ok: false, code: 'quota' });
  });

  it('emits progress stages in order on a miss', async () => {
    const stages: string[] = [];
    await runVtCheck('C:/f.bin', 'key', baseDeps(), (s) => stages.push(s));
    expect(stages).toEqual(['hashing', 'uploading', 'analyzing']);
  });
});
