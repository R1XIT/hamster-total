import { BrowserWindow, IpcMain } from 'electron';
import { ThreatDetection } from './scanner/defenderParser';
import { trashFile } from './fileops/trash';

export class IgnoredThreatsTracker {
  private ignored = new Set<string>();

  isIgnored(resourcePath: string): boolean {
    return this.ignored.has(resourcePath);
  }

  ignore(resourcePath: string): void {
    this.ignored.add(resourcePath);
  }
}

export function filterNewFindings(detections: ThreatDetection[], tracker: IgnoredThreatsTracker): ThreatDetection[] {
  return detections.filter((d) => !tracker.isIgnored(d.resourcePath));
}

export function notifyThreats(win: BrowserWindow, detections: ThreatDetection[], tracker: IgnoredThreatsTracker): void {
  const fresh = filterNewFindings(detections, tracker);
  for (const detection of fresh) {
    win.webContents.send('threat-found', detection);
  }
}

export function registerThreatResponseHandlers(win: BrowserWindow, ipcMain: IpcMain, tracker: IgnoredThreatsTracker): void {
  ipcMain.on('threat-response', async (_event, payload: { resourcePath: string; delete: boolean }) => {
    if (!payload.delete) {
      tracker.ignore(payload.resourcePath);
      return;
    }
    const result = await trashFile(payload.resourcePath);
    win.webContents.send('threat-response-result', { resourcePath: payload.resourcePath, ...result });
  });
}
