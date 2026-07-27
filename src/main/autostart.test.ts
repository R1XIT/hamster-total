import { describe, it, expect, vi } from 'vitest';
import { setAutostart, isAutostartEnabled } from './autostart';

describe('autostart', () => {
  it('setAutostart calls setLoginItemSettings with the requested value', () => {
    const fakeApp = {
      setLoginItemSettings: vi.fn(),
      getLoginItemSettings: vi.fn(),
    };

    setAutostart(fakeApp, true);

    expect(fakeApp.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
  });

  it('isAutostartEnabled reads openAtLogin from getLoginItemSettings', () => {
    const fakeApp = {
      setLoginItemSettings: vi.fn(),
      getLoginItemSettings: vi.fn().mockReturnValue({ openAtLogin: true }),
    };

    expect(isAutostartEnabled(fakeApp)).toBe(true);
  });
});
