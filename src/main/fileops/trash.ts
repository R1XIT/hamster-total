import { shell } from 'electron';
import { isSystemPath } from '../../shared/system-paths';

export interface TrashResult {
  success: boolean;
  reason?: 'system-path' | 'not-found' | 'trash-error';
}

export async function trashFile(filePath: string): Promise<TrashResult> {
  if (isSystemPath(filePath)) {
    return { success: false, reason: 'system-path' };
  }
  try {
    await shell.trashItem(filePath);
    return { success: true };
  } catch {
    return { success: false, reason: 'trash-error' };
  }
}
