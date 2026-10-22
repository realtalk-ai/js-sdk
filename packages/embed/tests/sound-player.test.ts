import { describe, it, expect, vi, afterEach } from "vitest";
import { createSoundPlayer } from "../src/sound-player.js";

const SOUND = new Uint8Array([1, 2, 3]);
const DECODED = {};

function stubAudioContext({
  state = "running" as AudioContextState,
  decodeFails = false,
} = {}) {
  const context = {
    state,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    decodeAudioData: vi.fn(() =>
      decodeFails
        ? Promise.reject(new Error("Unable to decode audio data"))
        : Promise.resolve(DECODED),
    ),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
    })),
  };
  vi.stubGlobal(
    "AudioContext",
    vi.fn(() => context),
  );
  return context;
}

describe("createSoundPlayer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays nothing and creates no audio context before unlock", async () => {
    const context = stubAudioContext();
    const player = createSoundPlayer();

    await expect(player.play(SOUND)).resolves.toBeUndefined();

    expect(AudioContext).not.toHaveBeenCalled();
    expect(context.decodeAudioData).not.toHaveBeenCalled();
  });

  it("creates one audio context and resumes it on every unlock", () => {
    const context = stubAudioContext();
    const player = createSoundPlayer();

    player.unlock();
    player.unlock();

    expect(AudioContext).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it("decodes a sound once over two plays", async () => {
    const context = stubAudioContext();
    const player = createSoundPlayer();
    player.unlock();

    await player.play(SOUND);
    await player.play(SOUND);

    expect(context.decodeAudioData).toHaveBeenCalledOnce();
    expect(context.createBufferSource).toHaveBeenCalledTimes(2);
    for (const { value: source } of context.createBufferSource.mock.results) {
      expect(source.buffer).toBe(DECODED);
      expect(source.connect).toHaveBeenCalledWith(context.destination);
      expect(source.start).toHaveBeenCalledOnce();
    }
  });

  it("swallows a decode failure", async () => {
    const context = stubAudioContext({ decodeFails: true });
    const player = createSoundPlayer();
    player.unlock();

    await expect(player.play(SOUND)).resolves.toBeUndefined();

    expect(context.createBufferSource).not.toHaveBeenCalled();
  });

  it("plays nothing while the audio context is suspended", async () => {
    const context = stubAudioContext({ state: "suspended" });
    const player = createSoundPlayer();
    player.unlock();

    await player.play(SOUND);

    expect(context.createBufferSource).not.toHaveBeenCalled();
  });

  it("closes the audio context, and a later unlock creates a new one", async () => {
    const context = stubAudioContext();
    const player = createSoundPlayer();
    player.unlock();

    player.close();
    await player.play(SOUND);

    expect(context.close).toHaveBeenCalledOnce();
    expect(context.createBufferSource).not.toHaveBeenCalled();

    player.unlock();

    expect(AudioContext).toHaveBeenCalledTimes(2);
  });

  it("stays silent in a browser without Web Audio", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const player = createSoundPlayer();

    expect(() => player.unlock()).not.toThrow();
    await expect(player.play(SOUND)).resolves.toBeUndefined();
  });
});
