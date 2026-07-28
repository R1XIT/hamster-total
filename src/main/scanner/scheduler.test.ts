import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScanScheduler } from './scheduler';
import { ThreatDetection } from './defenderParser';

describe('ScanScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a scan automatically after the configured interval', async () => {
    const scan = vi.fn().mockResolvedValue({ defenderAvailable: true, detections: [] });
    const onFindings = vi.fn();
    const scheduler = new ScanScheduler(
      () => ({ scanFolders: ['C:\\Users\\vlad\\Downloads'], scanIntervalHours: 1 }),
      scan,
      onFindings
    );

    scheduler.start();
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(scan).toHaveBeenCalledWith('C:\\Users\\vlad\\Downloads');
    scheduler.stop();
  });

  it('aggregates detections across multiple folders and reports them', async () => {
    const detectionA: ThreatDetection = { threatName: 'A', resourcePath: 'C:\\Downloads\\a.exe', detectionTime: '' };
    const detectionB: ThreatDetection = { threatName: 'B', resourcePath: 'C:\\Desktop\\b.exe', detectionTime: '' };
    const scan = vi
      .fn()
      .mockResolvedValueOnce({ defenderAvailable: true, detections: [detectionA] })
      .mockResolvedValueOnce({ defenderAvailable: true, detections: [detectionB] });
    const onFindings = vi.fn();
    const scheduler = new ScanScheduler(
      () => ({ scanFolders: ['C:\\Downloads', 'C:\\Desktop'], scanIntervalHours: 1 }),
      scan,
      onFindings
    );

    await scheduler.runScan();

    expect(onFindings).toHaveBeenCalledWith([detectionA, detectionB]);
  });

  it('does not call onFindings when nothing is found', async () => {
    const scan = vi.fn().mockResolvedValue({ defenderAvailable: true, detections: [] });
    const onFindings = vi.fn();
    const scheduler = new ScanScheduler(() => ({ scanFolders: ['C:\\Downloads'], scanIntervalHours: 1 }), scan, onFindings);

    await scheduler.runScan();

    expect(onFindings).not.toHaveBeenCalled();
  });

  it('fires onScanStart/onScanEnd around every scan, even with no folders configured', async () => {
    const scan = vi.fn().mockResolvedValue({ defenderAvailable: true, detections: [] });
    const onScanStart = vi.fn();
    const onScanEnd = vi.fn();
    const scheduler = new ScanScheduler(
      () => ({ scanFolders: [], scanIntervalHours: 1 }),
      scan,
      vi.fn(),
      { onScanStart, onScanEnd }
    );

    await scheduler.runScan();

    // The animation must play as feedback even when there is nothing to scan.
    expect(onScanStart).toHaveBeenCalledTimes(1);
    expect(onScanEnd).toHaveBeenCalledTimes(1);
    expect(scan).not.toHaveBeenCalled();
  });

  it('still fires onScanEnd if a folder scan throws', async () => {
    const scan = vi.fn().mockRejectedValue(new Error('defender exploded'));
    const onScanStart = vi.fn();
    const onScanEnd = vi.fn();
    const scheduler = new ScanScheduler(
      () => ({ scanFolders: ['C:\\Downloads'], scanIntervalHours: 1 }),
      scan,
      vi.fn(),
      { onScanStart, onScanEnd }
    );

    await expect(scheduler.runScan()).rejects.toThrow('defender exploded');

    expect(onScanStart).toHaveBeenCalledTimes(1);
    expect(onScanEnd).toHaveBeenCalledTimes(1);
  });
});
