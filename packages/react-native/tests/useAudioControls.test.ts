import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioControls } from "../src/hooks/useAudioControls.js";
import type { AudioPlayer } from "../src/audio/player.js";
import type { AudioRecorder } from "../src/audio/recorder.js";

function setup(
  player: AudioPlayer | null = null,
  recorder: AudioRecorder | null = null
) {
  const playerRef = { current: player };
  const recorderRef = { current: recorder };
  return renderHook(() => useAudioControls(playerRef, recorderRef));
}

describe("useAudioControls", () => {
  it("defaults: isMicMuted=false, isAudioMuted=false, volume=1", () => {
    const { result } = setup();

    expect(result.current.isMicMuted).toBe(false);
    expect(result.current.isAudioMuted).toBe(false);
    expect(result.current.volume).toBe(1);
  });

  it("setVolume(0.5) updates state and calls player.setVolume(0.5)", () => {
    const player = { setVolume: vi.fn() } as unknown as AudioPlayer;
    const { result } = setup(player);

    act(() => result.current.setVolume(0.5));

    expect(result.current.volume).toBe(0.5);
    expect(result.current.isAudioMuted).toBe(false);
    expect(player.setVolume).toHaveBeenCalledWith(0.5);
  });

  it("setVolume(-0.5) clamps to 0", () => {
    const player = { setVolume: vi.fn() } as unknown as AudioPlayer;
    const { result } = setup(player);

    act(() => result.current.setVolume(-0.5));

    expect(result.current.volume).toBe(0);
    expect(result.current.isAudioMuted).toBe(true);
    expect(player.setVolume).toHaveBeenCalledWith(0);
  });

  it("setVolume(1.5) clamps to 1", () => {
    const player = { setVolume: vi.fn() } as unknown as AudioPlayer;
    const { result } = setup(player);

    act(() => result.current.setVolume(1.5));

    expect(result.current.volume).toBe(1);
    expect(player.setVolume).toHaveBeenCalledWith(1);
  });

  it("setVolume with null playerRef does not throw", () => {
    const { result } = setup(null);

    expect(() => {
      act(() => result.current.setVolume(0.5));
    }).not.toThrow();

    expect(result.current.volume).toBe(0.5);
  });

  it("setVolume(0) sets isAudioMuted to true", () => {
    const player = { setVolume: vi.fn() } as unknown as AudioPlayer;
    const { result } = setup(player);

    act(() => result.current.setVolume(0));

    expect(result.current.isAudioMuted).toBe(true);
    expect(result.current.volume).toBe(0);
  });

  it("toggleMic flips isMicMuted and calls recorder.setMuted", () => {
    const recorder = { setMuted: vi.fn() } as unknown as AudioRecorder;
    const { result } = setup(null, recorder);

    expect(result.current.isMicMuted).toBe(false);

    act(() => result.current.toggleMic());

    expect(result.current.isMicMuted).toBe(true);
    expect(recorder.setMuted).toHaveBeenCalledWith(true);

    act(() => result.current.toggleMic());

    expect(result.current.isMicMuted).toBe(false);
    expect(recorder.setMuted).toHaveBeenCalledWith(false);
  });

  it("toggleMic with null recorderRef does not throw", () => {
    const { result } = setup(null, null);

    expect(() => {
      act(() => result.current.toggleMic());
    }).not.toThrow();

    expect(result.current.isMicMuted).toBe(true);
  });

  it("toggleAudio mutes and restores volume", () => {
    const player = { setVolume: vi.fn() } as unknown as AudioPlayer;
    const { result } = setup(player);

    act(() => result.current.setVolume(0.7));

    act(() => result.current.toggleAudio());

    expect(result.current.isAudioMuted).toBe(true);
    expect(result.current.volume).toBe(0);
    expect(player.setVolume).toHaveBeenCalledWith(0);

    act(() => result.current.toggleAudio());

    expect(result.current.isAudioMuted).toBe(false);
    expect(result.current.volume).toBe(0.7);
    expect(player.setVolume).toHaveBeenCalledWith(0.7);
  });

  it("toggleAudio with null playerRef does not throw", () => {
    const { result } = setup(null);

    expect(() => {
      act(() => result.current.toggleAudio());
    }).not.toThrow();

    expect(result.current.isAudioMuted).toBe(true);
    expect(result.current.volume).toBe(0);
  });

  it("toggleAudio restores to 1 when previous volume was default", () => {
    const player = { setVolume: vi.fn() } as unknown as AudioPlayer;
    const { result } = setup(player);

    act(() => result.current.toggleAudio());

    expect(result.current.isAudioMuted).toBe(true);
    expect(result.current.volume).toBe(0);

    act(() => result.current.toggleAudio());

    expect(result.current.isAudioMuted).toBe(false);
    expect(result.current.volume).toBe(1);
  });
});
