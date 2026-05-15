import type { UserNeed } from "./types";

export const needs: Array<{
  id: UserNeed;
  label: string;
  prompt: string;
}> = [
  {
    id: "sleep",
    label: "Sleep",
    prompt: "Low volume, slow fades, and quieter tones for winding down.",
  },
  {
    id: "settle",
    label: "Settle",
    prompt: "Steady sounds for decompressing without needing to think much.",
  },
  {
    id: "meditation",
    label: "Meditate",
    prompt: "Simple tones that can sit behind breath or body awareness.",
  },
  {
    id: "focus",
    label: "Focus",
    prompt: "Clean reference tones and headphone-only binaural options.",
  },
  {
    id: "test",
    label: "Test audio",
    prompt: "Practical tones for checking earbuds, speakers, and volume.",
  },
];
