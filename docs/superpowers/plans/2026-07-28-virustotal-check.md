# VirusTotal File-Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second drop gesture to the hamster — dropping a file on a magnifying-glass target checks it via VirusTotal and shows a verdict bubble, while dropping on the hamster body still deletes as before.

**Architecture:** A pure VT API client (`virustotal.ts`) + a pure orchestrator (`vtFlow.ts`, `runVtCheck`) live in the main process and are unit-tested with an injected `fetch`/deps. The main process (`index.ts`) wires an IPC `vt-check` handler to them and reuses `trashFile` for the "Удалить" action. In the renderer, a lupa overlay element (shown only during a file drag) routes drops to a new `vt-check` IPC, and a `VtVerdictBubble` renders the result. The API key is a new `AppConfig` field entered in Settings.

**Tech Stack:** TypeScript, Electron 33 (Node 20 → global `fetch`/`FormData`/`Blob`), Vitest (+ jsdom for DOM), Node `crypto`/`fs`.

## Global Constraints

- Target platform: Windows (desktop pet, frameless transparent window).
- VirusTotal API v3, base URL `https://www.virustotal.com/api/v3`, auth header `x-apikey: <key>`.
- Free-tier upload limit: **32 MiB** (`MAX_UPLOAD_BYTES = 32 * 1024 * 1024`).
- All new pure logic (client, orchestrator, bubble, drop-zone) must be unit-tested in the existing Vitest style; wiring-only files (`index.ts`, `settings/*`) have no existing tests and are verified by build + manual smoke.
- UI copy is Russian, matching existing bubbles (e.g. "Удалить" / "Оставить").
- Do NOT change existing behavior: dropping on the hamster body still deletes; the background Defender folder scan is untouched.
- Follow existing patterns: inject dependencies for testability (as `scanPath`/`ConfigStore` do); keep files single-responsibility.

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/main/scanner/virustotal.ts` | Create | VT types, `VtError`, `normalizeVerdict`, `sha256File`, `hashLookup`, `uploadBytes`, `pollAnalysis`, `MAX_UPLOAD_BYTES` |
| `src/main/scanner/virustotal.test.ts` | Create | Unit tests for the above (mock `fetch`) |
| `src/main/vtFlow.ts` | Create | `runVtCheck(filePath, apiKey, deps, onProgress)` orchestrator + `VtCheckResult` |
| `src/main/vtFlow.test.ts` | Create | Unit tests for `runVtCheck` (injected deps) |
| `src/main/config.ts` | Modify | Add `virusTotalApiKey: string` to `AppConfig` + `DEFAULT_CONFIG` |
| `src/main/settingsValidation.ts` | Modify | Sanitize `virusTotalApiKey` (must be a string; trim) |
| `src/main/settingsValidation.test.ts` | Modify | Tests for the key sanitization |
| `src/settings/index.html` | Modify | API-key input + "get free key" link |
| `src/settings/index.ts` | Modify | Populate + save `virusTotalApiKey` |
| `src/renderer/bubble/VtVerdictBubble.ts` | Create | Verdict bubble UI (count, engine list, Удалить/Оставить) |
| `src/renderer/bubble/VtVerdictBubble.test.ts` | Create | jsdom tests for the bubble |
| `src/renderer/hamster/vtDropZone.ts` | Create | Lupa overlay visibility during drag + drop→scan routing |
| `src/renderer/hamster/vtDropZone.test.ts` | Create | jsdom tests for the drop zone |
| `src/renderer/index.html` | Modify | Add lupa overlay element + minimal CSS |
| `src/renderer/index.ts` | Modify | Wire lupa→`vt-check`, progress/result handling, verdict bubble, delete |
| `src/main/index.ts` | Modify | Register `vt-check` + `vt-delete` IPC handlers; `open-settings` handler |

---

## Task 1: Config — add `virusTotalApiKey`

**Files:**
- Modify: `src/main/config.ts:4-16`
- Modify: `src/main/settingsValidation.ts`
- Test: `src/main/settingsValidation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AppConfig.virusTotalApiKey: string` (default `''`); `sanitizeConfigUpdate` now also trims/validates `virusTotalApiKey`.

- [ ] **Step 1: Add the field to config**

In `src/main/config.ts`, add to the `AppConfig` interface (after `launchAtStartup`):

```typescript
export interface AppConfig {
  scanFolders: string[];
  scanIntervalHours: number;
  sleepTimeoutMinutes: number;
  launchAtStartup: boolean;
  virusTotalApiKey: string;
}
```

And to `DEFAULT_CONFIG`:

```typescript
export const DEFAULT_CONFIG: AppConfig = {
  scanFolders: [],
  scanIntervalHours: 6,
  sleepTimeoutMinutes: 5,
  launchAtStartup: true,
  virusTotalApiKey: '',
};
```

- [ ] **Step 2: Write the failing test for key sanitization**

Append to `src/main/settingsValidation.test.ts` (create the file if the described `describe` block is the first — check existing content first and add inside the existing top-level structure):

```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeConfigUpdate } from './settingsValidation';

describe('sanitizeConfigUpdate - virusTotalApiKey', () => {
  it('trims a string key', () => {
    const out = sanitizeConfigUpdate({ virusTotalApiKey: '  abc123  ' });
    expect(out.virusTotalApiKey).toBe('abc123');
  });

  it('drops a non-string key', () => {
    const out = sanitizeConfigUpdate({ virusTotalApiKey: 42 as unknown as string });
    expect('virusTotalApiKey' in out).toBe(false);
  });

  it('leaves other fields untouched', () => {
    const out = sanitizeConfigUpdate({ scanIntervalHours: 6, virusTotalApiKey: 'k' });
    expect(out.scanIntervalHours).toBe(6);
    expect(out.virusTotalApiKey).toBe('k');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/main/settingsValidation.test.ts`
Expected: FAIL — the trim test fails (key passes through untrimmed) and the drop test fails (number passes through).

- [ ] **Step 4: Implement the sanitization**

In `src/main/settingsValidation.ts`, add inside `sanitizeConfigUpdate` before `return sanitized;`:

```typescript
  if ('virusTotalApiKey' in sanitized) {
    const key = sanitized.virusTotalApiKey;
    if (typeof key === 'string') {
      sanitized.virusTotalApiKey = key.trim();
    } else {
      delete sanitized.virusTotalApiKey;
    }
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/main/settingsValidation.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/config.ts src/main/settingsValidation.ts src/main/settingsValidation.test.ts
git commit -m "feat: add virusTotalApiKey to config with sanitization"
```

---

## Task 2: Settings UI — API key field

**Files:**
- Modify: `src/settings/index.html:22-28`
- Modify: `src/settings/index.ts`

**Interfaces:**
- Consumes: `AppConfig.virusTotalApiKey` (Task 1); existing `settings:update` / `settings:config` IPC.
- Produces: nothing new (persists the key via existing `settings:update`).

- [ ] **Step 1: Add the input and link to the HTML**

In `src/settings/index.html`, insert before the `<button id="save">` line:

```html
  <label>
    Ключ VirusTotal API
    <input id="vt-api-key" type="text" placeholder="Вставьте ваш ключ" />
  </label>
  <a href="https://www.virustotal.com/gui/join-us" target="_blank" rel="noreferrer">Получить бесплатный ключ</a>
```

- [ ] **Step 2: Read the element in the settings script**

In `src/settings/index.ts`, add after the `saveBtn` lookup (line 8):

```typescript
const vtApiKeyEl = document.getElementById('vt-api-key') as HTMLInputElement;
```

- [ ] **Step 3: Populate it from config**

In `renderConfig`, add after the `sleepTimeoutEl.value` line:

```typescript
  vtApiKeyEl.value = config.virusTotalApiKey ?? '';
```

- [ ] **Step 4: Include it in the save payload**

In the `saveBtn` click handler, extend the `settings:update` payload:

```typescript
saveBtn.addEventListener('click', () => {
  ipcRenderer.send('settings:update', {
    scanIntervalHours: Number(scanIntervalEl.value),
    sleepTimeoutMinutes: Number(sleepTimeoutEl.value),
    virusTotalApiKey: vtApiKeyEl.value,
  });
});
```

- [ ] **Step 5: Build and manually verify**

Run: `npm run build`
Expected: compiles with no errors.
Manual: `npm start`, open Settings from the tray, enter a key, Save, reopen Settings — the key persists and shows in the field.

- [ ] **Step 6: Commit**

```bash
git add src/settings/index.html src/settings/index.ts
git commit -m "feat: add VirusTotal API key field to settings"
```

---

## Task 3: VT verdict normalization

**Files:**
- Create: `src/main/scanner/virustotal.ts`
- Test: `src/main/scanner/virustotal.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface EngineResult { name: string; passed: boolean }`
  - `interface VtVerdict { clean: number; detected: number; total: number; engines: EngineResult[] }`
  - `function normalizeVerdict(results: Record<string, { category?: string; engine_name?: string }>): VtVerdict`
  - `const MAX_UPLOAD_BYTES = 32 * 1024 * 1024`

- [ ] **Step 1: Write the failing test**

Create `src/main/scanner/virustotal.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/main/scanner/virustotal.test.ts`
Expected: FAIL — module `./virustotal` does not exist.

- [ ] **Step 3: Implement the normalizer + constants**

Create `src/main/scanner/virustotal.ts`:

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/main/scanner/virustotal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/scanner/virustotal.ts src/main/scanner/virustotal.test.ts
git commit -m "feat: add VirusTotal verdict normalization"
```

---

## Task 4: VT hash lookup + file hashing + error type

**Files:**
- Modify: `src/main/scanner/virustotal.ts`
- Test: `src/main/scanner/virustotal.test.ts`

**Interfaces:**
- Consumes: `normalizeVerdict`, `VtVerdict`, `VT_BASE` (Task 3).
- Produces:
  - `type VtErrorCode = 'quota' | 'auth' | 'network' | 'timeout' | 'too-large' | 'unknown'`
  - `class VtError extends Error { code: VtErrorCode }`
  - `type FetchImpl = typeof fetch`
  - `function hashLookup(apiKey: string, sha256: string, fetchImpl?: FetchImpl): Promise<VtVerdict | null>` (null = 404 unknown)
  - `function sha256File(filePath: string): Promise<string>`

- [ ] **Step 1: Write the failing tests**

Append to `src/main/scanner/virustotal.test.ts`:

```typescript
import { hashLookup, VtError } from './virustotal';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/main/scanner/virustotal.test.ts`
Expected: FAIL — `hashLookup` / `VtError` not exported.

- [ ] **Step 3: Implement `VtError`, `hashLookup`, `sha256File`**

Add to `src/main/scanner/virustotal.ts`:

```typescript
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/main/scanner/virustotal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/scanner/virustotal.ts src/main/scanner/virustotal.test.ts
git commit -m "feat: add VirusTotal hash lookup, file hashing, error type"
```

---

## Task 5: VT upload + analysis polling

**Files:**
- Modify: `src/main/scanner/virustotal.ts`
- Test: `src/main/scanner/virustotal.test.ts`

**Interfaces:**
- Consumes: `VtError`, `FetchImpl`, `normalizeVerdict`, `VtVerdict`, `VT_BASE`, `throwForStatus` (Tasks 3–4).
- Produces:
  - `function uploadBytes(apiKey: string, fileName: string, bytes: Uint8Array, fetchImpl?: FetchImpl): Promise<string>` (returns analysis id)
  - `function pollAnalysis(apiKey: string, analysisId: string, fetchImpl?: FetchImpl, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<VtVerdict>`

- [ ] **Step 1: Write the failing tests**

Append to `src/main/scanner/virustotal.test.ts`:

```typescript
import { uploadBytes, pollAnalysis } from './virustotal';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/main/scanner/virustotal.test.ts`
Expected: FAIL — `uploadBytes` / `pollAnalysis` not exported.

- [ ] **Step 3: Implement upload and polling**

Add to `src/main/scanner/virustotal.ts`:

```typescript
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function uploadBytes(
  apiKey: string,
  fileName: string,
  bytes: Uint8Array,
  fetchImpl: FetchImpl = fetch
): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([bytes]), fileName);
  let res: Response;
  try {
    res = await fetchImpl(`${VT_BASE}/files`, { method: 'POST', headers: { 'x-apikey': apiKey }, body: form });
  } catch {
    throw new VtError('network');
  }
  if (!res.ok) throwForStatus(res.status);
  const body = (await res.json()) as { data?: { id?: string } };
  const id = body?.data?.id;
  if (!id) throw new VtError('unknown');
  return String(id);
}

export async function pollAnalysis(
  apiKey: string,
  analysisId: string,
  fetchImpl: FetchImpl = fetch,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<VtVerdict> {
  const intervalMs = opts.intervalMs ?? 3000;
  const timeoutMs = opts.timeoutMs ?? 90000;
  const start = Date.now();
  for (;;) {
    let res: Response;
    try {
      res = await fetchImpl(`${VT_BASE}/analyses/${analysisId}`, { headers: { 'x-apikey': apiKey } });
    } catch {
      throw new VtError('network');
    }
    if (!res.ok) throwForStatus(res.status);
    const body = (await res.json()) as {
      data?: { attributes?: { status?: string; results?: Record<string, { category?: string; engine_name?: string }> } };
    };
    const attrs = body?.data?.attributes;
    if (attrs?.status === 'completed') {
      return normalizeVerdict(attrs.results ?? {});
    }
    if (Date.now() - start > timeoutMs) throw new VtError('timeout');
    await sleep(intervalMs);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/main/scanner/virustotal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/scanner/virustotal.ts src/main/scanner/virustotal.test.ts
git commit -m "feat: add VirusTotal upload and analysis polling"
```

---

## Task 6: `runVtCheck` orchestrator

**Files:**
- Create: `src/main/vtFlow.ts`
- Test: `src/main/vtFlow.test.ts`

**Interfaces:**
- Consumes: `VtVerdict`, `VtError`, `VtErrorCode`, `MAX_UPLOAD_BYTES` (Tasks 3–5).
- Produces:
  - `type VtCheckResult = { ok: true; verdict: VtVerdict } | { ok: false; code: 'no-key' | VtErrorCode }`
  - `interface VtCheckDeps { sha256File; hashLookup; fileSize; readFile; fileName; uploadBytes; pollAnalysis }` (exact signatures below)
  - `type VtProgress = 'hashing' | 'uploading' | 'analyzing'`
  - `function runVtCheck(filePath: string, apiKey: string, deps: VtCheckDeps, onProgress?: (stage: VtProgress) => void): Promise<VtCheckResult>`

- [ ] **Step 1: Write the failing tests**

Create `src/main/vtFlow.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/main/vtFlow.test.ts`
Expected: FAIL — `./vtFlow` does not exist.

- [ ] **Step 3: Implement `runVtCheck`**

Create `src/main/vtFlow.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/main/vtFlow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/vtFlow.ts src/main/vtFlow.test.ts
git commit -m "feat: add runVtCheck orchestrator"
```

---

## Task 7: `VtVerdictBubble` component

**Files:**
- Create: `src/renderer/bubble/VtVerdictBubble.ts`
- Test: `src/renderer/bubble/VtVerdictBubble.test.ts`

**Interfaces:**
- Consumes: nothing (view types are local to keep the renderer independent of main-process imports, matching `threatNotifications.ts` which redeclares its payload).
- Produces:
  - `interface VtVerdictView { clean: number; total: number; detected: number; engines: { name: string; passed: boolean }[] }`
  - `interface VtVerdictBubbleCallbacks { onDelete: () => void; onKeep: () => void }`
  - `class VtVerdictBubble { constructor(container: HTMLElement); show(v: VtVerdictView, cb: VtVerdictBubbleCallbacks): void; hide(): void; isVisible(): boolean }`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/bubble/VtVerdictBubble.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { VtVerdictBubble, VtVerdictView } from './VtVerdictBubble';

const cleanView: VtVerdictView = {
  clean: 58,
  total: 70,
  detected: 0,
  engines: [{ name: 'EngineA', passed: true }],
};

const dirtyView: VtVerdictView = {
  clean: 60,
  total: 70,
  detected: 10,
  engines: [
    { name: 'EngineA', passed: true },
    { name: 'EngineC', passed: false },
  ],
};

describe('VtVerdictBubble', () => {
  it('is hidden by default', () => {
    const bubble = new VtVerdictBubble(document.createElement('div'));
    expect(bubble.isVisible()).toBe(false);
  });

  it('renders "Прошёл X / Y" and shows the bubble', () => {
    const container = document.createElement('div');
    const bubble = new VtVerdictBubble(container);
    bubble.show(cleanView, { onDelete: vi.fn(), onKeep: vi.fn() });
    expect(bubble.isVisible()).toBe(true);
    expect(container.querySelector('.vt-count')?.textContent).toBe('Прошёл 58 / 70');
  });

  it('marks the count as danger when there are detections', () => {
    const container = document.createElement('div');
    new VtVerdictBubble(container).show(dirtyView, { onDelete: vi.fn(), onKeep: vi.fn() });
    expect(container.querySelector('.vt-count')?.classList.contains('danger')).toBe(true);
  });

  it('toggles the engine list, rendering ✓/✗ per engine', () => {
    const container = document.createElement('div');
    new VtVerdictBubble(container).show(dirtyView, { onDelete: vi.fn(), onKeep: vi.fn() });
    const list = container.querySelector('.vt-engines') as HTMLElement;
    expect(list.classList.contains('hidden')).toBe(true);
    const items = list.querySelectorAll('li');
    expect(items[0].textContent).toBe('✓ EngineA');
    expect(items[1].textContent).toBe('✗ EngineC');

    const toggle = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Список антивирусов'
    ) as HTMLButtonElement;
    toggle.click();
    expect(list.classList.contains('hidden')).toBe(false);
  });

  it('invokes onDelete / onKeep and hides', () => {
    const container = document.createElement('div');
    const bubble = new VtVerdictBubble(container);
    const onDelete = vi.fn();
    const onKeep = vi.fn();
    bubble.show(cleanView, { onDelete, onKeep });

    const del = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Удалить') as HTMLButtonElement;
    del.click();
    expect(onDelete).toHaveBeenCalledOnce();
    expect(bubble.isVisible()).toBe(false);

    bubble.show(cleanView, { onDelete, onKeep });
    const keep = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Оставить') as HTMLButtonElement;
    keep.click();
    expect(onKeep).toHaveBeenCalledOnce();
    expect(bubble.isVisible()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/renderer/bubble/VtVerdictBubble.test.ts`
Expected: FAIL — `./VtVerdictBubble` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/renderer/bubble/VtVerdictBubble.ts`:

```typescript
export interface VtVerdictView {
  clean: number;
  total: number;
  detected: number;
  engines: { name: string; passed: boolean }[];
}

export interface VtVerdictBubbleCallbacks {
  onDelete: () => void;
  onKeep: () => void;
}

export class VtVerdictBubble {
  private element: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'vt-bubble hidden';
    container.appendChild(this.element);
  }

  show(view: VtVerdictView, cb: VtVerdictBubbleCallbacks): void {
    this.element.innerHTML = '';

    const count = document.createElement('p');
    count.className = view.detected > 0 ? 'vt-count danger' : 'vt-count';
    count.textContent = `Прошёл ${view.clean} / ${view.total}`;
    this.element.appendChild(count);

    const list = document.createElement('ul');
    list.className = 'vt-engines hidden';
    for (const engine of view.engines) {
      const li = document.createElement('li');
      li.textContent = `${engine.passed ? '✓' : '✗'} ${engine.name}`;
      list.appendChild(li);
    }

    const toggle = document.createElement('button');
    toggle.textContent = 'Список антивирусов';
    toggle.addEventListener('click', () => list.classList.toggle('hidden'));
    this.element.appendChild(toggle);
    this.element.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'vt-actions';
    const del = document.createElement('button');
    del.textContent = 'Удалить';
    del.addEventListener('click', () => {
      cb.onDelete();
      this.hide();
    });
    const keep = document.createElement('button');
    keep.textContent = 'Оставить';
    keep.addEventListener('click', () => {
      cb.onKeep();
      this.hide();
    });
    actions.appendChild(del);
    actions.appendChild(keep);
    this.element.appendChild(actions);

    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  isVisible(): boolean {
    return !this.element.classList.contains('hidden');
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/renderer/bubble/VtVerdictBubble.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/bubble/VtVerdictBubble.ts src/renderer/bubble/VtVerdictBubble.test.ts
git commit -m "feat: add VtVerdictBubble component"
```

---

## Task 8: Lupa drop zone (renderer)

**Files:**
- Create: `src/renderer/hamster/vtDropZone.ts`
- Test: `src/renderer/hamster/vtDropZone.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface VtDropZoneOptions { lupaEl: HTMLElement; dragSurface: EventTarget; getPathForFile: (file: File) => string; onScan: (filePath: string) => void }`
  - `function setupLupaScanTarget(opts: VtDropZoneOptions): void` — reveals `lupaEl` (removes `hidden`) while a file is dragged over `dragSurface`, hides it otherwise, and routes a drop on `lupaEl` to `onScan(path)`.

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/hamster/vtDropZone.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { setupLupaScanTarget } from './vtDropZone';

function fileDragEvent(type: string, files: File[] = []): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } });
  return event;
}

describe('setupLupaScanTarget', () => {
  it('reveals the lupa when a file is dragged over the surface', () => {
    const lupaEl = document.createElement('div');
    lupaEl.className = 'hidden';
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    setupLupaScanTarget({ lupaEl, dragSurface: surface, getPathForFile: vi.fn(), onScan: vi.fn() });

    surface.dispatchEvent(fileDragEvent('dragenter'));
    expect(lupaEl.classList.contains('hidden')).toBe(false);
  });

  it('hides the lupa again after the drag leaves', () => {
    const lupaEl = document.createElement('div');
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    setupLupaScanTarget({ lupaEl, dragSurface: surface, getPathForFile: vi.fn(), onScan: vi.fn() });

    surface.dispatchEvent(fileDragEvent('dragenter'));
    surface.dispatchEvent(fileDragEvent('dragleave'));
    expect(lupaEl.classList.contains('hidden')).toBe(true);
  });

  it('routes a drop on the lupa to onScan with the resolved path', () => {
    const lupaEl = document.createElement('div');
    document.body.appendChild(lupaEl);
    const surface = document.createElement('div');
    const onScan = vi.fn();
    const fakeFile = {} as File;
    setupLupaScanTarget({
      lupaEl,
      dragSurface: surface,
      getPathForFile: () => 'C:\\Users\\vlad\\Downloads\\f.exe',
      onScan,
    });

    lupaEl.dispatchEvent(fileDragEvent('drop', [fakeFile]));
    expect(onScan).toHaveBeenCalledWith('C:\\Users\\vlad\\Downloads\\f.exe');
    expect(lupaEl.classList.contains('hidden')).toBe(true);
  });

  it('ignores a drop on the lupa with no files', () => {
    const lupaEl = document.createElement('div');
    document.body.appendChild(lupaEl);
    const onScan = vi.fn();
    setupLupaScanTarget({ lupaEl, dragSurface: document.createElement('div'), getPathForFile: vi.fn(), onScan });

    lupaEl.dispatchEvent(fileDragEvent('drop', []));
    expect(onScan).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/renderer/hamster/vtDropZone.test.ts`
Expected: FAIL — `./vtDropZone` does not exist.

- [ ] **Step 3: Implement the drop zone**

Create `src/renderer/hamster/vtDropZone.ts`:

```typescript
export interface VtDropZoneOptions {
  lupaEl: HTMLElement;
  dragSurface: EventTarget;
  getPathForFile: (file: File) => string;
  onScan: (filePath: string) => void;
}

function isFileDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return types ? Array.from(types).includes('Files') : false;
}

export function setupLupaScanTarget(opts: VtDropZoneOptions): void {
  const { lupaEl, dragSurface, getPathForFile, onScan } = opts;
  let depth = 0;

  const show = (): void => lupaEl.classList.remove('hidden');
  const hide = (): void => {
    depth = 0;
    lupaEl.classList.add('hidden');
  };

  dragSurface.addEventListener('dragenter', (event) => {
    if (!isFileDrag(event as DragEvent)) return;
    depth += 1;
    show();
  });
  dragSurface.addEventListener('dragover', (event) => (event as DragEvent).preventDefault());
  dragSurface.addEventListener('dragleave', () => {
    depth -= 1;
    if (depth <= 0) hide();
  });
  dragSurface.addEventListener('drop', () => hide());
  window.addEventListener('dragend', () => hide());

  lupaEl.addEventListener('dragover', (event) => event.preventDefault());
  lupaEl.addEventListener('drop', (event) => {
    const drag = event as DragEvent;
    drag.preventDefault();
    drag.stopPropagation();
    hide();
    const files = drag.dataTransfer?.files;
    if (!files || files.length === 0) return;
    onScan(getPathForFile(files[0]));
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/renderer/hamster/vtDropZone.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hamster/vtDropZone.ts src/renderer/hamster/vtDropZone.test.ts
git commit -m "feat: add lupa scan drop zone"
```

---

## Task 9: Main-process IPC wiring (`vt-check`, `vt-delete`, `open-settings`)

**Files:**
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: `runVtCheck`, `VtCheckDeps` (Task 6); `sha256File`, `hashLookup`, `uploadBytes`, `pollAnalysis` (Tasks 4–5); `trashFile` (existing); `configStore`, `hamsterWindow`, `openSettingsWindow` (existing).
- Produces (renderer-facing IPC contract, consumed in Task 10):
  - Renderer → main: `vt-check` `(filePath: string)`, `vt-delete` `(filePath: string)`, `open-settings` `()`
  - Main → renderer: `vt-progress` `(stage: 'hashing'|'uploading'|'analyzing')`, `vt-result` `(VtCheckResult)`, `vt-delete-result` `({ success: boolean })`
  - The "scanning" animation is driven by reusing the existing `scan-started` / `scan-finished` events around a check.

- [ ] **Step 1: Add imports**

In `src/main/index.ts`, add near the existing imports:

```typescript
import * as fsExtra from 'fs';
import { basename } from 'path';
import { runVtCheck } from './vtFlow';
import { sha256File, hashLookup, uploadBytes, pollAnalysis } from './scanner/virustotal';
```

(If `fs` is already imported as `fs`, reuse it instead of `fsExtra` — `index.ts` already imports `* as fs`. Use the existing `fs`.)

- [ ] **Step 2: Register the `vt-check` handler**

In `src/main/index.ts`, add after the existing `file-dropped` handler (around line 87):

```typescript
ipcMain.on('vt-check', async (event, filePath: string) => {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    event.sender.send('vt-result', { ok: false, code: 'unknown' });
    return;
  }
  const apiKey = configStore.load().virusTotalApiKey ?? '';
  hamsterWindow?.webContents.send('scan-started');
  const result = await runVtCheck(
    filePath,
    apiKey,
    {
      sha256File,
      hashLookup: (key, sha) => hashLookup(key, sha),
      fileSize: (p) => fs.statSync(p).size,
      readFile: (p) => fs.readFileSync(p),
      fileName: (p) => basename(p),
      uploadBytes: (key, name, bytes) => uploadBytes(key, name, bytes),
      pollAnalysis: (key, id) => pollAnalysis(key, id),
    },
    (stage) => event.sender.send('vt-progress', stage)
  );
  hamsterWindow?.webContents.send('scan-finished');
  event.sender.send('vt-result', result);
});
```

- [ ] **Step 3: Register the `vt-delete` and `open-settings` handlers**

Add below the `vt-check` handler:

```typescript
ipcMain.on('vt-delete', async (event, filePath: string) => {
  const result = await trashFile(filePath);
  event.sender.send('vt-delete-result', { success: result.success });
});

ipcMain.on('open-settings', () => {
  openSettingsWindow(configStore, {
    onConfigChange: (config) => hamsterWindow?.webContents.send('config-updated', config),
  });
});
```

Note: match the `onConfigChange` hook name/shape to how `openSettingsWindow` is already called elsewhere in this file (see the tray wiring near line 102). If the existing call passes a different hook shape, copy that exact shape here.

- [ ] **Step 4: Build and manually verify**

Run: `npm run build`
Expected: compiles with no type errors.
Manual: `npm start`. With a valid key set (Task 2), drag a known-clean file onto the lupa (after Task 10 wires it) — for now, verify the app still builds and the existing drop-to-delete on the body still works.

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: wire vt-check, vt-delete, open-settings IPC handlers"
```

---

## Task 10: Renderer wiring — lupa element, verdict bubble, progress & errors

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/index.ts`

**Interfaces:**
- Consumes: `setupLupaScanTarget` (Task 8), `VtVerdictBubble` (Task 7), `Bubble` (existing), `stateMachine` (existing); the IPC contract from Task 9.
- Produces: the complete user-facing flow.

- [ ] **Step 1: Add the lupa element + CSS to the HTML**

In `src/renderer/index.html`, add a lupa element inside `#hamster-root` (or as a sibling above the hamster image) and minimal styles. Add to the `<style>` block:

```css
#lupa {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  z-index: 10;
}
#lupa.hidden { display: none; }
.vt-bubble.hidden, .vt-engines.hidden { display: none; }
.vt-count.danger { color: #c0392b; font-weight: bold; }
.vt-engines { max-height: 160px; overflow-y: auto; padding-left: 18px; margin: 6px 0; }
```

And in the body, add the lupa element (emoji as the icon; replace with a sprite later if desired):

```html
<div id="lupa" class="hidden">🔍</div>
```

- [ ] **Step 2: Import the new modules in the renderer**

In `src/renderer/index.ts`, add:

```typescript
import { setupLupaScanTarget } from './hamster/vtDropZone';
import { VtVerdictBubble, VtVerdictView } from './bubble/VtVerdictBubble';
```

- [ ] **Step 3: Wire the lupa to `vt-check`**

In `src/renderer/index.ts`, after the existing `setupDragAndDrop(...)` call, add:

```typescript
const lupaEl = document.getElementById('lupa') as HTMLDivElement;
const vtBubble = new VtVerdictBubble(document.body);

setupLupaScanTarget({
  lupaEl,
  dragSurface: window,
  getPathForFile: (file) => webUtils.getPathForFile(file),
  onScan: (filePath) => ipcRenderer.send('vt-check', filePath),
});
```

- [ ] **Step 4: Show progress while checking**

Add:

```typescript
const VT_PROGRESS_TEXT: Record<string, string> = {
  hashing: 'Проверяю на VirusTotal…',
  uploading: 'Загружаю файл на VirusTotal…',
  analyzing: 'Жду результат анализа…',
};

ipcRenderer.on('vt-progress', (_event, stage: string) => {
  bubble.show(VT_PROGRESS_TEXT[stage] ?? 'Проверяю…');
});
```

- [ ] **Step 5: Handle the verdict / error result**

Add:

```typescript
const VT_ERROR_TEXT: Record<string, string> = {
  'no-key': 'Добавьте ключ VirusTotal в Настройках',
  'too-large': 'Файл слишком большой для загрузки (лимит 32 МБ)',
  quota: 'Лимит VirusTotal исчерпан, попробуйте позже',
  auth: 'Неверный ключ VirusTotal, проверьте Настройки',
  network: 'Не удалось связаться с VirusTotal',
  timeout: 'VirusTotal не ответил вовремя, попробуйте позже',
  unknown: 'Не удалось проверить файл',
};

type VtResult =
  | { ok: true; verdict: VtVerdictView }
  | { ok: false; code: string };

let lastCheckedPath: string | null = null;

setupLupaScanTarget({
  lupaEl,
  dragSurface: window,
  getPathForFile: (file) => webUtils.getPathForFile(file),
  onScan: (filePath) => {
    lastCheckedPath = filePath;
    ipcRenderer.send('vt-check', filePath);
  },
});

ipcRenderer.on('vt-result', (_event, result: VtResult) => {
  bubble.hide();
  if (!result.ok) {
    const message = VT_ERROR_TEXT[result.code] ?? VT_ERROR_TEXT.unknown;
    bubble.show(
      message,
      result.code === 'no-key'
        ? [{ label: 'Открыть Настройки', onClick: () => ipcRenderer.send('open-settings') }]
        : []
    );
    setTimeout(() => bubble.hide(), 5000);
    return;
  }
  vtBubble.show(result.verdict, {
    onDelete: () => {
      if (lastCheckedPath) ipcRenderer.send('vt-delete', lastCheckedPath);
    },
    onKeep: () => {},
  });
});

ipcRenderer.on('vt-delete-result', (_event, res: { success: boolean }) => {
  if (res.success) stateMachine.startEating(() => {});
});
```

Note: consolidate the two `setupLupaScanTarget` calls shown across Step 3 and Step 5 into the single call that sets `lastCheckedPath` — Step 5's version supersedes Step 3's. Remove the Step 3 call when adding Step 5.

- [ ] **Step 6: Build and run the full manual smoke test**

Run: `npm run build`
Expected: compiles cleanly.
Manual (`npm start`, valid API key set):
1. Start dragging any file over the hamster → the 🔍 lupa appears above it.
2. Drop on the hamster body → file goes to Recycle Bin (unchanged behavior).
3. Drop on the lupa → progress bubble, then a verdict bubble "Прошёл X / Y" with **Список антивирусов**, **Удалить**, **Оставить**.
4. Click **Список антивирусов** → per-engine ✓/✗ list expands.
5. Click **Удалить** → file goes to Recycle Bin, hamster eats. Click **Оставить** on a re-check → bubble closes, file untouched.
6. Clear the API key in Settings, drop on lupa → "Добавьте ключ VirusTotal в Настройках" with an **Открыть Настройки** button.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/index.html src/renderer/index.ts
git commit -m "feat: wire lupa scan target, verdict bubble, progress and errors"
```

---

## Self-Review Notes (verification of this plan against the spec)

- **Second drop target (lupa):** Tasks 8 + 10 (lupa overlay shown only during drag, drop → `vt-check`); body-drop-to-delete untouched (Task 9 leaves `file-dropped` as-is). Realization chosen: overlay inside the existing window (no window resize), which the spec explicitly deferred to the plan.
- **Verdict bubble "Прошёл X / Y" + Удалить/Оставить + engine list ✓/✗:** Task 7.
- **Hash-first, auto-upload on miss; 32 MiB guard; error codes:** Tasks 4–6.
- **API key in Settings:** Tasks 1–2; no-key path surfaces a settings deep-link (Tasks 9–10).
- **Reuse `trashFile` for delete; reuse scanning animation:** Task 9.
- **Tests in existing style:** Tasks 1, 3–8 are TDD with unit tests; wiring-only Tasks 2, 9, 10 use build + documented manual smoke (consistent with `index.ts`/`settings/*` having no existing tests).
- **Type consistency:** `VtVerdict`/`EngineResult` (main) vs `VtVerdictView` (renderer) are intentionally separate but structurally identical `{ clean, detected, total, engines:{name,passed}[] }`, so `vt-result.verdict` deserializes straight into `VtVerdictView`. `VtCheckResult` codes ↔ `VT_ERROR_TEXT` keys match (`no-key`, `too-large`, `quota`, `auth`, `network`, `timeout`, `unknown`).
