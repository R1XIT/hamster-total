import { HamsterState, AnimationManifest } from '../../shared/hamster-states';

const IDLE_STATES: HamsterState[] = ['idle', 'idleVariant1', 'idleVariant2'];
// Fallback used only when no configured value is supplied (kept so existing
// callers/tests that omit the constructor argument keep working). The real
// value comes from AppConfig.sleepTimeoutMinutes at runtime — see
// renderer/index.ts.
const DEFAULT_SLEEP_INACTIVITY_MS = 5 * 60 * 1000;
const SLEEP_CHECK_INTERVAL_MS = 5000;
const IDLE_VARIANT_CHECK_INTERVAL_MS = 30 * 1000;
const IDLE_VARIANT_CHANCE = 0.3;

export type StateChangeListener = (state: HamsterState) => void;

export class HamsterStateMachine {
  private state: HamsterState = 'idle';
  private lastActivity = Date.now();
  private listeners: StateChangeListener[] = [];
  private oneShotTimer: ReturnType<typeof setTimeout> | null = null;
  private sleepCheckTimer: ReturnType<typeof setInterval> | null = null;
  private idleVariantTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private manifest: AnimationManifest,
    private sleepTimeoutMs: number = DEFAULT_SLEEP_INACTIVITY_MS
  ) {}

  /**
   * Updates how long the hamster idles before falling asleep. Safe to call
   * while running (e.g. in response to a live Settings change) — it takes
   * effect on the next periodic sleep check without resetting lastActivity.
   */
  setSleepTimeoutMs(ms: number): void {
    this.sleepTimeoutMs = ms;
  }

  start(): void {
    this.sleepCheckTimer = setInterval(() => this.checkSleep(), SLEEP_CHECK_INTERVAL_MS);
    this.idleVariantTimer = setInterval(() => this.maybePlayIdleVariant(), IDLE_VARIANT_CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.sleepCheckTimer) clearInterval(this.sleepCheckTimer);
    if (this.idleVariantTimer) clearInterval(this.idleVariantTimer);
    this.clearOneShotTimer();
    this.sleepCheckTimer = null;
    this.idleVariantTimer = null;
  }

  getState(): HamsterState {
    return this.state;
  }

  onStateChange(listener: StateChangeListener): void {
    this.listeners.push(listener);
  }

  notifyActivity(): void {
    this.lastActivity = Date.now();
    if (this.state === 'sleeping' || this.state === 'fallingAsleep') {
      this.wake();
    }
  }

  startDragging(): void {
    this.notifyActivity();
    this.clearOneShotTimer();
    this.setState('dragging');
  }

  stopDragging(): void {
    this.notifyActivity();
    this.setState('idle');
  }

  startScanning(): void {
    this.notifyActivity();
    this.clearOneShotTimer();
    this.setState('scanning');
  }

  stopScanning(): void {
    this.notifyActivity();
    this.setState('idle');
  }

  triggerClickAnimation(): void {
    if (this.state === 'sleeping' || this.state === 'fallingAsleep') {
      this.notifyActivity();
      return;
    }
    if (this.state !== 'idle') return;
    this.playRandomIdleVariant();
  }

  startEating(onComplete: () => void): void {
    this.notifyActivity();
    this.clearOneShotTimer();
    this.setState('eating');
    const duration = this.manifest.eating.durationMs;
    this.oneShotTimer = setTimeout(() => {
      this.setState('idle');
      onComplete();
    }, duration);
  }

  private checkSleep(): void {
    if (!IDLE_STATES.includes(this.state)) return;
    if (Date.now() - this.lastActivity >= this.sleepTimeoutMs) {
      this.fallAsleep();
    }
  }

  private fallAsleep(): void {
    this.clearOneShotTimer();
    this.setState('fallingAsleep');
    const duration = this.manifest.fallingAsleep.durationMs;
    this.oneShotTimer = setTimeout(() => {
      this.setState('sleeping');
    }, duration);
  }

  private wake(): void {
    this.clearOneShotTimer();
    this.setState('waking');
    const duration = this.manifest.waking.durationMs;
    this.oneShotTimer = setTimeout(() => {
      this.setState('idle');
    }, duration);
  }

  private maybePlayIdleVariant(): void {
    if (this.state !== 'idle') return;
    if (Math.random() > IDLE_VARIANT_CHANCE) return;
    this.playRandomIdleVariant();
  }

  private playRandomIdleVariant(): void {
    this.clearOneShotTimer();
    const variant: HamsterState = Math.random() < 0.5 ? 'idleVariant1' : 'idleVariant2';
    this.setState(variant);
    const duration = this.manifest[variant].durationMs;
    this.oneShotTimer = setTimeout(() => {
      this.setState('idle');
    }, duration);
  }

  private clearOneShotTimer(): void {
    if (this.oneShotTimer) {
      clearTimeout(this.oneShotTimer);
      this.oneShotTimer = null;
    }
  }

  private setState(next: HamsterState): void {
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }
}
