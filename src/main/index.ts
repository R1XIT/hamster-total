import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { APP_NAME } from '../shared/version';
import { trashFile } from './fileops/trash';

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

app.whenReady().then(createHamsterWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
