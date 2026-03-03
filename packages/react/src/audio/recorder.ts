const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SIZE = 320;

const WORKLET_PROCESSOR = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.muted = false;

    this.port.onmessage = (event) => {
      if (event.data.type === 'mute') {
        this.muted = event.data.muted;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const channelData = input[0];

    if (this.muted) {
      const silentChunk = new Float32Array(channelData.length);
      this.buffer.push(...silentChunk);
    } else {
      this.buffer.push(...channelData);
    }

    while (this.buffer.length >= 128) {
      const chunk = this.buffer.splice(0, 128);
      this.port.postMessage({ type: 'audio', data: new Float32Array(chunk) });
    }

    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
`;

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private onAudioData: ((pcm: Int16Array) => void) | null = null;
  private resampleBuffer: number[] = [];
  private muted = false;

  async start(
    onAudioData: (pcm: Int16Array) => void,
    options?: { deviceId?: string }
  ): Promise<void> {
    this.onAudioData = onAudioData;

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(options?.deviceId && { deviceId: { exact: options.deviceId } }),
    };

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });

    const nativeSampleRate =
      this.stream.getAudioTracks()[0].getSettings().sampleRate ?? 48000;

    this.audioContext = new AudioContext({ sampleRate: nativeSampleRate });
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    const workletBlob = new Blob([WORKLET_PROCESSOR], {
      type: "application/javascript",
    });
    const workletUrl = URL.createObjectURL(workletBlob);

    await this.audioContext.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);

    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      "audio-capture-processor"
    );

    const resampleRatio = nativeSampleRate / TARGET_SAMPLE_RATE;

    this.workletNode.port.onmessage = (event) => {
      if (event.data.type === "audio") {
        const floatData: Float32Array = event.data.data;
        this.processAudio(floatData, resampleRatio);
      }
    };

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);

    if (this.muted) {
      this.workletNode.port.postMessage({ type: "mute", muted: true });
    }
  }

  stop(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.resampleBuffer = [];
    this.onAudioData = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: "mute", muted });
    }
  }

  private processAudio(floatData: Float32Array, resampleRatio: number): void {
    const resampled = this.resample(floatData, resampleRatio);

    for (let i = 0; i < resampled.length; i++) {
      this.resampleBuffer.push(resampled[i]);
    }

    while (this.resampleBuffer.length >= CHUNK_SIZE) {
      const chunk = this.resampleBuffer.splice(0, CHUNK_SIZE);
      const int16Data = this.float32ToInt16(new Float32Array(chunk));
      this.onAudioData?.(int16Data);
    }
  }

  private resample(input: Float32Array, ratio: number): Float32Array {
    if (ratio === 1) {
      return input;
    }

    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const fraction = srcIndex - srcIndexFloor;

      output[i] =
        input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction;
    }

    return output;
  }

  private float32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 32768 : s * 32767;
    }
    return int16;
  }
}
