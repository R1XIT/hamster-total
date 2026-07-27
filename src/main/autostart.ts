export interface LoginItemController {
  setLoginItemSettings(settings: { openAtLogin: boolean }): void;
  getLoginItemSettings(): { openAtLogin: boolean };
}

export function setAutostart(app: LoginItemController, enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled });
}

export function isAutostartEnabled(app: LoginItemController): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
