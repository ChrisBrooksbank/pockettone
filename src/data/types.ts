import type { ToneMode } from "../audio/toneEngine";

export type UserNeed = "sleep" | "settle" | "meditation" | "focus" | "test";

export type OutputMode = "earbuds" | "speaker" | "phone";

export type Preset = {
  id: string;
  label: string;
  mode: ToneMode;
  frequency: number;
  beatFrequency?: number;
  pulseRate?: number;
  intent: UserNeed;
  note: string;
  caution?: string;
};

export type Recommendation = {
  id: string;
  need: UserNeed;
  presetId: string;
  title: string;
  rationale: string;
  caution?: string;
  defaultTimerMinutes?: number;
};

export type SessionSettings = {
  selectedNeed: UserNeed;
  mode: ToneMode;
  frequency: number;
  beatFrequency: number;
  pulseRate: number;
  volume: number;
  timerMinutes: number | null;
  fadeSeconds: 0 | 3 | 10 | 30;
  outputMode: OutputMode;
  hapticsEnabled: boolean;
};
