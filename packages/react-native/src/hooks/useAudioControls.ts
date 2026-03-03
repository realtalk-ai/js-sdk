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
  recorderRef: MutableRefObject<AudioRecorder | null>
): UseAudioControlsReturn {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const previousVolumeRef = useRef(1);

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setVolumeState(clamped);
      setIsAudioMuted(clamped === 0);
      if (clamped > 0) {
        previousVolumeRef.current = clamped;
      }
      if (playerRef.current) {
        playerRef.current.setVolume(clamped);
      }
    },
    [playerRef]
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
    setIsAudioMuted((prev) => {
      if (prev) {
        const restored = previousVolumeRef.current || 1;
        setVolumeState(restored);
        if (playerRef.current) {
          playerRef.current.setVolume(restored);
        }
        return false;
      } else {
        previousVolumeRef.current = volume || 1;
        setVolumeState(0);
        if (playerRef.current) {
          playerRef.current.setVolume(0);
        }
        return true;
      }
    });
  }, [playerRef, volume]);

  return {
    isMicMuted,
    isAudioMuted,
    volume,
    toggleMic,
    toggleAudio,
    setVolume,
  };
}
