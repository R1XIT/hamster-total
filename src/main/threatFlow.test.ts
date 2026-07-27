import { describe, it, expect } from 'vitest';
import { IgnoredThreatsTracker, filterNewFindings } from './threatFlow';
import { ThreatDetection } from './scanner/defenderParser';

describe('IgnoredThreatsTracker + filterNewFindings', () => {
  it('keeps all findings when nothing has been ignored', () => {
    const detections: ThreatDetection[] = [
      { threatName: 'A', resourcePath: 'C:\\a.exe', detectionTime: '' },
    ];
    const tracker = new IgnoredThreatsTracker();

    expect(filterNewFindings(detections, tracker)).toEqual(detections);
  });

  it('excludes a finding once its path has been ignored', () => {
    const detections: ThreatDetection[] = [
      { threatName: 'A', resourcePath: 'C:\\a.exe', detectionTime: '' },
      { threatName: 'B', resourcePath: 'C:\\b.exe', detectionTime: '' },
    ];
    const tracker = new IgnoredThreatsTracker();
    tracker.ignore('C:\\a.exe');

    const result = filterNewFindings(detections, tracker);

    expect(result).toEqual([detections[1]]);
  });
});
