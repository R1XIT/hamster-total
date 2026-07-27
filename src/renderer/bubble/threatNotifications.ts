import { ipcRenderer } from 'electron';
import { Bubble } from './Bubble';
import { HamsterStateMachine } from '../hamster/HamsterStateMachine';

interface ThreatFoundPayload {
  threatName: string;
  resourcePath: string;
}

interface ThreatResponseResult {
  success: boolean;
  resourcePath: string;
}

export function setupThreatNotifications(bubble: Bubble, stateMachine: HamsterStateMachine): void {
  ipcRenderer.on('threat-found', (_event, detection: ThreatFoundPayload) => {
    const fileName = detection.resourcePath.split('\\').pop() ?? detection.resourcePath;
    bubble.show(
      `Нашёл подозрительный файл: ${fileName} (${detection.resourcePath}). Похоже на ${detection.threatName}. Удалить?`,
      [
        {
          label: 'Удалить',
          onClick: () => {
            ipcRenderer.send('threat-response', { resourcePath: detection.resourcePath, delete: true });
          },
        },
        {
          label: 'Оставить',
          onClick: () => {
            ipcRenderer.send('threat-response', { resourcePath: detection.resourcePath, delete: false });
          },
        },
      ]
    );
  });

  ipcRenderer.on('threat-response-result', (_event, result: ThreatResponseResult) => {
    if (result.success) {
      stateMachine.startEating(() => {});
    }
  });
}
