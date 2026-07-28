import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./fileops/trash', () => ({ trashFile: vi.fn() }));

import { IgnoredThreatsTracker, filterNewFindings, notifyThreats, registerThreatResponseHandlers } from './threatFlow';
import { trashFile } from './fileops/trash';
import { ThreatDetection } from './scanner/defenderParser';

describe('IgnoredThreatsTracker + filterNewFindings', () => {
  it('keeps all findings when nothing has been ignored', () => {
    const detections: ThreatDetection[] = [
      { threatName: 'A', resourcePath: 'C:\\a.exe', detectionTime: '' },
    ];
    const tracker = new IgnoredThreatsTracker();

    expect(filterNewFindings(detections, tracker)).toEqual(detections);
  });

  it('excludes a finding once its path has been ignored', () => {
    const detections: ThreatDetection[] = [
      { threatName: 'A', resourcePath: 'C:\\a.exe', detectionTime: '' },
      { threatName: 'B', resourcePath: 'C:\\b.exe', detectionTime: '' },
    ];
    const tracker = new IgnoredThreatsTracker();
    tracker.ignore('C:\\a.exe');

    const result = filterNewFindings(detections, tracker);

    expect(result).toEqual([detections[1]]);
  });
});

describe('notifyThreats', () => {
  it('sends a threat-found event for each fresh detection', () => {
    const send = vi.fn();
    const win = { webContents: { send } } as unknown as import('electron').BrowserWindow;
    const detection: ThreatDetection = {
      threatName: 'Virus:DOS/EICAR_Test_File',
      resourcePath: 'C:\\Users\\vlad\\Downloads\\eicar_test.com',
      detectionTime: '',
    };

    notifyThreats(win, [detection], new IgnoredThreatsTracker());

    expect(send).toHaveBeenCalledWith('threat-found', detection);
  });

  it('does not notify a detection whose path was ignored', () => {
    const send = vi.fn();
    const win = { webContents: { send } } as unknown as import('electron').BrowserWindow;
    const tracker = new IgnoredThreatsTracker();
    tracker.ignore('C:\\a.com');

    notifyThreats(win, [{ threatName: 'X', resourcePath: 'C:\\a.com', detectionTime: '' }], tracker);

    expect(send).not.toHaveBeenCalled();
  });
});

describe('registerThreatResponseHandlers', () => {
  const send = vi.fn();
  const win = { webContents: { send } } as unknown as import('electron').BrowserWindow;
  let handler: (event: unknown, payload: { resourcePath: string; delete: boolean }) => Promise<void> | void;
  const ipcMain = {
    on: (_channel: string, cb: typeof handler) => {
      handler = cb;
    },
  } as unknown as import('electron').IpcMain;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the (already clean) path and reports success back to the renderer', async () => {
    vi.mocked(trashFile).mockResolvedValueOnce({ success: true });
    registerThreatResponseHandlers(win, ipcMain, new IgnoredThreatsTracker());

    await handler({}, { resourcePath: 'C:\\Users\\vlad\\Downloads\\eicar_test.com', delete: true });

    expect(trashFile).toHaveBeenCalledWith('C:\\Users\\vlad\\Downloads\\eicar_test.com');
    expect(send).toHaveBeenCalledWith('threat-response-result', {
      resourcePath: 'C:\\Users\\vlad\\Downloads\\eicar_test.com',
      success: true,
    });
  });

  it('ignores the threat (no delete) when the user keeps it', async () => {
    const tracker = new IgnoredThreatsTracker();
    registerThreatResponseHandlers(win, ipcMain, tracker);

    await handler({}, { resourcePath: 'C:\\keep.com', delete: false });

    expect(trashFile).not.toHaveBeenCalled();
    expect(tracker.isIgnored('C:\\keep.com')).toBe(true);
  });
});
