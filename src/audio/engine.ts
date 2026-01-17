type Voice = {
  oscillators: OscillatorNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
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

export const startVoice = (id: number, frequencies: number[]) => {
  const ctx = getContext();
  const existing = voices.get(id);
  if (existing) {
    return;
  }

  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, ctx.currentTime);
  filter.Q.setValueAtTime(0.9, ctx.currentTime);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.06);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.45, ctx.currentTime);
  lfoGain.gain.setValueAtTime(650, ctx.currentTime);
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  const oscillators = frequencies.map((frequency) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.detune.setValueAtTime((Math.random() - 0.5) * 10, ctx.currentTime);
    oscillator.connect(filter);
    oscillator.start();
    return oscillator;
  });

  filter.connect(gain).connect(ctx.destination);

  voices.set(id, { oscillators, gain, filter, lfo, lfoGain });
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

  voice.oscillators.forEach((oscillator) => {
    oscillator.stop(now + 0.12);
    oscillator.disconnect();
  });
  voice.lfo.stop(now + 0.12);
  voice.lfo.disconnect();
  voice.lfoGain.disconnect();
  voice.filter.disconnect();
  voice.gain.disconnect();
  voices.delete(id);
};

export const stopAllVoices = () => {
  Array.from(voices.keys()).forEach((id) => stopVoice(id));
};
