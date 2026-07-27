import { ThreatDetection } from './defenderParser';

export interface SchedulerConfig {
  scanFolders: string[];
  scanIntervalHours: number;
}

export type ScanFn = (targetPath: string) => Promise<{ defenderAvailable: boolean; detections: ThreatDetection[] }>;
export type FindingsCallback = (detections: ThreatDetection[]) => void;

export class ScanScheduler {
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private getConfig: () => SchedulerConfig,
    private scan: ScanFn,
    private onFindings: FindingsCallback
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
    const { scanFolders } = this.getConfig();
    const allDetections: ThreatDetection[] = [];
    for (const folder of scanFolders) {
      const result = await this.scan(folder);
      allDetections.push(...result.detections);
    }
    if (allDetections.length > 0) {
      this.onFindings(allDetections);
    }
  }
}
