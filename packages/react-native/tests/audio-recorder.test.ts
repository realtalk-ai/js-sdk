import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAudioEngine = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  startRecording: vi.fn().mockResolvedValue(undefined),
  stopRecording: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
  stopPlayback: vi.fn().mockResolvedValue(undefined),
  setMuted: vi.fn().mockResolvedValue(undefined),
  tearDown: vi.fn().mockResolvedValue(undefined),
  onMicrophoneData: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  PermissionsAndroid: {
    request: vi.fn().mockResolvedValue("granted"),
    PERMISSIONS: { RECORD_AUDIO: "android.permission.RECORD_AUDIO" },
    RESULTS: { GRANTED: "granted" },
  },
  NativeModules: {
    RealTalkAudio: {
      initialize: vi.fn().mockResolvedValue(undefined),
      startRecording: vi.fn().mockResolvedValue(undefined),
      stopRecording: vi.fn().mockResolvedValue(undefined),
      playAudio: vi.fn().mockResolvedValue(undefined),
      stopPlayback: vi.fn().mockResolvedValue(undefined),
      setMuted: vi.fn().mockResolvedValue(undefined),
      tearDown: vi.fn().mockResolvedValue(undefined),
    },
  },
  NativeEventEmitter: vi.fn(() => ({
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  })),
}));

vi.mock("../src/native/AudioEngineModule.js", () => mockAudioEngine);

import { AudioRecorder } from "../src/audio/recorder.js";
import { Platform, PermissionsAndroid } from "react-native";

describe("AudioRecorder", () => {
  let micCallback: ((pcm: Int16Array) => void) | null;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    micCallback = null;
    mockAudioEngine.onMicrophoneData.mockImplementation(
      (cb: (pcm: Int16Array) => void) => {
        micCallback = cb;
        return unsubscribe;
      }
    );
  });

  it("requests RECORD_AUDIO permission on Android", async () => {
    const recorder = new AudioRecorder();
    const onData = vi.fn();

    await recorder.start(onData);

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
  });

  it("throws when Android permission is denied", async () => {
    vi.mocked(PermissionsAndroid.request).mockResolvedValueOnce(
      "denied" as any
    );

    const recorder = new AudioRecorder();

    await expect(recorder.start(vi.fn())).rejects.toThrow(
      "Microphone permission not granted"
    );
  });

  it("skips permission request on iOS", async () => {
    (Platform as any).OS = "ios";

    const recorder = new AudioRecorder();
    await recorder.start(vi.fn());

    expect(PermissionsAndroid.request).not.toHaveBeenCalled();

    (Platform as any).OS = "android";
  });

  it("starts recording and subscribes to mic data", async () => {
    const recorder = new AudioRecorder();
    await recorder.start(vi.fn());

    expect(mockAudioEngine.startRecording).toHaveBeenCalled();
    expect(mockAudioEngine.onMicrophoneData).toHaveBeenCalled();
  });

  it("forwards mic data to onAudioData callback", async () => {
    const recorder = new AudioRecorder();
    const onData = vi.fn();
    await recorder.start(onData);

    const pcm = new Int16Array(320);
    for (let i = 0; i < 320; i++) pcm[i] = i;
    micCallback!(pcm);

    expect(onData).toHaveBeenCalledTimes(1);
    const emitted = onData.mock.calls[0][0];
    expect(emitted).toBeInstanceOf(Int16Array);
    expect(emitted.length).toBe(320);
  });

  it("chunks audio into 320-sample blocks", async () => {
    const recorder = new AudioRecorder();
    const onData = vi.fn();
    await recorder.start(onData);

    const pcm = new Int16Array(640);
    micCallback!(pcm);

    expect(onData).toHaveBeenCalledTimes(2);
    expect(onData.mock.calls[0][0].length).toBe(320);
    expect(onData.mock.calls[1][0].length).toBe(320);
  });

  it("buffers partial chunks until enough samples arrive", async () => {
    const recorder = new AudioRecorder();
    const onData = vi.fn();
    await recorder.start(onData);

    micCallback!(new Int16Array(200));
    expect(onData).not.toHaveBeenCalled();

    micCallback!(new Int16Array(200));
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData.mock.calls[0][0].length).toBe(320);
  });

  it("sends zeros when muted", async () => {
    const recorder = new AudioRecorder();
    const onData = vi.fn();
    await recorder.start(onData);

    recorder.setMuted(true);

    const pcm = new Int16Array(320);
    for (let i = 0; i < 320; i++) pcm[i] = 1000;
    micCallback!(pcm);

    expect(onData).toHaveBeenCalledTimes(1);
    const emitted = onData.mock.calls[0][0];
    for (let i = 0; i < emitted.length; i++) {
      expect(emitted[i]).toBe(0);
    }
  });

  it("setMuted calls AudioEngine.setMuted", async () => {
    const recorder = new AudioRecorder();
    await recorder.start(vi.fn());

    recorder.setMuted(true);
    expect(mockAudioEngine.setMuted).toHaveBeenCalledWith(true);

    recorder.setMuted(false);
    expect(mockAudioEngine.setMuted).toHaveBeenCalledWith(false);
  });

  it("stop calls stopRecording and unsubscribes", async () => {
    const recorder = new AudioRecorder();
    await recorder.start(vi.fn());

    recorder.stop();

    expect(mockAudioEngine.stopRecording).toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
