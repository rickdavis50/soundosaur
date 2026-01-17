export type BeatEngine = {
  start: () => void;
  stop: () => void;
  setBpm: (bpm: number) => void;
};

const createSaturationCurve = (amount: number) => {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = amount * 20;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
};

const createSaturation = (ctx: AudioContext, amount: number) => {
  const shaper = ctx.createWaveShaper();
  shaper.curve = createSaturationCurve(amount);
  shaper.oversample = "4x";
  return shaper;
};

let noiseBuffer: AudioBuffer | null = null;
const getNoiseBuffer = (ctx: AudioContext) => {
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

export const createBeatEngine = (ctx: AudioContext): BeatEngine => {
  let beatInterval: number | null = null;
  let beatNextTime = 0;
  let beatBpm = 92;
  let swing = 0.57;
  let hatDensity = 1;

  const masterInput = ctx.createGain();
  const saturation = createSaturation(ctx, 0.35);
  const masterFilter = ctx.createBiquadFilter();
  masterFilter.type = "lowpass";
  masterFilter.frequency.setValueAtTime(8500, ctx.currentTime);
  masterFilter.Q.setValueAtTime(0.2, ctx.currentTime);
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.22, ctx.currentTime);
  masterInput.connect(saturation).connect(masterFilter).connect(masterGain).connect(ctx.destination);

  const vinylFilter = ctx.createBiquadFilter();
  vinylFilter.type = "lowpass";
  vinylFilter.frequency.setValueAtTime(2500, ctx.currentTime);
  vinylFilter.Q.setValueAtTime(0.2, ctx.currentTime);
  const vinylGain = ctx.createGain();
  vinylGain.gain.setValueAtTime(0.015, ctx.currentTime);
  vinylFilter.connect(vinylGain).connect(masterGain);

  let vinylSource: AudioBufferSourceNode | null = null;

  const startVinyl = () => {
    if (vinylSource) {
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    source.loop = true;
    source.connect(vinylFilter);
    source.start();
    vinylSource = source;
  };

  const stopVinyl = () => {
    if (!vinylSource) {
      return;
    }
    vinylSource.stop();
    vinylSource.disconnect();
    vinylSource = null;
  };

  const scheduleKick = (time: number) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(140, time);
    oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.18);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.8, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    oscillator.connect(gain).connect(masterInput);
    oscillator.start(time);
    oscillator.stop(time + 0.24);

    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "square";
    clickOsc.frequency.setValueAtTime(2200, time);
    clickGain.gain.setValueAtTime(0.0001, time);
    clickGain.gain.exponentialRampToValueAtTime(0.2, time + 0.005);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    clickOsc.connect(clickGain).connect(masterInput);
    clickOsc.start(time);
    clickOsc.stop(time + 0.04);
  };

  const scheduleSnare = (time: number) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1800, time);
    noiseFilter.Q.setValueAtTime(0.7, time);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.5, time + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(210, time);
    toneGain.gain.setValueAtTime(0.0001, time);
    toneGain.gain.exponentialRampToValueAtTime(0.18, time + 0.02);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

    noise.connect(noiseFilter).connect(noiseGain).connect(masterInput);
    tone.connect(toneGain).connect(masterInput);
    noise.start(time);
    noise.stop(time + 0.22);
    tone.start(time);
    tone.stop(time + 0.2);
  };

  const scheduleHat = (time: number, open = false) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(6000, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(open ? 0.28 : 0.2, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (open ? 0.2 : 0.08));
    noise.connect(filter).connect(gain).connect(masterInput);
    noise.start(time);
    noise.stop(time + (open ? 0.22 : 0.09));
  };

  const kickSteps = new Set([0, 7, 10, 14]);
  const snareSteps = new Set([4, 12]);
  const hatSteps = new Set([0, 2, 4, 6, 8, 10, 12, 14]);
  const openHatSteps = new Set([11]);
  const extraHatSteps = new Set([3, 9, 15]);

  const scheduleBeat = () => {
    const secondsPerBeat = 60 / beatBpm;
    const stepTime = secondsPerBeat / 4;
    const scheduleAhead = 0.12;
    const swingOffset = (swing - 0.5) * stepTime * 2;

    while (beatNextTime < ctx.currentTime + scheduleAhead) {
      const step = Math.floor((beatNextTime / stepTime) % 16);
      const isSwingStep = step % 4 === 2;
      const eventTime = beatNextTime + (isSwingStep ? swingOffset : 0);

      if (kickSteps.has(step)) {
        scheduleKick(eventTime);
      }
      if (snareSteps.has(step)) {
        scheduleSnare(eventTime);
      }
      if (openHatSteps.has(step)) {
        scheduleHat(eventTime, true);
      }
      if (hatSteps.has(step) && !openHatSteps.has(step)) {
        scheduleHat(eventTime, false);
      }
      if (hatDensity > 1 && extraHatSteps.has(step)) {
        scheduleHat(eventTime, false);
      }

      beatNextTime += stepTime;
    }
  };

  const setBpm = (bpm: number) => {
    beatBpm = Math.max(70, Math.min(130, bpm));
    const ratio = (beatBpm - 70) / 60;
    swing = 0.55 + ratio * 0.05;
    hatDensity = beatBpm > 112 ? 2 : 1;
  };

  const start = () => {
    if (beatInterval !== null) {
      return;
    }
    beatNextTime = ctx.currentTime + 0.05;
    startVinyl();
    beatInterval = window.setInterval(scheduleBeat, 25);
  };

  const stop = () => {
    if (beatInterval !== null) {
      window.clearInterval(beatInterval);
      beatInterval = null;
    }
    stopVinyl();
  };

  return { start, stop, setBpm };
};
