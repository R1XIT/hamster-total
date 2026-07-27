import { describe, it, expect } from 'vitest';
import { parseThreatDetections, filterDetectionsByPath } from './defenderParser';

describe('parseThreatDetections', () => {
  it('parses a JSON array of detections', () => {
    const json = JSON.stringify([
      { ThreatName: 'Trojan:Win32/Test', Resources: 'file:_C:\\Users\\vlad\\Downloads\\bad.exe', InitialDetectionTime: '2026-07-27T10:00:00' },
    ]);

    const result = parseThreatDetections(json);

    expect(result).toEqual([
      { threatName: 'Trojan:Win32/Test', resourcePath: 'file:_C:\\Users\\vlad\\Downloads\\bad.exe', detectionTime: '2026-07-27T10:00:00' },
    ]);
  });

  it('parses PowerShell ConvertTo-Json bare object for a single result', () => {
    const json = JSON.stringify({ ThreatName: 'Solo', Resources: 'file:_C:\\x\\y.exe', InitialDetectionTime: '2026-07-27T10:00:00' });

    const result = parseThreatDetections(json);

    expect(result).toHaveLength(1);
    expect(result[0].threatName).toBe('Solo');
  });

  it('returns an empty array for malformed JSON', () => {
    expect(parseThreatDetections('not json')).toEqual([]);
  });

  it('returns an empty array for an empty array input', () => {
    expect(parseThreatDetections('[]')).toEqual([]);
  });
});

describe('filterDetectionsByPath', () => {
  it('keeps only detections whose resourcePath includes the target path (case-insensitive)', () => {
    const detections = [
      { threatName: 'A', resourcePath: 'file:_C:\\Users\\vlad\\Downloads\\bad.exe', detectionTime: '' },
      { threatName: 'B', resourcePath: 'file:_C:\\Users\\vlad\\Desktop\\ok.exe', detectionTime: '' },
    ];

    const result = filterDetectionsByPath(detections, 'C:\\Users\\vlad\\downloads');

    expect(result).toHaveLength(1);
    expect(result[0].threatName).toBe('A');
  });
});
