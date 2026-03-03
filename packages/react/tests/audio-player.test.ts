import { describe, it, expect, vi, beforeEach } from "vitest";
import { AudioPlayer } from "../src/audio/player.js";

function createMockAudioContext() {
  const gainNode = {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const sourceNode = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
    onended: null as (() => void) | null,
  };

  const ctx = {
    state: "running" as AudioContextState,
    currentTime: 0,
    sampleRate: 16000,
    destination: {},
    createGain: vi.fn(() => gainNode),
    createBuffer: vi.fn(
      (_channels: number, length: number, sampleRate: number) => {
        const data = new Float32Array(length);
        return {
          duration: length / sampleRate,
          getChannelData: vi.fn(() => data),
          length,
          sampleRate,
          numberOfChannels: 1,
        };
      }
    ),
    createBufferSource: vi.fn(() => {
      const node = { ...sourceNode, onended: null as (() => void) | null };
      sourceNode.onended = null;
      return node;
    }),
    resume: vi.fn(),
    close: vi.fn(),
  };

  return { ctx, gainNode, sourceNode };
}

describe("AudioPlayer", () => {
  let mockCtx: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mockCtx = createMockAudioContext();
    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => mockCtx.ctx)
    );
  });

  it("creates AudioContext lazily on first play()", async () => {
    const player = new AudioPlayer();
    expect(AudioContext).not.toHaveBeenCalled();

    const pcm = new Int16Array(1600);
    await player.play(pcm, "trace-1");

    expect(AudioContext).toHaveBeenCalledOnce();
  });

  it("buffers audio until threshold before processing", async () => {
    const onPlaybackStart = vi.fn();
    const player = new AudioPlayer({ onPlaybackStart });

    const smallChunk = new Int16Array(100);
    await player.play(smallChunk, "trace-1");

    expect(onPlaybackStart).not.toHaveBeenCalled();
    expect(mockCtx.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("fires onPlaybackStart when playback begins", async () => {
    const onPlaybackStart = vi.fn();
    const player = new AudioPlayer({ onPlaybackStart });

    const pcm = new Int16Array(1600);
    await player.play(pcm, "trace-1");

    expect(onPlaybackStart).toHaveBeenCalledWith("trace-1");
  });

  it("fires onPlaybackEnd when queue drains via source.onended", async () => {
    const onPlaybackEnd = vi.fn();
    const player = new AudioPlayer({ onPlaybackEnd });

    const pcm = new Int16Array(1600);
    await player.play(pcm, "trace-1");

    const source = mockCtx.ctx.createBufferSource.mock.results[0].value;
    source.onended();

    expect(onPlaybackEnd).toHaveBeenCalledWith("trace-1");
  });

  it("fires onPlaybackEnd/onPlaybackStart on traceId change", async () => {
    const onPlaybackStart = vi.fn();
    const onPlaybackEnd = vi.fn();
    const player = new AudioPlayer({ onPlaybackStart, onPlaybackEnd });

    await player.play(new Int16Array(1600), "trace-1");

    const source1 = mockCtx.ctx.createBufferSource.mock.results[0].value;

    await player.play(new Int16Array(1600), "trace-2");
    source1.onended();

    expect(onPlaybackEnd).toHaveBeenCalledWith("trace-1");
    expect(onPlaybackStart).toHaveBeenCalledWith("trace-2");
  });

  it("clear() resets queue and fires onPlaybackEnd", async () => {
    const onPlaybackEnd = vi.fn();
    const player = new AudioPlayer({ onPlaybackEnd });

    await player.play(new Int16Array(1600), "trace-1");
    player.clear();

    expect(onPlaybackEnd).toHaveBeenCalledWith("trace-1");
  });

  it("stop() closes AudioContext", async () => {
    const player = new AudioPlayer();
    await player.play(new Int16Array(1600), "trace-1");

    player.stop();

    expect(mockCtx.ctx.close).toHaveBeenCalledOnce();
  });

  it("setVolume() clamps and applies to gainNode", async () => {
    const player = new AudioPlayer();
    await player.play(new Int16Array(1600), "trace-1");

    player.setVolume(0.5);
    expect(mockCtx.gainNode.gain.value).toBe(0.5);

    player.setVolume(-1);
    expect(mockCtx.gainNode.gain.value).toBe(0);

    player.setVolume(2);
    expect(mockCtx.gainNode.gain.value).toBe(1);
  });

  it("resumes suspended AudioContext", async () => {
    mockCtx.ctx.state = "suspended";
    const player = new AudioPlayer();

    await player.play(new Int16Array(1600), "trace-1");

    expect(mockCtx.ctx.resume).toHaveBeenCalledOnce();
  });

  it("int16ToFloat32 conversion accuracy via play() path", async () => {
    const player = new AudioPlayer();

    const pcm = new Int16Array([0, 16384, -16384, 32767, -32768]);
    const largePcm = new Int16Array(1600);
    largePcm.set(pcm);
    await player.play(largePcm, "trace-1");

    const buffer = mockCtx.ctx.createBuffer.mock.results[0].value;
    const channelData: Float32Array = buffer.getChannelData(0);

    expect(channelData[0]).toBeCloseTo(0, 5);
    expect(channelData[1]).toBeCloseTo(0.5, 2);
    expect(channelData[2]).toBeCloseTo(-0.5, 2);
    expect(channelData[3]).toBeCloseTo(1.0, 2);
    expect(channelData[4]).toBeCloseTo(-1.0, 2);
  });
});
