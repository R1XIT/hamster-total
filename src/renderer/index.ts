import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { webUtils, ipcRenderer } from 'electron';
import { HamsterStateMachine } from './hamster/HamsterStateMachine';
import { AnimationManifest, HamsterState } from '../shared/hamster-states';
import { AppConfig } from '../main/config';
import { Bubble } from './bubble/Bubble';
import { setupDraggingAnimation } from './hamster/windowDragging';
import { setupDragAndDrop } from './hamster/dragAndDrop';
import { setupThreatNotifications } from './bubble/threatNotifications';
import { setupLupaScanTarget } from './hamster/vtDropZone';
import { VtVerdictBubble, VtVerdictView } from './bubble/VtVerdictBubble';

const assetsDir = path.join(__dirname, '..', '..', 'assets', 'processed');
const manifestPath = path.join(assetsDir, 'manifest.json');
const manifest: AnimationManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Fetch the persisted config synchronously so the state machine is built
// with the user's configured sleep timeout from the very first tick,
// instead of a hardcoded default that silently ignores Settings.
const initialConfig: AppConfig = ipcRenderer.sendSync('get-config');

const stateMachine = new HamsterStateMachine(manifest, initialConfig.sleepTimeoutMinutes * 60 * 1000);
const imgEl = document.getElementById('hamster-img') as HTMLImageElement;

function updateImage(state: HamsterState): void {
  const entry = manifest[state];
  imgEl.src = pathToFileURL(path.join(assetsDir, entry.file)).href;
}

stateMachine.onStateChange(updateImage);
updateImage(stateMachine.getState());
stateMachine.start();

export const bubble = new Bubble(document.body);
export { stateMachine };

setupThreatNotifications(bubble, stateMachine);

const rootEl = document.getElementById('hamster-root') as HTMLDivElement;

setupDraggingAnimation(rootEl, stateMachine, (dx, dy) => {
  ipcRenderer.send('move-window', { dx, dy });
});

setupDragAndDrop(
  rootEl,
  (file) => webUtils.getPathForFile(file),
  (filePath) => {
    ipcRenderer.send('file-dropped', filePath);
  }
);

ipcRenderer.on('file-drop-result', (_event, result: { accepted: boolean; reason?: string }) => {
  if (result.accepted) {
    stateMachine.startEating(() => {});
    return;
  }
  if (result.reason === 'system-path') {
    bubble.show('Это системный файл, я его не трону');
    setTimeout(() => bubble.hide(), 3000);
  } else if (result.reason === 'is-directory') {
    bubble.show('Я ем по одному файлу, папку не потяну');
    setTimeout(() => bubble.hide(), 3000);
  }
});

ipcRenderer.on('scan-started', () => {
  stateMachine.startScanning();
});

ipcRenderer.on('scan-finished', () => {
  stateMachine.stopScanning();
});

// finding 1 / finding 3: pick up a live sleepTimeoutMinutes change from
// Settings without requiring an app restart. Broadcast on every
// settings:update (see main/index.ts); harmless no-op if unchanged.
ipcRenderer.on('config-updated', (_event, config: AppConfig) => {
  stateMachine.setSleepTimeoutMs(config.sleepTimeoutMinutes * 60 * 1000);
});

const lupaEl = document.getElementById('lupa') as HTMLDivElement;
const vtBubble = new VtVerdictBubble(document.body);

const VT_PROGRESS_TEXT: Record<string, string> = {
  hashing: 'Проверяю на VirusTotal…',
  uploading: 'Загружаю файл на VirusTotal…',
  analyzing: 'Жду результат анализа…',
};

const VT_ERROR_TEXT: Record<string, string> = {
  'no-key': 'Добавьте ключ VirusTotal в Настройках',
  'too-large': 'Файл слишком большой для загрузки (лимит 32 МБ)',
  quota: 'Лимит VirusTotal исчерпан, попробуйте позже',
  auth: 'Неверный ключ VirusTotal, проверьте Настройки',
  network: 'Не удалось связаться с VirusTotal',
  timeout: 'VirusTotal не ответил вовремя, попробуйте позже',
  unknown: 'Не удалось проверить файл',
};

type VtResult =
  | { ok: true; verdict: VtVerdictView }
  | { ok: false; code: string };

let lastCheckedPath: string | null = null;

setupLupaScanTarget({
  lupaEl,
  dragSurface: window,
  getPathForFile: (file) => webUtils.getPathForFile(file),
  onScan: (filePath) => {
    lastCheckedPath = filePath;
    ipcRenderer.send('vt-check', filePath);
  },
});

ipcRenderer.on('vt-progress', (_event, stage: string) => {
  bubble.show(VT_PROGRESS_TEXT[stage] ?? 'Проверяю…');
});

ipcRenderer.on('vt-result', (_event, result: VtResult) => {
  bubble.hide();
  if (!result.ok) {
    const message = VT_ERROR_TEXT[result.code] ?? VT_ERROR_TEXT.unknown;
    bubble.show(
      message,
      result.code === 'no-key'
        ? [{ label: 'Открыть Настройки', onClick: () => ipcRenderer.send('open-settings') }]
        : []
    );
    setTimeout(() => bubble.hide(), 5000);
    return;
  }
  vtBubble.show(result.verdict, {
    onDelete: () => {
      if (lastCheckedPath) ipcRenderer.send('vt-delete', lastCheckedPath);
    },
    onKeep: () => {},
  });
});

ipcRenderer.on('vt-delete-result', (_event, res: { success: boolean }) => {
  if (res.success) stateMachine.startEating(() => {});
});
