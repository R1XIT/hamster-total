import { ThreatDetection } from './defenderParser';

export interface SchedulerConfig {
  scanFolders: string[];
  scanIntervalHours: number;
}

export type ScanFn = (targetPath: string) => Promise<{ defenderAvailable: boolean; detections: ThreatDetection[] }>;
export type FindingsCallback = (detections: ThreatDetection[]) => void;

/**
 * Lifecycle hooks fired once per runScan() — used to drive the hamster's
 * "scanning" animation. They bracket the whole scan (not each folder) so the
 * animation always plays as feedback, even when scanFolders is empty.
 */
export interface ScanLifecycleHooks {
  onScanStart?: () => void;
  onScanEnd?: () => void;
}

export class ScanScheduler {
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private getConfig: () => SchedulerConfig,
    private scan: ScanFn,
    private onFindings: FindingsCallback,
    private hooks: ScanLifecycleHooks = {}
  ) {}

  start(): void {
    this.reschedule();
  }

  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  reschedule(): void {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    const hours = this.getConfig().scanIntervalHours;
    this.intervalTimer = setInterval(() => this.runScan(), hours * 60 * 60 * 1000);
  }

  async runScan(): Promise<void> {
    this.hooks.onScanStart?.();
    try {
      const { scanFolders } = this.getConfig();
      const allDetections: ThreatDetection[] = [];
      for (const folder of scanFolders) {
        const result = await this.scan(folder);
        allDetections.push(...result.detections);
      }
      if (allDetections.length > 0) {
        this.onFindings(allDetections);
      }
    } finally {
      this.hooks.onScanEnd?.();
    }
  }
}
