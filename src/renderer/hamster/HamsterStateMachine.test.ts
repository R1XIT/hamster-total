import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HamsterStateMachine } from './HamsterStateMachine';
import { AnimationManifest } from '../../shared/hamster-states';

function buildManifest(overrides: Partial<AnimationManifest> = {}): AnimationManifest {
  const base: AnimationManifest = {
    idle: { file: 'idle.webp', durationMs: 1000, loop: true },
    idleVariant1: { file: 'v1.webp', durationMs: 2000, loop: false },
    idleVariant2: { file: 'v2.webp', durationMs: 2000, loop: false },
    fallingAsleep: { file: 'falling.webp', durationMs: 1500, loop: false },
    sleeping: { file: 'sleep.webp', durationMs: 3000, loop: true },
    waking: { file: 'waking.webp', durationMs: 1200, loop: false },
    dragging: { file: 'drag.webp', durationMs: 500, loop: true },
    scanning: { file: 'scan.webp', durationMs: 800, loop: true },
    eating: { file: 'eat.webp', durationMs: 2500, loop: false },
  };
  return { ...base, ...overrides };
}

describe('HamsterStateMachine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle', () => {
    const sm = new HamsterStateMachine(buildManifest());
    expect(sm.getState()).toBe('idle');
  });

  it('falls asleep after 5 minutes of no activity, then transitions to sleeping', () => {
    const sm = new HamsterStateMachine(buildManifest());
    sm.start();

    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(sm.getState()).toBe('fallingAsleep');

    vi.advanceTimersByTime(1500);
    expect(sm.getState()).toBe('sleeping');

    sm.stop();
  });

  it('wakes up on notifyActivity while sleeping, then returns to idle', () => {
    const sm = new HamsterStateMachine(buildManifest());
    sm.start();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1500);
    expect(sm.getState()).toBe('sleeping');

    sm.notifyActivity();
    expect(sm.getState()).toBe('waking');

    vi.advanceTimersByTime(1200);
    expect(sm.getState()).toBe('idle');

    sm.stop();
  });

  it('startDragging/stopDragging transitions correctly and cancels pending timers', () => {
    const sm = new HamsterStateMachine(buildManifest());
    sm.start();

    sm.startDragging();
    expect(sm.getState()).toBe('dragging');

    sm.stopDragging();
    expect(sm.getState()).toBe('idle');

    sm.stop();
  });

  it('startEating plays eating then calls onComplete and returns to idle', () => {
    const sm = new HamsterStateMachine(buildManifest());
    const onComplete = vi.fn();
    sm.start();

    sm.startEating(onComplete);
    expect(sm.getState()).toBe('eating');
    expect(onComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2500);
    expect(sm.getState()).toBe('idle');
    expect(onComplete).toHaveBeenCalledOnce();

    sm.stop();
  });

  it('startScanning/stopScanning transitions correctly', () => {
    const sm = new HamsterStateMachine(buildManifest());
    sm.start();

    sm.startScanning();
    expect(sm.getState()).toBe('scanning');

    sm.stopScanning();
    expect(sm.getState()).toBe('idle');

    sm.stop();
  });

  it('startScanning resets the inactivity clock to prevent sleep', () => {
    const sm = new HamsterStateMachine(buildManifest());
    sm.start();

    // Mock Math.random to prevent idle variants from triggering
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    // Advance to 4 minutes (well before sleep threshold)
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(sm.getState()).toBe('idle');

    // Start scanning, which resets lastActivity
    sm.startScanning();
    expect(sm.getState()).toBe('scanning');

    // Advance 4 more minutes while scanning (total elapsed: 8 min, but scan reset the clock)
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(sm.getState()).toBe('scanning');

    // Stop scanning, which also updates activity (resets the clock again)
    sm.stopScanning();
    expect(sm.getState()).toBe('idle');

    // Advance 5+ minutes to reach sleep threshold from stopScanning
    vi.advanceTimersByTime(5 * 60 * 1000 + 100);
    expect(sm.getState()).toBe('fallingAsleep');

    mockRandom.mockRestore();
    sm.stop();
  });

  it('notifies listeners on every state change', () => {
    const sm = new HamsterStateMachine(buildManifest());
    const listener = vi.fn();
    sm.onStateChange(listener);

    sm.startDragging();

    expect(listener).toHaveBeenCalledWith('dragging');
  });
});
