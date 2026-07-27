import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { HamsterStateMachine } from './hamster/HamsterStateMachine';
import { AnimationManifest, HamsterState } from '../shared/hamster-states';
import { Bubble } from './bubble/Bubble';

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
