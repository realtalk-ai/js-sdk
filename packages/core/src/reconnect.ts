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

export class ConversationReconnectPolicy implements ReconnectPolicy {
  constructor(
    private readonly retryDelaysMs: number[] = [1000, 2000, 4000, 5000],
    private readonly giveUpAfterMs: number = 5 * 60 * 1000,
  ) {}

  nextRetryDelayMs(context: ReconnectContext): number | null {
    if (context.elapsedMs >= this.giveUpAfterMs) return null;
    const lastDelayIndex = this.retryDelaysMs.length - 1;
    const plannedDelay =
      this.retryDelaysMs[Math.min(context.retryCount, lastDelayIndex)]!;
    const jitter = 0.5 + Math.random() * 0.5;
    return plannedDelay * jitter;
  }
}
