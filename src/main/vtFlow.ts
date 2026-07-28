import { MAX_UPLOAD_BYTES, VtError, VtErrorCode, VtVerdict } from './scanner/virustotal';

export type VtProgress = 'hashing' | 'uploading' | 'analyzing';

export type VtCheckResult =
  | { ok: true; verdict: VtVerdict }
  | { ok: false; code: 'no-key' | VtErrorCode };

export interface VtCheckDeps {
  sha256File: (filePath: string) => Promise<string>;
  hashLookup: (apiKey: string, sha256: string) => Promise<VtVerdict | null>;
  fileSize: (filePath: string) => number;
  readFile: (filePath: string) => Uint8Array;
  fileName: (filePath: string) => string;
  uploadBytes: (apiKey: string, fileName: string, bytes: Uint8Array) => Promise<string>;
  pollAnalysis: (apiKey: string, analysisId: string) => Promise<VtVerdict>;
}

export async function runVtCheck(
  filePath: string,
  apiKey: string,
  deps: VtCheckDeps,
  onProgress: (stage: VtProgress) => void = () => {}
): Promise<VtCheckResult> {
  if (!apiKey.trim()) return { ok: false, code: 'no-key' };
  try {
    onProgress('hashing');
    const sha = await deps.sha256File(filePath);
    const hit = await deps.hashLookup(apiKey, sha);
    if (hit) return { ok: true, verdict: hit };
    if (deps.fileSize(filePath) > MAX_UPLOAD_BYTES) return { ok: false, code: 'too-large' };
    onProgress('uploading');
    const id = await deps.uploadBytes(apiKey, deps.fileName(filePath), deps.readFile(filePath));
    onProgress('analyzing');
    const verdict = await deps.pollAnalysis(apiKey, id);
    return { ok: true, verdict };
  } catch (err) {
    if (err instanceof VtError) return { ok: false, code: err.code };
    return { ok: false, code: 'unknown' };
  }
}
