import { describe, it, expect } from 'vitest';
import { sanitizeConfigUpdate } from './settingsValidation';

describe('sanitizeConfigUpdate', () => {
  it('passes through a fully valid partial unchanged', () => {
    const result = sanitizeConfigUpdate({ scanIntervalHours: 6, sleepTimeoutMinutes: 5 });
    expect(result).toEqual({ scanIntervalHours: 6, sleepTimeoutMinutes: 5 });
  });

  it('drops scanIntervalHours when it is NaN (e.g. Number(""))', () => {
    const result = sanitizeConfigUpdate({ scanIntervalHours: Number(''), sleepTimeoutMinutes: 5 });
    expect(result).toEqual({ sleepTimeoutMinutes: 5 });
  });

  it('drops scanIntervalHours when it is zero', () => {
    const result = sanitizeConfigUpdate({ scanIntervalHours: 0 });
    expect(result).toEqual({});
  });

  it('drops scanIntervalHours when it is negative', () => {
    const result = sanitizeConfigUpdate({ scanIntervalHours: -3 });
    expect(result).toEqual({});
  });

  it('drops scanIntervalHours when it is not an integer', () => {
    const result = sanitizeConfigUpdate({ scanIntervalHours: 1.5 });
    expect(result).toEqual({});
  });

  it('drops scanIntervalHours when it is Infinity', () => {
    const result = sanitizeConfigUpdate({ scanIntervalHours: Infinity });
    expect(result).toEqual({});
  });

  it('drops sleepTimeoutMinutes when invalid but keeps a valid scanIntervalHours', () => {
    const result = sanitizeConfigUpdate({ scanIntervalHours: 12, sleepTimeoutMinutes: Number('') });
    expect(result).toEqual({ scanIntervalHours: 12 });
  });

  it('drops sleepTimeoutMinutes when zero', () => {
    const result = sanitizeConfigUpdate({ sleepTimeoutMinutes: 0 });
    expect(result).toEqual({});
  });

  it('drops sleepTimeoutMinutes when negative', () => {
    const result = sanitizeConfigUpdate({ sleepTimeoutMinutes: -1 });
    expect(result).toEqual({});
  });

  it('leaves unrelated fields untouched', () => {
    const result = sanitizeConfigUpdate({ scanFolders: ['C:\\Downloads'], launchAtStartup: false });
    expect(result).toEqual({ scanFolders: ['C:\\Downloads'], launchAtStartup: false });
  });

  it('returns an empty object when given an empty partial', () => {
    expect(sanitizeConfigUpdate({})).toEqual({});
  });

  it('accepts the boundary value of 1 for both fields', () => {
    const result = sanitizeConfigUpdate({ scanIntervalHours: 1, sleepTimeoutMinutes: 1 });
    expect(result).toEqual({ scanIntervalHours: 1, sleepTimeoutMinutes: 1 });
  });
});
