import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseThreatDetections, filterDetectionsByPath, ThreatDetection } from './defenderParser';

const execFileAsync = promisify(execFile);
const MPCMDRUN_PATH = 'C:\\Program Files\\Windows Defender\\MpCmdRun.exe';

export interface ScanResult {
  defenderAvailable: boolean;
  detections: ThreatDetection[];
}

export async function scanPath(targetPath: string): Promise<ScanResult> {
  try {
    await execFileAsync(MPCMDRUN_PATH, ['-Scan', '-ScanType', '3', '-File', targetPath]);
  } catch {
    return { defenderAvailable: false, detections: [] };
  }

  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-MpThreatDetection | ConvertTo-Json',
    ]);
    const all = parseThreatDetections(stdout.trim() || '[]');
    const detections = filterDetectionsByPath(all, targetPath);
    return { defenderAvailable: true, detections };
  } catch {
    return { defenderAvailable: false, detections: [] };
  }
}
