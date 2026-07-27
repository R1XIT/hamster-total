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
    async (targetPath) => {
      hamsterWindow?.webContents.send('scan-started');
      const result = await scanPath(targetPath);
      hamsterWindow?.webContents.send('scan-finished');
      return result;
    },
    (detections) => {
      if (hamsterWindow) notifyThreats(hamsterWindow, detections, ignoredThreats);
    }
  );
}

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
  createHamsterWindow();
  if (hamsterWindow) registerThreatResponseHandlers(hamsterWindow, ipcMain, ignoredThreats);
  scheduler = createScheduler();
  scheduler.start();
  createTray({
    iconPath: path.join(assetsDir, 'homo_defoult.webp'),
    scheduler: scheduler!,
    configStore,
    openSettings: () => openSettingsWindow(configStore),
  });
});

app.on('window-all-closed', () => {});
