import { BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { ConfigStore, AppConfig } from './config';
import { sanitizeConfigUpdate } from './settingsValidation';

/**
 * Hooks invoked after a successful `settings:update`, letting the caller
 * (main/index.ts) propagate the change into the already-running app —
 * rescheduling the scan timer and/or pushing the new config to the hamster
 * window — without settingsWindow.ts needing to know about the scheduler or
 * hamster window itself.
 */
export interface SettingsWindowHooks {
  onSettingsUpdated?: (config: AppConfig) => void;
}

let settingsWindow: BrowserWindow | null = null;
let handlersRegistered = false;

function registerHandlersOnce(configStore: ConfigStore, hooks: SettingsWindowHooks): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.on('settings:request-config', (event) => {
    event.sender.send('settings:config', configStore.load());
  });

  ipcMain.on('settings:update', (event, partial) => {
    // Never trust the renderer's raw numbers: an empty/invalid input can
    // arrive as NaN/0/negative and must not be persisted (see
    // settingsValidation.ts for the rationale and rules).
    const sanitized = sanitizeConfigUpdate(partial);
    const next = configStore.update(sanitized);
    event.sender.send('settings:config', next);
    hooks.onSettingsUpdated?.(next);
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

export function openSettingsWindow(configStore: ConfigStore, hooks: SettingsWindowHooks = {}): void {
  registerHandlersOnce(configStore, hooks);

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
