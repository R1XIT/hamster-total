import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { APP_NAME } from '../shared/version';

let hamsterWindow: BrowserWindow | null = null;

function createHamsterWindow(): void {
  hamsterWindow = new BrowserWindow({
    width: 400,
    height: 500,
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

app.whenReady().then(createHamsterWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
