import { ipcRenderer } from 'electron';
import { AppConfig } from '../main/config';

const folderListEl = document.getElementById('folder-list') as HTMLDivElement;
const addFolderBtn = document.getElementById('add-folder') as HTMLButtonElement;
const scanIntervalEl = document.getElementById('scan-interval') as HTMLInputElement;
const sleepTimeoutEl = document.getElementById('sleep-timeout') as HTMLInputElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const vtApiKeyEl = document.getElementById('vt-api-key') as HTMLInputElement;

function renderFolders(folders: string[]): void {
  folderListEl.innerHTML = '';
  for (const folder of folders) {
    const row = document.createElement('div');
    const label = document.createElement('span');
    label.textContent = folder;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Удалить';
    removeBtn.addEventListener('click', () => {
      ipcRenderer.send('settings:remove-folder', folder);
    });
    row.appendChild(label);
    row.appendChild(removeBtn);
    folderListEl.appendChild(row);
  }
}

function renderConfig(config: AppConfig): void {
  renderFolders(config.scanFolders);
  scanIntervalEl.value = String(config.scanIntervalHours);
  sleepTimeoutEl.value = String(config.sleepTimeoutMinutes);
  vtApiKeyEl.value = config.virusTotalApiKey ?? '';
}

ipcRenderer.on('settings:config', (_event, config: AppConfig) => {
  renderConfig(config);
});

addFolderBtn.addEventListener('click', () => {
  ipcRenderer.send('settings:pick-folder');
});

saveBtn.addEventListener('click', () => {
  ipcRenderer.send('settings:update', {
    scanIntervalHours: Number(scanIntervalEl.value),
    sleepTimeoutMinutes: Number(sleepTimeoutEl.value),
    virusTotalApiKey: vtApiKeyEl.value,
  });
});

ipcRenderer.send('settings:request-config');
