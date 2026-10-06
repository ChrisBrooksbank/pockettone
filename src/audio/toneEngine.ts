export type ToneMode = "pure" | "binaural" | "isochronic" | "noise";

export type NoiseColor = "white" | "pink" | "brown" | "blue" | "violet";

export type EngineSettings = {
  mode: ToneMode;
  frequency: number;
  beatFrequency: number;
  pulseRate: number;
  noiseColor: NoiseColor;
  volume: number;
  fadeSeconds: number;
};

type RunningNodes = {
  mode: ToneMode;
  sources: AudioScheduledSourceNode[];
  oscillators: OscillatorNode[];
  gain: GainNode;
  pulse?: OscillatorNode;
  pulseGain?: GainNode;
  noiseColor?: NoiseColor;
};

const MIN_FREQUENCY = 20;
const MAX_FREQUENCY = 20000;
const MIN_BEAT = 0.5;
const MAX_BEAT = 40;

export function clampFrequency(value: number) {
  return Math.min(MAX_FREQUENCY, Math.max(MIN_FREQUENCY, value));
}

export function clampBeatFrequency(value: number) {
  return Math.min(MAX_BEAT, Math.max(MIN_BEAT, value));
}

export class ToneEngine {
  private context: AudioContext | null = null;
  private running: RunningNodes | null = null;
  private settings: EngineSettings;

  constructor(settings: EngineSettings) {
    this.settings = settings;
  }

  get isPlaying() {
    return Boolean(this.running);
  }

  async play(settings: EngineSettings) {
    this.settings = normalizeSettings(settings);
    const context = this.getContext();
    await context.resume();
    this.start(context);
  }

  update(settings: EngineSettings) {
    this.settings = normalizeSettings(settings);
    if (!this.context || !this.running) {
      return;
    }

    if (this.running.mode !== this.settings.mode) {
      // Each mode uses a different node graph, so switching modes mid-session rebuilds it.
      this.start(this.context, 0.05);
      return;
    }

    const now = this.context.currentTime;
    const { mode, frequency, beatFrequency, pulseRate, volume, fadeSeconds, noiseColor } = this.settings;
    const oscillators = this.running.oscillators;

    if (mode === "noise") {
      if (this.running.noiseColor !== noiseColor) {
        this.replaceNoiseSource(noiseColor);
      }
    } else if (mode === "binaural" && oscillators.length === 2) {
      const left = clampFrequency(frequency - beatFrequency / 2);
      const right = clampFrequency(frequency + beatFrequency / 2);
      smoothParam(oscillators[0].frequency, left, now);
      smoothParam(oscillators[1].frequency, right, now);
    } else {
      oscillators.forEach((oscillator) => smoothParam(oscillator.frequency, frequency, now));
    }

    if (this.running.pulse) {
      smoothParam(this.running.pulse.frequency, pulseRate, now);
    }

    rampGain(this.running.gain.gain, this.context, volume, fadeSeconds);
  }

  async stop(fadeOverride?: number) {
    this.release(fadeOverride ?? this.settings.fadeSeconds);
  }

  private start(context: AudioContext, fadeInOverride?: number) {
    this.release(0.02);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.connect(context.destination);

    if (this.settings.mode === "noise") {
      this.running = this.createNoiseNodes(context, gain);
    } else if (this.settings.mode === "binaural") {
      this.running = this.createBinauralNodes(context, gain);
    } else if (this.settings.mode === "isochronic") {
      this.running = this.createIsochronicNodes(context, gain);
    } else {
      this.running = this.createPureNodes(context, gain);
    }

    this.running.sources.forEach((source) => source.start());
    rampGain(gain.gain, context, this.settings.volume, fadeInOverride ?? this.settings.fadeSeconds);
  }

  private release(fadeSeconds: number) {
    if (!this.context || !this.running) {
      return;
    }

    const nodes = this.running;
    this.running = null;
    const stopAt = this.context.currentTime + Math.max(0.02, fadeSeconds);
    nodes.gain.gain.cancelScheduledValues(this.context.currentTime);
    nodes.gain.gain.setTargetAtTime(0, this.context.currentTime, Math.max(0.01, fadeSeconds / 3));

    window.setTimeout(() => {
      nodes.sources.forEach((source) => {
        try {
          source.stop();
          source.disconnect();
        } catch {
          // Stopping an already-stopped source is harmless.
        }
      });
      try {
        nodes.pulseGain?.disconnect();
        nodes.gain.disconnect();
      } catch {
        // Disconnection can race with browser audio teardown.
      }
    }, Math.max(30, (stopAt - this.context.currentTime) * 1000));
  }

  private getContext() {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }

  private createPureNodes(context: AudioContext, gain: GainNode): RunningNodes {
    const oscillator = createSine(context, this.settings.frequency);
    oscillator.connect(gain);
    return { mode: "pure", sources: [oscillator], oscillators: [oscillator], gain };
  }

  private createBinauralNodes(context: AudioContext, gain: GainNode): RunningNodes {
    const left = createSine(context, this.settings.frequency - this.settings.beatFrequency / 2);
    const right = createSine(context, this.settings.frequency + this.settings.beatFrequency / 2);
    const merger = context.createChannelMerger(2);
    left.connect(merger, 0, 0);
    right.connect(merger, 0, 1);
    merger.connect(gain);
    return { mode: "binaural", sources: [left, right], oscillators: [left, right], gain };
  }

  private createIsochronicNodes(context: AudioContext, gain: GainNode): RunningNodes {
    const oscillator = createSine(context, this.settings.frequency);
    // The pulse is a sub-audio LFO, so it must bypass the audible-range clamp in createSine.
    const pulse = context.createOscillator();
    pulse.type = "sine";
    pulse.frequency.value = this.settings.pulseRate;
    const pulseGain = context.createGain();
    const modulatedGain = context.createGain();

    pulseGain.gain.value = 0.35;
    modulatedGain.gain.value = 0.65;
    pulse.connect(pulseGain);
    pulseGain.connect(modulatedGain.gain);
    oscillator.connect(modulatedGain);
    modulatedGain.connect(gain);

    return { mode: "isochronic", sources: [oscillator, pulse], oscillators: [oscillator], gain, pulse, pulseGain };
  }

  private createNoiseNodes(context: AudioContext, gain: GainNode): RunningNodes {
    const source = createNoiseSource(context, this.settings.noiseColor);
    source.connect(gain);
    return { mode: "noise", sources: [source], oscillators: [], gain, noiseColor: this.settings.noiseColor };
  }

  private replaceNoiseSource(noiseColor: NoiseColor) {
    if (!this.context || !this.running) {
      return;
    }

    this.running.sources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Noise source may already be stopped while switching colors.
      }
    });

    const source = createNoiseSource(this.context, noiseColor);
    source.connect(this.running.gain);
    source.start();
    this.running.sources = [source];
    this.running.noiseColor = noiseColor;
  }
}

function createSine(context: AudioContext, frequency: number) {
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.value = clampFrequency(frequency);
  return oscillator;
}

function normalizeSettings(settings: EngineSettings): EngineSettings {
  return {
    ...settings,
    frequency: clampFrequency(settings.frequency),
    beatFrequency: clampBeatFrequency(settings.beatFrequency),
    pulseRate: clampBeatFrequency(settings.pulseRate),
    noiseColor: settings.noiseColor,
    volume: Math.min(1, Math.max(0, settings.volume)),
    fadeSeconds: Math.max(0, settings.fadeSeconds),
  };
}

function smoothParam(param: AudioParam, value: number, now: number) {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, 0.035);
}

function rampGain(param: AudioParam, context: AudioContext, value: number, fadeSeconds: number) {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, Math.max(0.01, fadeSeconds / 3));
}

function createNoiseSource(context: AudioContext, color: NoiseColor) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  fillNoiseBuffer(data, color);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function fillNoiseBuffer(data: Float32Array, color: NoiseColor) {
  let previousWhite = 0;
  let previousBlue = 0;
  let brown = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let max = 0;

  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    let sample = white;

    if (color === "pink") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      sample = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    } else if (color === "brown") {
      brown = (brown + 0.02 * white) / 1.02;
      sample = brown * 3.5;
    } else if (color === "blue") {
      sample = white - previousWhite;
      previousWhite = white;
    } else if (color === "violet") {
      const blue = white - previousWhite;
      sample = blue - previousBlue;
      previousWhite = white;
      previousBlue = blue;
    }

    data[index] = sample;
    max = Math.max(max, Math.abs(sample));
  }

  const scale = max > 0 ? 0.85 / max : 1;
  for (let index = 0; index < data.length; index += 1) {
    data[index] *= scale;
  }
}
