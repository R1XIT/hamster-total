import { BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { ConfigStore } from './config';

let settingsWindow: BrowserWindow | null = null;
let handlersRegistered = false;

function registerHandlersOnce(configStore: ConfigStore): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.on('settings:request-config', (event) => {
    event.sender.send('settings:config', configStore.load());
  });

  ipcMain.on('settings:update', (event, partial) => {
    const next = configStore.update(partial);
    event.sender.send('settings:config', next);
  });

  ipcMain.on('settings:remove-folder', (event, folder: string) => {
    const next = configStore.removeScanFolder(folder);
    event.sender.send('settings:config', next);
  });

  ipcMain.on('settings:pick-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return;
    const next = configStore.addScanFolder(result.filePaths[0]);
    event.sender.send('settings:config', next);
  });
}

export function openSettingsWindow(configStore: ConfigStore): void {
  registerHandlersOnce(configStore);

  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 420,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  settingsWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'settings', 'index.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}
