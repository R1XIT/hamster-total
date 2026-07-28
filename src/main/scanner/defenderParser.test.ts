import { describe, it, expect } from 'vitest';
import { parseThreatDetections, filterDetectionsByPath } from './defenderParser';

describe('parseThreatDetections', () => {
  it('parses a real Get-MpThreatDetection EICAR record (name mapped, path cleaned)', () => {
    // Shape captured live: `Resources` is an ARRAY whose entry carries Defender's
    // "file:_" prefix, and the threat name is injected from Get-MpThreat.
    const json = JSON.stringify({
      ThreatName: 'Virus:DOS/EICAR_Test_File',
      Resources: ['file:_C:\\Users\\vlad\\Downloads\\HamsterAVTest\\eicar_test.com'],
      InitialDetectionTime: '/Date(1785245299683)/',
    });

    const result = parseThreatDetections(json);

    expect(result).toHaveLength(1);
    expect(result[0].threatName).toBe('Virus:DOS/EICAR_Test_File');
    // First array element taken and the "file:_" prefix stripped -> a real path
    // that shell.trashItem can actually delete.
    expect(result[0].resourcePath).toBe('C:\\Users\\vlad\\Downloads\\HamsterAVTest\\eicar_test.com');
  });

  it('parses a JSON array of detections and strips the file:_ prefix', () => {
    const json = JSON.stringify([
      { ThreatName: 'Trojan:Win32/Test', Resources: ['file:_C:\\Users\\vlad\\Downloads\\bad.exe'], InitialDetectionTime: '' },
    ]);

    const result = parseThreatDetections(json);

    expect(result[0].resourcePath).toBe('C:\\Users\\vlad\\Downloads\\bad.exe');
    expect(result[0].threatName).toBe('Trojan:Win32/Test');
  });

  it('falls back to Unknown when no threat name maps for the detection', () => {
    const json = JSON.stringify({ Resources: ['file:_C:\\x\\y.exe'], InitialDetectionTime: '' });
    expect(parseThreatDetections(json)[0].threatName).toBe('Unknown');
  });

  it('also accepts a plain-string Resources value', () => {
    const json = JSON.stringify({ ThreatName: 'X', Resources: 'file:_C:\\x\\y.exe', InitialDetectionTime: '' });
    expect(parseThreatDetections(json)[0].resourcePath).toBe('C:\\x\\y.exe');
  });

  it('returns an empty array for malformed JSON', () => {
    expect(parseThreatDetections('not json')).toEqual([]);
  });

  it('returns an empty array for an empty array input', () => {
    expect(parseThreatDetections('[]')).toEqual([]);
  });
});

describe('filterDetectionsByPath', () => {
  it('keeps only detections whose resourcePath includes the target folder (case-insensitive)', () => {
    const detections = [
      { threatName: 'A', resourcePath: 'C:\\Users\\vlad\\Downloads\\bad.exe', detectionTime: '' },
      { threatName: 'B', resourcePath: 'C:\\Users\\vlad\\Desktop\\ok.exe', detectionTime: '' },
    ];

    const result = filterDetectionsByPath(detections, 'C:\\Users\\vlad\\downloads');

    expect(result).toHaveLength(1);
    expect(result[0].threatName).toBe('A');
  });
});
