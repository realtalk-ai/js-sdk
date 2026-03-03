const TARGET_SAMPLE_RATE = 16000;
const BUFFER_THRESHOLD_MS = 100;
const BUFFER_THRESHOLD_SAMPLES =
  (TARGET_SAMPLE_RATE * BUFFER_THRESHOLD_MS) / 1000;

interface QueuedChunk {
  pcm: Int16Array;
  traceId: string;
}

export interface AudioPlayerCallbacks {
  onPlaybackStart?: (traceId: string) => void;
  onPlaybackEnd?: (traceId: string) => void;
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private queue: QueuedChunk[] = [];
  private isPlaying = false;
  private currentTraceId: string | null = null;
  private gainNode: GainNode | null = null;
  private callbacks: AudioPlayerCallbacks;
  private bufferedSamples = 0;
  private scheduledEndTime = 0;

  constructor(callbacks: AudioPlayerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async play(pcm: Int16Array, traceId: string): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.queue.push({ pcm, traceId });
    this.bufferedSamples += pcm.length;

    if (!this.isPlaying && this.bufferedSamples >= BUFFER_THRESHOLD_SAMPLES) {
      this.processQueue();
    }
  }

  clear(): void {
    this.queue = [];
    this.bufferedSamples = 0;
    this.isPlaying = false;
    this.scheduledEndTime = 0;

    if (this.currentTraceId) {
      this.callbacks.onPlaybackEnd?.(this.currentTraceId);
      this.currentTraceId = null;
    }

    if (this.audioContext && this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  stop(): void {
    this.clear();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.gainNode = null;
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  private processQueue(): void {
    if (!this.audioContext || !this.gainNode || this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const chunk = this.queue.shift()!;
    this.bufferedSamples -= chunk.pcm.length;

    if (this.currentTraceId !== chunk.traceId) {
      if (this.currentTraceId) {
        this.callbacks.onPlaybackEnd?.(this.currentTraceId);
      }
      this.currentTraceId = chunk.traceId;
      this.callbacks.onPlaybackStart?.(chunk.traceId);
    }

    const floatData = this.int16ToFloat32(chunk.pcm);
    const audioBuffer = this.audioContext.createBuffer(
      1,
      floatData.length,
      TARGET_SAMPLE_RATE
    );
    audioBuffer.getChannelData(0).set(floatData);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const startTime = Math.max(
      this.audioContext.currentTime,
      this.scheduledEndTime
    );
    source.start(startTime);

    const duration = audioBuffer.duration;
    this.scheduledEndTime = startTime + duration;

    source.onended = () => {
      if (this.queue.length > 0) {
        this.processQueue();
      } else {
        this.isPlaying = false;
        if (this.currentTraceId) {
          this.callbacks.onPlaybackEnd?.(this.currentTraceId);
          this.currentTraceId = null;
        }
        this.scheduledEndTime = 0;
      }
    };
  }

  private int16ToFloat32(pcm: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      float32[i] = pcm[i] / 32768;
    }
    return float32;
  }
}
