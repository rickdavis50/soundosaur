import { createBeatEngine, type BeatEngine } from "./beat";
import {
  createOrchestralStringsVoice,
  createStringsBus,
  type OrchestralVoice,
  type StringsBus,
} from "./instruments/orchestralStrings";

type ActiveVoice = {
  id: number;
  startedAt: number;
  voice: OrchestralVoice;
};

let audioContext: AudioContext | null = null;
let beatEngine: BeatEngine | null = null;
let stringsBus: StringsBus | null = null;
const activeVoices = new Map<number, ActiveVoice>();
const MAX_VOICES = 8;

const getContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

const getBeatEngine = () => {
  const ctx = getContext();
  if (!beatEngine) {
    beatEngine = createBeatEngine(ctx);
  }
  return beatEngine;
};

const getStringsBus = () => {
  const ctx = getContext();
  if (!stringsBus) {
    stringsBus = createStringsBus(ctx);
    stringsBus.output.connect(ctx.destination);
  }
  return stringsBus;
};

export const resumeAudioContext = async () => {
  const ctx = getContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
};

export const setBeatBpm = (bpm: number) => {
  getBeatEngine().setBpm(bpm);
};

export const startBeat = () => {
  getBeatEngine().start();
};

export const stopBeat = () => {
  beatEngine?.stop();
};

const stealOldestVoice = () => {
  let oldestId: number | null = null;
  let oldestTime = Number.POSITIVE_INFINITY;
  activeVoices.forEach((voice, key) => {
    if (voice.startedAt < oldestTime) {
      oldestTime = voice.startedAt;
      oldestId = key;
    }
  });
  if (oldestId !== null) {
    const entry = activeVoices.get(oldestId);
    if (entry) {
      entry.voice.stop(0.18);
      activeVoices.delete(oldestId);
    }
  }
};

export const startVoice = (id: number, frequencies: number[]) => {
  const ctx = getContext();
  if (activeVoices.has(id)) {
    return;
  }
  if (activeVoices.size >= MAX_VOICES) {
    stealOldestVoice();
  }
  const voice = createOrchestralStringsVoice(ctx, frequencies, getStringsBus());
  activeVoices.set(id, { id, startedAt: ctx.currentTime, voice });
};

export const stopVoice = (id: number) => {
  const entry = activeVoices.get(id);
  if (!entry) {
    return;
  }
  entry.voice.stop();
  activeVoices.delete(id);
};

export const stopAllVoices = () => {
  Array.from(activeVoices.keys()).forEach((id) => stopVoice(id));
};
