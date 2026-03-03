import { describe, it, expect, vi, beforeEach } from "vitest";
import { AudioRecorder } from "../src/audio/recorder.js";

function createMockMediaStream(sampleRate = 48000) {
  const track = {
    getSettings: () => ({ sampleRate }),
    stop: vi.fn(),
  };

  return {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

function createMockAudioContext(sampleRate = 48000) {
  const workletPort = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage: vi.fn(),
  };

  const workletNode = {
    port: workletPort,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const sourceNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const ctx = {
    sampleRate,
    destination: {},
    audioWorklet: {
      addModule: vi.fn(),
    },
    createMediaStreamSource: vi.fn(() => sourceNode),
    close: vi.fn(),
  };

  return { ctx, workletNode, workletPort, sourceNode };
}

describe("AudioRecorder", () => {
  let mockStream: MediaStream;
  let mockAudio: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mockStream = createMockMediaStream(48000);
    mockAudio = createMockAudioContext(48000);

    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(() => Promise.resolve(mockStream)),
      },
    });

    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => mockAudio.ctx)
    );

    vi.stubGlobal(
      "AudioWorkletNode",
      vi.fn(() => mockAudio.workletNode)
    );

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("requests microphone on start()", async () => {
    const recorder = new AudioRecorder();
    await recorder.start(vi.fn());

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it("passes exact deviceId constraint when provided", async () => {
    const recorder = new AudioRecorder();
    await recorder.start(vi.fn(), { deviceId: "mic-123" });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        deviceId: { exact: "mic-123" },
      },
    });
  });

  it("resamples from native sample rate to 16kHz", async () => {
    const onAudioData = vi.fn();
    const recorder = new AudioRecorder();
    await recorder.start(onAudioData);

    const nativeSamples = new Float32Array(960);
    for (let i = 0; i < nativeSamples.length; i++) {
      nativeSamples[i] = Math.sin(i * 0.1);
    }

    mockAudio.workletPort.onmessage!({
      data: { type: "audio", data: nativeSamples },
    } as MessageEvent);

    expect(onAudioData).toHaveBeenCalled();
    const emitted: Int16Array = onAudioData.mock.calls[0][0];
    expect(emitted.length).toBe(320);
  });

  it("resample() returns input unchanged when ratio=1", async () => {
    mockStream = createMockMediaStream(16000);
    mockAudio = createMockAudioContext(16000);

    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(() => Promise.resolve(mockStream)),
      },
    });
    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => mockAudio.ctx)
    );
    vi.stubGlobal(
      "AudioWorkletNode",
      vi.fn(() => mockAudio.workletNode)
    );

    const onAudioData = vi.fn();
    const recorder = new AudioRecorder();
    await recorder.start(onAudioData);

    const samples = new Float32Array(320);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = i / 320;
    }

    mockAudio.workletPort.onmessage!({
      data: { type: "audio", data: samples },
    } as MessageEvent);

    expect(onAudioData).toHaveBeenCalled();
    const emitted: Int16Array = onAudioData.mock.calls[0][0];
    expect(emitted.length).toBe(320);
  });

  it("linear interpolation correctness", async () => {
    const onAudioData = vi.fn();
    const recorder = new AudioRecorder();
    await recorder.start(onAudioData);

    const nativeSamples = new Float32Array(960);
    for (let i = 0; i < nativeSamples.length; i++) {
      nativeSamples[i] = i / 960;
    }

    mockAudio.workletPort.onmessage!({
      data: { type: "audio", data: nativeSamples },
    } as MessageEvent);

    expect(onAudioData).toHaveBeenCalled();
    const emitted: Int16Array = onAudioData.mock.calls[0][0];

    for (let i = 1; i < emitted.length; i++) {
      expect(emitted[i]).toBeGreaterThanOrEqual(emitted[i - 1]);
    }
  });

  it("float32ToInt16 conversion clamps and scales", async () => {
    const onAudioData = vi.fn();
    const recorder = new AudioRecorder();
    await recorder.start(onAudioData);

    const nativeSamples = new Float32Array(960);
    nativeSamples[0] = 0;
    nativeSamples[3] = 1.0;
    nativeSamples[6] = -1.0;
    nativeSamples[9] = 1.5;
    nativeSamples[12] = -1.5;

    mockAudio.workletPort.onmessage!({
      data: { type: "audio", data: nativeSamples },
    } as MessageEvent);

    expect(onAudioData).toHaveBeenCalled();
    const emitted: Int16Array = onAudioData.mock.calls[0][0];

    expect(emitted[0]).toBe(0);
    expect(emitted[1]).toBe(32767);
    expect(emitted[2]).toBe(-32768);
    expect(emitted[3]).toBe(32767);
    expect(emitted[4]).toBe(-32768);
  });

  it("emits 320-sample Int16Array chunks", async () => {
    const onAudioData = vi.fn();
    const recorder = new AudioRecorder();
    await recorder.start(onAudioData);

    const nativeSamples = new Float32Array(1920);
    mockAudio.workletPort.onmessage!({
      data: { type: "audio", data: nativeSamples },
    } as MessageEvent);

    expect(onAudioData).toHaveBeenCalledTimes(2);
    expect(onAudioData.mock.calls[0][0]).toBeInstanceOf(Int16Array);
    expect(onAudioData.mock.calls[0][0].length).toBe(320);
    expect(onAudioData.mock.calls[1][0].length).toBe(320);
  });

  it("setMuted() posts message to worklet port", async () => {
    const recorder = new AudioRecorder();
    await recorder.start(vi.fn());

    recorder.setMuted(true);

    expect(mockAudio.workletPort.postMessage).toHaveBeenCalledWith({
      type: "mute",
      muted: true,
    });
  });

  it("setMuted() before start() sends mute on connect", async () => {
    const recorder = new AudioRecorder();
    recorder.setMuted(true);

    await recorder.start(vi.fn());

    expect(mockAudio.workletPort.postMessage).toHaveBeenCalledWith({
      type: "mute",
      muted: true,
    });
  });

  it("stop() disconnects all nodes, stops tracks, closes context", async () => {
    const recorder = new AudioRecorder();
    await recorder.start(vi.fn());

    recorder.stop();

    expect(mockAudio.workletNode.disconnect).toHaveBeenCalled();
    expect(mockAudio.sourceNode.disconnect).toHaveBeenCalled();
    expect(
      (
        mockStream.getTracks()[0] as unknown as {
          stop: ReturnType<typeof vi.fn>;
        }
      ).stop
    ).toHaveBeenCalled();
    expect(mockAudio.ctx.close).toHaveBeenCalled();
  });
});
