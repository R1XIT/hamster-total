import * as path from 'path';

const SYSTEM_DIRECTORY_PREFIXES = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
];

export function isSystemPath(targetPath: string): boolean {
  const normalized = path.normalize(targetPath).toLowerCase();
  return SYSTEM_DIRECTORY_PREFIXES.some((prefix) =>
    normalized.startsWith(path.normalize(prefix).toLowerCase())
  );
}
