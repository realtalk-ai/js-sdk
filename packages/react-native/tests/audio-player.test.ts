import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAudioEngine = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  startRecording: vi.fn().mockResolvedValue(undefined),
  stopRecording: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
  stopPlayback: vi.fn().mockResolvedValue(undefined),
  setVolume: vi.fn().mockResolvedValue(undefined),
  setMuted: vi.fn().mockResolvedValue(undefined),
  tearDown: vi.fn().mockResolvedValue(undefined),
  onMicrophoneData: vi.fn(() => vi.fn()),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
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

import { AudioPlayer } from "../src/audio/player.js";

describe("AudioPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("buffers audio until threshold is reached", async () => {
    const player = new AudioPlayer();

    await player.play(new Int16Array(100), "trace-1");

    expect(mockAudioEngine.playAudio).not.toHaveBeenCalled();
  });

  it("flushes merged audio to AudioEngine.playAudio when threshold reached", async () => {
    const player = new AudioPlayer();

    await player.play(new Int16Array(800), "trace-1");
    await player.play(new Int16Array(900), "trace-1");

    expect(mockAudioEngine.playAudio).toHaveBeenCalledTimes(1);
    const merged = mockAudioEngine.playAudio.mock.calls[0][0];
    expect(merged).toBeInstanceOf(Int16Array);
    expect(merged.length).toBe(1700);
  });

  it("calls onPlaybackStart on first flush", async () => {
    const onPlaybackStart = vi.fn();
    const player = new AudioPlayer({ onPlaybackStart });

    await player.play(new Int16Array(1600), "trace-1");

    expect(onPlaybackStart).toHaveBeenCalledWith("trace-1");
  });

  it("calls onPlaybackEnd after playback finishes", async () => {
    const onPlaybackEnd = vi.fn();
    const player = new AudioPlayer({ onPlaybackEnd });

    await player.play(new Int16Array(1600), "trace-1");

    expect(onPlaybackEnd).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);

    expect(onPlaybackEnd).toHaveBeenCalledWith("trace-1");
  });

  it("handles trace ID change between chunks", async () => {
    const onPlaybackStart = vi.fn();
    const onPlaybackEnd = vi.fn();
    const player = new AudioPlayer({ onPlaybackStart, onPlaybackEnd });

    await player.play(new Int16Array(800), "trace-1");
    await player.play(new Int16Array(800), "trace-2");

    expect(onPlaybackEnd).toHaveBeenCalledWith("trace-1");
    expect(onPlaybackStart).toHaveBeenCalledWith("trace-2");
  });

  it("clear calls stopPlayback and fires onPlaybackEnd", async () => {
    const onPlaybackEnd = vi.fn();
    const player = new AudioPlayer({ onPlaybackEnd });

    await player.play(new Int16Array(1600), "trace-1");

    player.clear();

    expect(mockAudioEngine.stopPlayback).toHaveBeenCalled();
    expect(onPlaybackEnd).toHaveBeenCalledWith("trace-1");
  });

  it("setVolume calls AudioEngine.setVolume", () => {
    const player = new AudioPlayer();

    player.setVolume(0.5);

    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(0.5);
  });

  it("tail flush timer sends remaining buffered audio", async () => {
    const player = new AudioPlayer();

    await player.play(new Int16Array(100), "trace-1");

    expect(mockAudioEngine.playAudio).not.toHaveBeenCalled();

    vi.advanceTimersByTime(80);

    expect(mockAudioEngine.playAudio).toHaveBeenCalledTimes(1);
    expect(mockAudioEngine.playAudio.mock.calls[0][0].length).toBe(100);
  });

  it("safety timeout forces playback end", async () => {
    const onPlaybackEnd = vi.fn();
    const player = new AudioPlayer({ onPlaybackEnd });

    await player.play(new Int16Array(320000), "trace-1");
    expect(onPlaybackEnd).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10000);

    expect(onPlaybackEnd).toHaveBeenCalledWith("trace-1");
    expect(mockAudioEngine.stopPlayback).toHaveBeenCalled();
  });
});
