export type ToneMode = "pure" | "binaural" | "isochronic";

export type EngineSettings = {
  mode: ToneMode;
  frequency: number;
  beatFrequency: number;
  pulseRate: number;
  volume: number;
  fadeSeconds: number;
};

type RunningNodes = {
  oscillators: OscillatorNode[];
  gain: GainNode;
  pulse?: OscillatorNode;
  pulseGain?: GainNode;
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
    await this.stop(0.02);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.connect(context.destination);

    if (this.settings.mode === "binaural") {
      this.running = this.createBinauralNodes(context, gain);
    } else if (this.settings.mode === "isochronic") {
      this.running = this.createIsochronicNodes(context, gain);
    } else {
      this.running = this.createPureNodes(context, gain);
    }

    this.running.oscillators.forEach((oscillator) => oscillator.start());
    this.running.pulse?.start();
    rampGain(gain.gain, context, this.settings.volume, this.settings.fadeSeconds);
  }

  update(settings: EngineSettings) {
    this.settings = normalizeSettings(settings);
    if (!this.context || !this.running) {
      return;
    }

    const now = this.context.currentTime;
    const { mode, frequency, beatFrequency, pulseRate, volume, fadeSeconds } = this.settings;
    const oscillators = this.running.oscillators;

    if (mode === "binaural" && oscillators.length === 2) {
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
    if (!this.context || !this.running) {
      return;
    }

    const nodes = this.running;
    this.running = null;
    const fadeSeconds = fadeOverride ?? this.settings.fadeSeconds;
    const stopAt = this.context.currentTime + Math.max(0.02, fadeSeconds);
    nodes.gain.gain.cancelScheduledValues(this.context.currentTime);
    nodes.gain.gain.setTargetAtTime(0, this.context.currentTime, Math.max(0.01, fadeSeconds / 3));

    window.setTimeout(() => {
      nodes.oscillators.forEach((oscillator) => {
        try {
          oscillator.stop();
          oscillator.disconnect();
        } catch {
          // Stopping an already-stopped oscillator is harmless.
        }
      });
      try {
        nodes.pulse?.stop();
        nodes.pulse?.disconnect();
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
    return { oscillators: [oscillator], gain };
  }

  private createBinauralNodes(context: AudioContext, gain: GainNode): RunningNodes {
    const left = createSine(context, this.settings.frequency - this.settings.beatFrequency / 2);
    const right = createSine(context, this.settings.frequency + this.settings.beatFrequency / 2);
    const merger = context.createChannelMerger(2);
    left.connect(merger, 0, 0);
    right.connect(merger, 0, 1);
    merger.connect(gain);
    return { oscillators: [left, right], gain };
  }

  private createIsochronicNodes(context: AudioContext, gain: GainNode): RunningNodes {
    const oscillator = createSine(context, this.settings.frequency);
    const pulse = createSine(context, this.settings.pulseRate);
    const pulseGain = context.createGain();
    const modulatedGain = context.createGain();

    pulseGain.gain.value = 0.35;
    modulatedGain.gain.value = 0.65;
    pulse.connect(pulseGain);
    pulseGain.connect(modulatedGain.gain);
    oscillator.connect(modulatedGain);
    modulatedGain.connect(gain);

    return { oscillators: [oscillator], gain, pulse, pulseGain };
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
