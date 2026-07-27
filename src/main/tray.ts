import { Tray, Menu, app, nativeImage } from 'electron';
import * as path from 'path';
import { ScanScheduler } from './scanner/scheduler';
import { ConfigStore } from './config';
import { setAutostart, isAutostartEnabled } from './autostart';

export interface TrayOptions {
  iconPath: string;
  scheduler: ScanScheduler;
  configStore: ConfigStore;
  openSettings: () => void;
}

export function createTray(options: TrayOptions): Tray {
  const icon = nativeImage.createFromPath(options.iconPath);
  const tray = new Tray(icon);

  function buildMenu(): Menu {
    return Menu.buildFromTemplate([
      { label: 'Сканировать сейчас', click: () => options.scheduler.runScan() },
      { label: 'Настройки', click: () => options.openSettings() },
      {
        label: 'Запускать при старте Windows',
        type: 'checkbox',
        checked: isAutostartEnabled(app),
        click: (menuItem) => {
          setAutostart(app, menuItem.checked);
          options.configStore.update({ launchAtStartup: menuItem.checked });
        },
      },
      { type: 'separator' },
      { label: 'Выход', click: () => app.quit() },
    ]);
  }

  tray.setToolTip('Hamser Total');
  tray.setContextMenu(buildMenu());
  return tray;
}
