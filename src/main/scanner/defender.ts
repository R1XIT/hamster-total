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
    // Get-MpThreatDetection carries only a numeric ThreatID (no name), so build a
    // ThreatID -> ThreatName map from Get-MpThreat and project it onto each
    // detection. Without this the app can only ever report "Unknown".
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      // Force UTF-8 stdout: PowerShell 5.1 otherwise writes the pipe in the OEM
      // console codepage, so a resource path with non-ASCII characters (e.g. a
      // Cyrillic user name) is mangled once Node decodes it as UTF-8 — the folder
      // substring match then fails and real detections are silently dropped.
      '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ' +
        '$n=@{}; Get-MpThreat | ForEach-Object { $n[[string]$_.ThreatID]=$_.ThreatName }; ' +
        'Get-MpThreatDetection | ForEach-Object { [pscustomobject]@{ ' +
        'ThreatName=$n[[string]$_.ThreatID]; Resources=$_.Resources; InitialDetectionTime=$_.InitialDetectionTime } } | ' +
        'ConvertTo-Json',
    ]);
    const all = parseThreatDetections(stdout.trim() || '[]');
    const detections = filterDetectionsByPath(all, targetPath);
    return { defenderAvailable: true, detections };
  } catch {
    return { defenderAvailable: false, detections: [] };
  }
}
