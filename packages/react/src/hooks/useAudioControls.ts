import { useState, useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import type { AudioPlayer } from "../audio/player.js";
import type { AudioRecorder } from "../audio/recorder.js";

export interface UseAudioControlsReturn {
  isMicMuted: boolean;
  isAudioMuted: boolean;
  volume: number;
  toggleMic: () => void;
  toggleAudio: () => void;
  setVolume: (volume: number) => void;
}

export function useAudioControls(
  playerRef: MutableRefObject<AudioPlayer | null>,
  recorderRef: MutableRefObject<AudioRecorder | null>,
  startMuted = false,
): UseAudioControlsReturn {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [volume, setVolumeState] = useState(startMuted ? 0 : 1);
  const previousVolumeRef = useRef(1);
  const isAudioMuted = volume === 0;

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setVolumeState(clamped);
      if (clamped > 0) {
        previousVolumeRef.current = clamped;
      }
      if (playerRef.current) {
        playerRef.current.setVolume(clamped);
      }
    },
    [playerRef],
  );

  const toggleMic = useCallback(() => {
    setIsMicMuted((prev) => {
      const newState = !prev;
      if (recorderRef.current) {
        recorderRef.current.setMuted(newState);
      }
      return newState;
    });
  }, [recorderRef]);

  const toggleAudio = useCallback(() => {
    if (isAudioMuted) {
      setVolume(previousVolumeRef.current || 1);
    } else {
      setVolume(0);
    }
  }, [isAudioMuted, setVolume]);

  return {
    isMicMuted,
    isAudioMuted,
    volume,
    toggleMic,
    toggleAudio,
    setVolume,
  };
}
