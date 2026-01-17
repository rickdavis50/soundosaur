type Chorus = {
  input: GainNode;
  output: GainNode;
  lfos: OscillatorNode[];
};

type ReverbBus = {
  input: GainNode;
  output: GainNode;
};

export type StringsBus = {
  input: GainNode;
  reverbInput: GainNode;
  output: GainNode;
};

export type OrchestralVoice = {
  stop: (releaseSeconds?: number) => void;
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

const createChorus = (ctx: AudioContext): Chorus => {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  dry.gain.setValueAtTime(0.9, ctx.currentTime);
  wet.gain.setValueAtTime(0.12, ctx.currentTime);

  const delayLeft = ctx.createDelay(0.05);
  const delayRight = ctx.createDelay(0.05);
  delayLeft.delayTime.setValueAtTime(0.012, ctx.currentTime);
  delayRight.delayTime.setValueAtTime(0.015, ctx.currentTime);

  const lfoLeft = ctx.createOscillator();
  const lfoRight = ctx.createOscillator();
  const lfoGainLeft = ctx.createGain();
  const lfoGainRight = ctx.createGain();
  lfoLeft.frequency.setValueAtTime(0.25, ctx.currentTime);
  lfoRight.frequency.setValueAtTime(0.33, ctx.currentTime);
  lfoGainLeft.gain.setValueAtTime(0.002, ctx.currentTime);
  lfoGainRight.gain.setValueAtTime(0.002, ctx.currentTime);
  lfoLeft.connect(lfoGainLeft).connect(delayLeft.delayTime);
  lfoRight.connect(lfoGainRight).connect(delayRight.delayTime);
  lfoLeft.start();
  lfoRight.start();

  const panLeft = ctx.createStereoPanner();
  const panRight = ctx.createStereoPanner();
  panLeft.pan.setValueAtTime(-0.2, ctx.currentTime);
  panRight.pan.setValueAtTime(0.2, ctx.currentTime);

  input.connect(dry).connect(output);
  input.connect(delayLeft).connect(panLeft).connect(wet).connect(output);
  input.connect(delayRight).connect(panRight).connect(wet).connect(output);

  return { input, output, lfos: [lfoLeft, lfoRight] };
};

const createReverb = (ctx: AudioContext): ReverbBus => {
  const input = ctx.createGain();
  const output = ctx.createGain();
  output.gain.setValueAtTime(0.45, ctx.currentTime);

  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.setValueAtTime(3200, ctx.currentTime);
  tone.Q.setValueAtTime(0.2, ctx.currentTime);
  input.connect(tone);

  const taps = [0.07, 0.11, 0.16, 0.22];
  const gains = [0.42, 0.34, 0.26, 0.18];

  taps.forEach((time, index) => {
    const delay = ctx.createDelay(0.3);
    const gain = ctx.createGain();
    delay.delayTime.setValueAtTime(time, ctx.currentTime);
    gain.gain.setValueAtTime(gains[index], ctx.currentTime);
    tone.connect(delay);
    delay.connect(gain).connect(output);

    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.25, ctx.currentTime);
    delay.connect(feedback).connect(delay);
  });

  return { input, output };
};

export const createStringsBus = (ctx: AudioContext): StringsBus => {
  const input = ctx.createGain();
  const reverbInput = ctx.createGain();
  const output = ctx.createGain();
  output.gain.setValueAtTime(0.95, ctx.currentTime);

  const chorus = createChorus(ctx);
  input.connect(chorus.input);
  chorus.output.connect(output);

  const reverb = createReverb(ctx);
  reverbInput.connect(reverb.input);
  reverb.output.connect(output);

  return { input, reverbInput, output };
};

export const createOrchestralStringsVoice = (
  ctx: AudioContext,
  frequencies: number[],
  bus: StringsBus
): OrchestralVoice => {
  const startTime = ctx.currentTime;
  const attack = 0.12;
  const decay = 0.18;
  const sustain = 0.55;
  const release = 0.35;

  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0.0001, startTime);
  voiceGain.gain.exponentialRampToValueAtTime(0.6, startTime + attack);
  voiceGain.gain.exponentialRampToValueAtTime(sustain, startTime + attack + decay);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.05, startTime + attack);
  noiseGain.gain.exponentialRampToValueAtTime(0.02, startTime + attack + decay);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, startTime);
  filter.frequency.exponentialRampToValueAtTime(2200, startTime + attack);
  filter.frequency.exponentialRampToValueAtTime(1300, startTime + attack + 0.35);
  filter.Q.setValueAtTime(0.7, startTime);

  const saturation = createSaturation(ctx, 0.12);

  const output = ctx.createGain();
  output.gain.setValueAtTime(1, startTime);

  const reverbSend = ctx.createGain();
  reverbSend.gain.setValueAtTime(0.18, startTime);

  const oscillators: OscillatorNode[] = [];
  frequencies.forEach((frequency) => {
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = "sawtooth";
    oscB.type = "sawtooth";
    oscA.frequency.setValueAtTime(frequency, startTime);
    oscB.frequency.setValueAtTime(frequency, startTime);
    oscA.detune.setValueAtTime(-4, startTime);
    oscB.detune.setValueAtTime(4, startTime);
    oscA.connect(filter);
    oscB.connect(filter);
    oscA.start();
    oscB.start();
    oscillators.push(oscA, oscB);
  });

  const subOsc = ctx.createOscillator();
  subOsc.type = "triangle";
  subOsc.frequency.setValueAtTime(frequencies[0] / 2, startTime);
  subOsc.detune.setValueAtTime(-2, startTime);
  subOsc.connect(filter);
  subOsc.start();
  oscillators.push(subOsc);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  noise.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(1800, startTime);
  noiseFilter.Q.setValueAtTime(0.9, startTime);
  noise.connect(noiseFilter).connect(noiseGain).connect(filter);
  noise.start();

  filter.connect(saturation).connect(voiceGain).connect(output);
  output.connect(bus.input);
  output.connect(reverbSend).connect(bus.reverbInput);

  const stop = (releaseSeconds = release) => {
    const now = ctx.currentTime;
    const endTime = now + releaseSeconds;
    voiceGain.gain.cancelScheduledValues(now);
    noiseGain.gain.cancelScheduledValues(now);
    voiceGain.gain.setValueAtTime(Math.max(voiceGain.gain.value, 0.0001), now);
    noiseGain.gain.setValueAtTime(Math.max(noiseGain.gain.value, 0.0001), now);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillators.forEach((oscillator) => {
      oscillator.stop(endTime + 0.08);
      oscillator.disconnect();
    });
    noise.stop(endTime + 0.08);
    noise.disconnect();
    noiseFilter.disconnect();
    filter.disconnect();
    saturation.disconnect();
    voiceGain.disconnect();
    output.disconnect();
    reverbSend.disconnect();
  };

  return { stop };
};
