type Voice = {
  oscillators: OscillatorNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
};

let audioContext: AudioContext | null = null;
const voices = new Map<number, Voice>();
let beatInterval: number | null = null;
let beatBpm = 92;
let beatNextTime = 0;
const beatSteps = 16;
let beatMasterGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

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

const getBeatMasterGain = () => {
  const ctx = getContext();
  if (!beatMasterGain) {
    beatMasterGain = ctx.createGain();
    beatMasterGain.gain.setValueAtTime(0.18, ctx.currentTime);
    beatMasterGain.connect(ctx.destination);
  }
  return beatMasterGain;
};

const getNoiseBuffer = () => {
  const ctx = getContext();
  if (noiseBuffer) {
    return noiseBuffer;
  }
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
};

const scheduleKick = (time: number) => {
  const ctx = getContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(120, time);
  oscillator.frequency.exponentialRampToValueAtTime(50, time + 0.15);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.7, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
  oscillator.connect(gain).connect(getBeatMasterGain());
  oscillator.start(time);
  oscillator.stop(time + 0.21);
};

const scheduleSnare = (time: number) => {
  const ctx = getContext();
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer();
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.setValueAtTime(1200, time);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.45, time + 0.01);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

  const tone = ctx.createOscillator();
  const toneGain = ctx.createGain();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(180, time);
  toneGain.gain.setValueAtTime(0.0001, time);
  toneGain.gain.exponentialRampToValueAtTime(0.2, time + 0.01);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

  noise.connect(noiseFilter).connect(noiseGain).connect(getBeatMasterGain());
  tone.connect(toneGain).connect(getBeatMasterGain());
  noise.start(time);
  noise.stop(time + 0.2);
  tone.start(time);
  tone.stop(time + 0.18);
};

const scheduleHat = (time: number) => {
  const ctx = getContext();
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer();
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(5000, time);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.25, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
  noise.connect(filter).connect(gain).connect(getBeatMasterGain());
  noise.start(time);
  noise.stop(time + 0.09);
};

const scheduleBeat = () => {
  const ctx = getContext();
  const secondsPerBeat = 60 / beatBpm;
  const stepTime = secondsPerBeat / 4;
  const scheduleAhead = 0.12;

  while (beatNextTime < ctx.currentTime + scheduleAhead) {
    const step = Math.floor((beatNextTime / stepTime) % beatSteps);
    if (step === 0 || step === 8) {
      scheduleKick(beatNextTime);
    }
    if (step === 4 || step === 12) {
      scheduleSnare(beatNextTime);
    }
    if (step % 2 === 0) {
      scheduleHat(beatNextTime);
    }
    beatNextTime += stepTime;
  }
};

export const setBeatBpm = (bpm: number) => {
  beatBpm = Math.max(60, Math.min(140, bpm));
};

export const startBeat = () => {
  const ctx = getContext();
  if (beatInterval !== null) {
    return;
  }
  beatNextTime = ctx.currentTime + 0.05;
  beatInterval = window.setInterval(scheduleBeat, 25);
};

export const stopBeat = () => {
  if (beatInterval !== null) {
    window.clearInterval(beatInterval);
    beatInterval = null;
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
  gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.08);

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
  voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  voice.oscillators.forEach((oscillator) => {
    oscillator.stop(now + 0.16);
    oscillator.disconnect();
  });
  voice.lfo.stop(now + 0.16);
  voice.lfo.disconnect();
  voice.lfoGain.disconnect();
  voice.filter.disconnect();
  voice.gain.disconnect();
  voices.delete(id);
};

export const stopAllVoices = () => {
  Array.from(voices.keys()).forEach((id) => stopVoice(id));
};
