import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigStore, DEFAULT_CONFIG } from './config';

let tmpDir: string;
let configPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'homo-antivirus-config-'));
  configPath = path.join(tmpDir, 'config.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ConfigStore', () => {
  it('returns defaults when no config file exists yet', () => {
    const store = new ConfigStore(configPath);
    expect(store.load()).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips save and load', () => {
    const store = new ConfigStore(configPath);
    store.save({ ...DEFAULT_CONFIG, scanIntervalHours: 12 });
    expect(store.load().scanIntervalHours).toBe(12);
  });

  it('update() merges a partial config and persists it', () => {
    const store = new ConfigStore(configPath);
    const result = store.update({ sleepTimeoutMinutes: 10 });
    expect(result.sleepTimeoutMinutes).toBe(10);
    expect(store.load().sleepTimeoutMinutes).toBe(10);
  });

  it('addScanFolder appends without duplicating', () => {
    const store = new ConfigStore(configPath);
    store.addScanFolder('C:\\Users\\vlad\\Downloads');
    store.addScanFolder('C:\\Users\\vlad\\Downloads');
    expect(store.load().scanFolders).toEqual(['C:\\Users\\vlad\\Downloads']);
  });

  it('removeScanFolder removes an existing entry', () => {
    const store = new ConfigStore(configPath);
    store.addScanFolder('C:\\Users\\vlad\\Downloads');
    store.addScanFolder('C:\\Users\\vlad\\Desktop');
    store.removeScanFolder('C:\\Users\\vlad\\Downloads');
    expect(store.load().scanFolders).toEqual(['C:\\Users\\vlad\\Desktop']);
  });
});
