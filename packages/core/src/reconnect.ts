export interface ReconnectContext {
  retryCount: number;
  elapsedMs: number;
  error?: Error;
}

export interface ReconnectPolicy {
  nextRetryDelayMs(context: ReconnectContext): number | null;
}

export class DefaultReconnectPolicy implements ReconnectPolicy {
  private retryDelays: number[];

  constructor(retryDelays: number[] = [300, 1000, 3000, 5000, 10000]) {
    this.retryDelays = retryDelays;
  }

  nextRetryDelayMs(context: ReconnectContext): number | null {
    if (context.retryCount >= this.retryDelays.length) return null;
    return this.retryDelays[context.retryCount]!;
  }
}
