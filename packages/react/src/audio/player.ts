import type { AudioSource } from "@realtalk-ai/core";

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

interface SourceStream {
  queue: QueuedChunk[];
  bufferedSamples: number;
  isPlaying: boolean;
  scheduledEndTime: number;
  currentTraceId: string | null;
  gainNode: GainNode;
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private streams = new Map<AudioSource, SourceStream>();
  private callbacks: AudioPlayerCallbacks;
  private volume = 1;

  constructor(callbacks: AudioPlayerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async play(
    pcm: Int16Array,
    traceId: string,
    source: AudioSource = "agent",
  ): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const stream = this.getStream(source);
    stream.queue.push({ pcm, traceId });
    stream.bufferedSamples += pcm.length;

    if (
      !stream.isPlaying &&
      stream.bufferedSamples >= BUFFER_THRESHOLD_SAMPLES
    ) {
      this.processQueue(source);
    }
  }

  clear(): void {
    this.clearStream("agent");
  }

  stop(): void {
    for (const source of this.streams.keys()) {
      this.clearStream(source);
    }
    this.streams.clear();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.masterGain = null;
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
    if (this.volume > 0 && this.audioContext?.state === "suspended") {
      void this.audioContext.resume().catch(() => {});
    }
  }

  private getStream(source: AudioSource): SourceStream {
    let stream = this.streams.get(source);
    if (!stream) {
      const gainNode = this.audioContext!.createGain();
      gainNode.connect(this.masterGain!);
      stream = {
        queue: [],
        bufferedSamples: 0,
        isPlaying: false,
        scheduledEndTime: 0,
        currentTraceId: null,
        gainNode,
      };
      this.streams.set(source, stream);
    }
    return stream;
  }

  private clearStream(source: AudioSource): void {
    const stream = this.streams.get(source);
    if (!stream) {
      return;
    }

    stream.queue = [];
    stream.bufferedSamples = 0;
    stream.isPlaying = false;
    stream.scheduledEndTime = 0;

    if (stream.currentTraceId) {
      if (source === "agent") {
        this.callbacks.onPlaybackEnd?.(stream.currentTraceId);
      }
      stream.currentTraceId = null;
    }

    if (this.audioContext && this.masterGain) {
      stream.gainNode.disconnect();
      stream.gainNode = this.audioContext.createGain();
      stream.gainNode.connect(this.masterGain);
    }
  }

  private processQueue(source: AudioSource): void {
    const stream = this.streams.get(source);
    if (!this.audioContext || !stream || stream.queue.length === 0) {
      if (stream) {
        stream.isPlaying = false;
      }
      return;
    }

    stream.isPlaying = true;
    const chunk = stream.queue.shift()!;
    stream.bufferedSamples -= chunk.pcm.length;

    if (stream.currentTraceId !== chunk.traceId) {
      if (source === "agent") {
        if (stream.currentTraceId) {
          this.callbacks.onPlaybackEnd?.(stream.currentTraceId);
        }
        this.callbacks.onPlaybackStart?.(chunk.traceId);
      }
      stream.currentTraceId = chunk.traceId;
    }

    const floatData = this.int16ToFloat32(chunk.pcm);
    const audioBuffer = this.audioContext.createBuffer(
      1,
      floatData.length,
      TARGET_SAMPLE_RATE,
    );
    audioBuffer.getChannelData(0).set(floatData);

    const bufferSource = this.audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(stream.gainNode);

    const startTime = Math.max(
      this.audioContext.currentTime,
      stream.scheduledEndTime,
    );
    bufferSource.start(startTime);

    const duration = audioBuffer.duration;
    stream.scheduledEndTime = startTime + duration;

    bufferSource.onended = () => {
      if (stream.queue.length > 0) {
        this.processQueue(source);
      } else {
        stream.isPlaying = false;
        if (stream.currentTraceId) {
          if (source === "agent") {
            this.callbacks.onPlaybackEnd?.(stream.currentTraceId);
          }
          stream.currentTraceId = null;
        }
        stream.scheduledEndTime = 0;
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
