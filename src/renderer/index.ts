import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { webUtils, ipcRenderer } from 'electron';
import { HamsterStateMachine } from './hamster/HamsterStateMachine';
import { AnimationManifest, HamsterState } from '../shared/hamster-states';
import { Bubble } from './bubble/Bubble';
import { setupDraggingAnimation } from './hamster/windowDragging';
import { setupDragAndDrop } from './hamster/dragAndDrop';
import { setupThreatNotifications } from './bubble/threatNotifications';

const assetsDir = path.join(__dirname, '..', '..', 'assets', 'processed');
const manifestPath = path.join(assetsDir, 'manifest.json');
const manifest: AnimationManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const stateMachine = new HamsterStateMachine(manifest);
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

setupDraggingAnimation(rootEl, stateMachine);

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
