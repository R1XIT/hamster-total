import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  scanFolders: string[];
  scanIntervalHours: number;
  sleepTimeoutMinutes: number;
  launchAtStartup: boolean;
  virusTotalApiKey: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  scanFolders: [],
  scanIntervalHours: 6,
  sleepTimeoutMinutes: 5,
  launchAtStartup: true,
  virusTotalApiKey: '',
};

export class ConfigStore {
  constructor(private filePath: string) {}

  load(): AppConfig {
    if (!fs.existsSync(this.filePath)) {
      return { ...DEFAULT_CONFIG };
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  save(config: AppConfig): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  update(partial: Partial<AppConfig>): AppConfig {
    const next = { ...this.load(), ...partial };
    this.save(next);
    return next;
  }

  addScanFolder(folderPath: string): AppConfig {
    const current = this.load();
    if (current.scanFolders.includes(folderPath)) return current;
    return this.update({ scanFolders: [...current.scanFolders, folderPath] });
  }

  removeScanFolder(folderPath: string): AppConfig {
    const current = this.load();
    return this.update({ scanFolders: current.scanFolders.filter((f) => f !== folderPath) });
  }

  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  /**
   * First-run seeding: when no config file exists yet, persist the given
   * candidate folders (keeping only those that actually exist on disk) as the
   * initial scanFolders. No-op once a config file is present, so it never
   * overwrites a user who has deliberately cleared their folder list.
   */
  seedDefaultScanFoldersIfFirstRun(candidateFolders: string[]): AppConfig {
    if (this.exists()) return this.load();
    const existing = candidateFolders.filter((p) => fs.existsSync(p));
    return this.update({ scanFolders: existing });
  }
}
