import { Platform, PermissionsAndroid } from "react-native";
import { ValidationError } from "@realtalk-ai/core";
import * as AudioEngine from "../native/AudioEngineModule.js";

const CHUNK_SIZE = 320;

export class AudioRecorder {
  private buffer: number[] = [];
  private onAudioData: ((pcm: Int16Array) => void) | null = null;
  private muted = false;
  private running = false;
  private unsubscribeMic: (() => void) | null = null;

  async start(onAudioData: (pcm: Int16Array) => void): Promise<void> {
    this.onAudioData = onAudioData;

    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new ValidationError("Microphone permission not granted");
      }
    }

    this.unsubscribeMic = AudioEngine.onMicrophoneData((pcm: Int16Array) => {
      this.handleAudioData(pcm);
    });

    await AudioEngine.startRecording();
    this.running = true;
  }

  stop(): void {
    if (this.running) {
      AudioEngine.stopRecording();
      this.running = false;
    }

    if (this.unsubscribeMic) {
      this.unsubscribeMic();
      this.unsubscribeMic = null;
    }

    this.buffer = [];
    this.onAudioData = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    AudioEngine.setMuted(muted);
  }

  private handleAudioData(int16: Int16Array): void {
    if (this.muted) {
      for (let i = 0; i < int16.length; i++) {
        this.buffer.push(0);
      }
    } else {
      for (let i = 0; i < int16.length; i++) {
        this.buffer.push(int16[i]);
      }
    }

    while (this.buffer.length >= CHUNK_SIZE) {
      const chunk = this.buffer.splice(0, CHUNK_SIZE);
      const int16Data = new Int16Array(chunk);
      this.onAudioData?.(int16Data);
    }
  }
}
