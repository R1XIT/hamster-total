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

const assetsDir = path.join(__dirname, '..', '..', 'assets', 'processed');
const trayIconPath = path.join(__dirname, '..', '..', 'assets', 'icon.ico');

let hamsterWindow: BrowserWindow | null = null;

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
      onScanStart: () => hamsterWindow?.webContents.send('scan-started'),
      onScanEnd: () => hamsterWindow?.webContents.send('scan-finished'),
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
