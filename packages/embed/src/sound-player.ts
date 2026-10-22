// Sounds are decoded from bytes, never loaded from a data: URL, so a host
// page's Content-Security-Policy cannot block them. Every failure is silent.

export interface SoundPlayer {
  // Call inside the visitor's own gesture: Safari only starts audio there.
  unlock: () => void;
  // Caches each decode by array identity, so pass the same array each time.
  play: (sound: Uint8Array) => Promise<void>;
  close: () => void;
}

export function createSoundPlayer(): SoundPlayer {
  let context: AudioContext | null = null;
  const decodedSounds = new Map<Uint8Array, Promise<AudioBuffer | null>>();

  function decode(
    audioContext: AudioContext,
    sound: Uint8Array,
  ): Promise<AudioBuffer | null> {
    let decoded = decodedSounds.get(sound);
    if (!decoded) {
      // decodeAudioData detaches the buffer it is given, so it gets a copy and
      // the sound stays playable by the next player.
      decoded = audioContext
        .decodeAudioData(sound.slice().buffer)
        .catch(() => null);
      decodedSounds.set(sound, decoded);
    }
    return decoded;
  }

  return {
    unlock() {
      if (!context) {
        try {
          context = new AudioContext();
        } catch {
          return;
        }
      }
      context.resume().catch(() => {});
    },

    async play(sound) {
      const audioContext = context;
      if (!audioContext) {
        return;
      }
      try {
        const buffer = await decode(audioContext, sound);
        // A suspended context would hold the sound and play it late, whenever
        // something resumes it.
        if (!buffer || audioContext.state !== "running") {
          return;
        }
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
      } catch {}
    },

    close() {
      context?.close().catch(() => {});
      context = null;
    },
  };
}
