import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  shell: {
    trashItem: vi.fn(),
  },
}));

import { trashFile } from './trash';
import * as electron from 'electron';

describe('trashFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses to trash files under system directories without calling shell', async () => {
    const result = await trashFile('C:\\Windows\\System32\\evil.exe');
    expect(result).toEqual({ success: false, reason: 'system-path' });
    expect(electron.shell.trashItem).not.toHaveBeenCalled();
  });

  it('trashes a normal file via shell.trashItem', async () => {
    vi.mocked(electron.shell.trashItem).mockResolvedValueOnce(undefined);
    const result = await trashFile('C:\\Users\\vlad\\Downloads\\malware.exe');
    expect(result).toEqual({ success: true });
    expect(electron.shell.trashItem).toHaveBeenCalledWith('C:\\Users\\vlad\\Downloads\\malware.exe');
  });

  it('reports trash-error if shell.trashItem throws', async () => {
    vi.mocked(electron.shell.trashItem).mockRejectedValueOnce(new Error('boom'));
    const result = await trashFile('C:\\Users\\vlad\\Downloads\\locked.exe');
    expect(result).toEqual({ success: false, reason: 'trash-error' });
  });
});
