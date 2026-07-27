import { describe, it, expect } from 'vitest';
import { APP_NAME } from './version';

describe('APP_NAME', () => {
  it('is set to Homo Antivirus', () => {
    expect(APP_NAME).toBe('Homo Antivirus');
  });
});
