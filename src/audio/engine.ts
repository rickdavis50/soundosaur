type Voice = {
  oscillator: OscillatorNode;
  gain: GainNode;
};

let audioContext: AudioContext | null = null;
const voices = new Map<number, Voice>();

const getContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

export const resumeAudioContext = async () => {
  const ctx = getContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
};

export const startVoice = (id: number, frequency: number) => {
  const ctx = getContext();
  const existing = voices.get(id);
  if (existing) {
    return;
  }

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.04);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();

  voices.set(id, { oscillator, gain });
};

export const stopVoice = (id: number) => {
  const ctx = getContext();
  const voice = voices.get(id);
  if (!voice) {
    return;
  }

  const now = ctx.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
  voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  voice.oscillator.stop(now + 0.09);
  voice.oscillator.disconnect();
  voice.gain.disconnect();
  voices.delete(id);
};

export const stopAllVoices = () => {
  Array.from(voices.keys()).forEach((id) => stopVoice(id));
};
