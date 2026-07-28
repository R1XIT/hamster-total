import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { APP_NAME } from '../shared/version';
import { trashFile } from './fileops/trash';
import { ScanScheduler } from './scanner/scheduler';
import { scanPath } from './scanner/defender';
import { ConfigStore } from './config';
import { IgnoredThreatsTracker, notifyThreats, registerThreatResponseHandlers } from './threatFlow';
import { createTray } from './tray';
import { openSettingsWindow } from './settingsWindow';
import { runVtCheck } from './vtFlow';
import { sha256File, hashLookup, uploadBytes, pollAnalysis } from './scanner/virustotal';

const assetsDir = path.join(__dirname, '..', '..', 'assets', 'processed');
const trayIconPath = path.join(__dirname, '..', '..', 'assets', 'icon.ico');

let hamsterWindow: BrowserWindow | null = null;

// Both the scheduled Defender scan and the VT-check flow drive the same
// renderer "scanning" animation. If they overlap, whichever finishes first
// must not stop the animation while the other is still running — so we
// ref-count active scan animations instead of sending scan-started/
// scan-finished directly.
let activeScanAnims = 0;
function beginScanAnim(): void {
  activeScanAnims++;
  if (activeScanAnims === 1) hamsterWindow?.webContents.send('scan-started');
}
function endScanAnim(): void {
  activeScanAnims = Math.max(0, activeScanAnims - 1);
  if (activeScanAnims === 0) hamsterWindow?.webContents.send('scan-finished');
}

function createHamsterWindow(): void {
  hamsterWindow = new BrowserWindow({
    width: 150,
    height: 190,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    title: APP_NAME,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  hamsterWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));
}

const configStore = new ConfigStore(path.join(app.getPath('userData'), 'config.json'));
const ignoredThreats = new IgnoredThreatsTracker();

let scheduler: ScanScheduler | null = null;

function createScheduler(): ScanScheduler {
  return new ScanScheduler(
    () => configStore.load(),
    (targetPath) => scanPath(targetPath),
    (detections) => {
      if (hamsterWindow) notifyThreats(hamsterWindow, detections, ignoredThreats);
    },
    // Drive the "scanning" animation around the whole scan (not per folder) so
    // the hamster always reacts to a manual "Сканировать сейчас" — even when no
    // folders are configured and the loop body never runs.
    {
      onScanStart: () => beginScanAnim(),
      onScanEnd: () => endScanAnim(),
    }
  );
}

// Synchronous initial-config fetch for the hamster renderer's bootstrap
// (mirrors settings:request-config/settings:config, but the hamster window
// needs the value before it constructs its state machine).
ipcMain.on('get-config', (event) => {
  event.returnValue = configStore.load();
});

// Manual window dragging: the renderer reports pointer-movement deltas (see
// windowDragging.ts) because CSS `-webkit-app-region: drag` would otherwise
// swallow the DOM mouse/drop events the hamster needs. Apply each delta to the
// frameless window's current position.
ipcMain.on('move-window', (_event, delta: { dx: number; dy: number }) => {
  if (!hamsterWindow) return;
  const [x, y] = hamsterWindow.getPosition();
  hamsterWindow.setPosition(Math.round(x + delta.dx), Math.round(y + delta.dy));
});

ipcMain.on('file-dropped', async (event, filePath: string) => {
  if (!fs.existsSync(filePath)) {
    event.sender.send('file-drop-result', { accepted: false, reason: 'not-found' });
    return;
  }
  if (fs.statSync(filePath).isDirectory()) {
    event.sender.send('file-drop-result', { accepted: false, reason: 'is-directory' });
    return;
  }
  const result = await trashFile(filePath);
  if (result.success) {
    event.sender.send('file-drop-result', { accepted: true });
  } else {
    event.sender.send('file-drop-result', { accepted: false, reason: result.reason });
  }
});

ipcMain.on('vt-check', async (event, filePath: string) => {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    event.sender.send('vt-result', { ok: false, code: 'unknown' });
    return;
  }
  const apiKey = configStore.load().virusTotalApiKey ?? '';
  beginScanAnim();
  const result = await runVtCheck(
    filePath,
    apiKey,
    {
      sha256File,
      hashLookup: (key, sha) => hashLookup(key, sha),
      fileSize: (p) => fs.statSync(p).size,
      readFile: (p) => fs.readFileSync(p),
      fileName: (p) => path.basename(p),
      uploadBytes: (key, name, bytes) => uploadBytes(key, name, bytes),
      pollAnalysis: (key, id) => pollAnalysis(key, id),
    },
    (stage) => event.sender.send('vt-progress', stage)
  );
  endScanAnim();
  event.sender.send('vt-result', result);
});

ipcMain.on('vt-delete', async (event, filePath: string) => {
  const result = await trashFile(filePath);
  event.sender.send('vt-delete-result', { success: result.success });
});

ipcMain.on('open-settings', () => {
  openSettingsWindow(configStore, {
    onSettingsUpdated: (config) => {
      scheduler?.reschedule();
      hamsterWindow?.webContents.send('config-updated', config);
    },
  });
});

app.whenReady().then(() => {
  // First launch: seed sensible scan targets (Downloads + Desktop) so scanning
  // actually does something out of the box instead of iterating an empty list.
  configStore.seedDefaultScanFoldersIfFirstRun([app.getPath('downloads'), app.getPath('desktop')]);
  createHamsterWindow();
  if (hamsterWindow) registerThreatResponseHandlers(hamsterWindow, ipcMain, ignoredThreats);
  scheduler = createScheduler();
  scheduler.start();
  createTray({
    iconPath: trayIconPath,
    scheduler: scheduler!,
    configStore,
    openSettings: () =>
      openSettingsWindow(configStore, {
        onSettingsUpdated: (config) => {
          // finding 2: apply a changed scanIntervalHours immediately instead
          // of only on next app launch.
          scheduler?.reschedule();
          // finding 1: push the (possibly changed) sleepTimeoutMinutes to the
          // already-running hamster window so it takes effect live.
          hamsterWindow?.webContents.send('config-updated', config);
        },
      }),
  });
});

app.on('window-all-closed', () => {});
