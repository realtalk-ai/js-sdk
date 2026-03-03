import * as AudioEngine from "../native/AudioEngineModule.js";

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_THRESHOLD_MS = 100;
const BUFFER_THRESHOLD_SAMPLES =
  (TARGET_SAMPLE_RATE * BUFFER_THRESHOLD_MS) / 1000;
const TAIL_FLUSH_MS = 80;
const SAFETY_TIMEOUT_MS = 10000;

interface QueuedChunk {
  pcm: Int16Array;
  traceId: string;
}

export interface AudioPlayerCallbacks {
  onPlaybackStart?: (traceId: string) => void;
  onPlaybackEnd?: (traceId: string) => void;
}

export class AudioPlayer {
  private queue: QueuedChunk[] = [];
  private isPlaying = false;
  private currentTraceId: string | null = null;
  private callbacks: AudioPlayerCallbacks;
  private bufferedSamples = 0;
  private tailTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private playbackEndTime = 0;
  private playbackTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(callbacks: AudioPlayerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  play(pcm: Int16Array, traceId: string): void {
    this.queue.push({ pcm, traceId });
    this.bufferedSamples += pcm.length;

    this.resetTailTimer();

    if (this.bufferedSamples >= BUFFER_THRESHOLD_SAMPLES) {
      this.flush();
    }
  }

  clear(): void {
    this.clearTailTimer();
    this.clearSafetyTimer();
    this.clearPlaybackTimer();
    this.queue = [];
    this.bufferedSamples = 0;
    this.isPlaying = false;
    this.playbackEndTime = 0;

    if (this.currentTraceId) {
      this.callbacks.onPlaybackEnd?.(this.currentTraceId);
      this.currentTraceId = null;
    }

    AudioEngine.stopPlayback();
  }

  stop(): void {
    this.clear();
    AudioEngine.tearDown();
  }

  setVolume(volume: number): void {
    AudioEngine.setVolume(volume);
  }

  private resetTailTimer(): void {
    this.clearTailTimer();
    this.tailTimer = setTimeout(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, TAIL_FLUSH_MS);
  }

  private clearTailTimer(): void {
    if (this.tailTimer) {
      clearTimeout(this.tailTimer);
      this.tailTimer = null;
    }
  }

  private resetSafetyTimer(): void {
    this.clearSafetyTimer();
    this.safetyTimer = setTimeout(() => {
      if (this.isPlaying) {
        console.warn(
          "[RealTalk AudioPlayer] Safety timeout: forcing playback end"
        );
        AudioEngine.stopPlayback();
        this.playbackEndTime = 0;
        this.isPlaying = false;
        if (this.currentTraceId) {
          this.callbacks.onPlaybackEnd?.(this.currentTraceId);
          this.currentTraceId = null;
        }
        if (this.queue.length > 0) {
          this.flush();
        }
      }
    }, SAFETY_TIMEOUT_MS);
  }

  private clearSafetyTimer(): void {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
  }

  private clearPlaybackTimer(): void {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  private flush(): void {
    if (this.queue.length === 0) {
      return;
    }

    this.isPlaying = true;
    this.clearTailTimer();
    this.resetSafetyTimer();

    const chunks = this.queue.splice(0);
    this.bufferedSamples = 0;

    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.pcm.length;
    }

    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk.pcm, offset);
      offset += chunk.pcm.length;
    }

    const firstTraceId = chunks[0].traceId;
    const lastTraceId = chunks[chunks.length - 1].traceId;

    if (this.currentTraceId !== firstTraceId) {
      if (this.currentTraceId) {
        this.callbacks.onPlaybackEnd?.(this.currentTraceId);
      }
      this.currentTraceId = firstTraceId;
      this.callbacks.onPlaybackStart?.(firstTraceId);
    }

    if (firstTraceId !== lastTraceId) {
      this.callbacks.onPlaybackEnd?.(firstTraceId);
      this.currentTraceId = lastTraceId;
      this.callbacks.onPlaybackStart?.(lastTraceId);
    }

    AudioEngine.playAudio(merged);

    const durationMs = (totalLength / TARGET_SAMPLE_RATE) * 1000;
    const now = Date.now();
    this.playbackEndTime = Math.max(this.playbackEndTime, now) + durationMs;

    this.clearPlaybackTimer();
    this.playbackTimer = setTimeout(() => {
      this.onPlaybackFinished();
    }, this.playbackEndTime - now);
  }

  private onPlaybackFinished(): void {
    this.playbackEndTime = 0;
    this.clearSafetyTimer();

    if (this.queue.length > 0) {
      this.flush();
    } else {
      this.isPlaying = false;
      if (this.currentTraceId) {
        this.callbacks.onPlaybackEnd?.(this.currentTraceId);
        this.currentTraceId = null;
      }
    }
  }
}
