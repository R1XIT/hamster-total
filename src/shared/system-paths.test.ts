import { describe, it, expect } from 'vitest';
import { isSystemPath } from './system-paths';

describe('isSystemPath', () => {
  it('flags files under C:\\Windows', () => {
    expect(isSystemPath('C:\\Windows\\System32\\notepad.exe')).toBe(true);
  });

  it('flags files under C:\\Program Files', () => {
    expect(isSystemPath('C:\\Program Files\\SomeApp\\app.exe')).toBe(true);
  });

  it('does not flag files under the user profile', () => {
    expect(isSystemPath('C:\\Users\\vlad\\Downloads\\invoice.pdf')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSystemPath('c:\\windows\\system32\\evil.exe')).toBe(true);
  });
});
