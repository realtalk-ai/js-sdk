import { NativeModules, NativeEventEmitter, Platform } from "react-native";
import { pcmToBase64, base64ToPcm, ValidationError } from "@realtalk-ai/core";

interface RealTalkAudioModule {
  initialize(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<void>;
  playAudio(base64: string): Promise<void>;
  stopPlayback(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  tearDown(): Promise<void>;
}

const RealTalkAudio = NativeModules.RealTalkAudio as RealTalkAudioModule;

if (!RealTalkAudio) {
  throw new ValidationError(
    "RealTalkAudio native module not found. Make sure you've rebuilt the native project."
  );
}

const emitter = new NativeEventEmitter(NativeModules.RealTalkAudio);

export async function initialize(): Promise<void> {
  return RealTalkAudio.initialize();
}

export async function startRecording(): Promise<void> {
  return RealTalkAudio.startRecording();
}

export async function stopRecording(): Promise<void> {
  return RealTalkAudio.stopRecording();
}

export async function playAudio(pcm: Int16Array): Promise<void> {
  const base64 = pcmToBase64(pcm);
  return RealTalkAudio.playAudio(base64);
}

export async function stopPlayback(): Promise<void> {
  return RealTalkAudio.stopPlayback();
}

export async function setVolume(volume: number): Promise<void> {
  return RealTalkAudio.setVolume(volume);
}

export async function setMuted(muted: boolean): Promise<void> {
  return RealTalkAudio.setMuted(muted);
}

export async function tearDown(): Promise<void> {
  return RealTalkAudio.tearDown();
}

interface MicrophoneDataEvent {
  data: string;
}

export function onMicrophoneData(
  callback: (pcm: Int16Array) => void
): () => void {
  const subscription = emitter.addListener(
    "onMicrophoneData",
    (event: MicrophoneDataEvent) => {
      const pcm = base64ToPcm(event.data);
      callback(pcm);
    }
  );
  return () => subscription.remove();
}
