/**
 * Rolling-window rate limiter. Purely clock-driven (no timers of its own) so it
 * is deterministically testable: reserve() records a slot and returns the ms a
 * caller must wait before that slot may run (0 = run now). At most `max` calls
 * are permitted to start within any `windowMs`.
 */
export class RateLimiter {
  private scheduled: number[] = [];

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  reserve(now: number): number {
    // Drop slots whose window has fully elapsed relative to `now`.
    this.scheduled = this.scheduled.filter((t) => t > now - this.windowMs);
    let at = now;
    if (this.scheduled.length >= this.max) {
      // The slot `max` back frees a window after it ran.
      at = this.scheduled[this.scheduled.length - this.max] + this.windowMs;
    }
    this.scheduled.push(at);
    return Math.max(0, at - now);
  }
}
