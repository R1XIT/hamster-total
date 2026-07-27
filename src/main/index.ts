import { app, BrowserWindow } from 'electron';
import { APP_NAME } from '../shared/version';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 400,
    height: 500,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadURL(`data:text/html,<h1>${APP_NAME}</h1>`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
