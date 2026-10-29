import type { TimerLike } from '../../src/config/options';

/** Manual timers: `fire()` runs the pending callback. */
export class ManualTimers implements TimerLike {
  private callback: (() => void) | undefined;
  readonly delays: number[] = [];
  cleared = 0;

  set(callback: () => void, ms: number): unknown {
    this.callback = callback;
    this.delays.push(ms);
    return ms;
  }

  clear(): void {
    this.cleared += 1;
    this.callback = undefined;
  }

  fire(): void {
    const callback = this.callback;
    this.callback = undefined;
    callback?.();
  }

  get armed(): boolean {
    return this.callback !== undefined;
  }
}
