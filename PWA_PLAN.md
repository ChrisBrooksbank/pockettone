# PocketTone PWA Plan

## Product intent

PocketTone is a tiny, installable tone generator for meditation, sleep, grounding, and audio testing. The first version should feel calm and immediate: open the app, tap a labelled preset such as `432 Hz - Calm`, hear a real-time pure sine wave, and adjust frequency, volume, timer, and output guidance without clutter.

The app should avoid medical claims. Copy should describe tones as relaxation or focus aids, not treatments. Include a brief listening safety note: start low, avoid painful volumes, and do not use tones while driving or in situations needing full attention.

## Competitive research

The current market has three broad clusters:

| Competitor | What they do well | Gaps PocketTone can improve |
| --- | --- | --- |
| [Freqence](https://www.freqence.com/) | Browser-based pure sine tones, phase-aligned multi-frequency playback, stereo placement, WAV export. | More creator/audio-tool oriented than sleep/meditation oriented; not focused on tactile mobile use or bedtime ergonomics. |
| [ToneMaker](https://tonemaker.app/) | Simple web tone generator with quick presets, waveform choices, dual tone mode, timer, fade-in. | Broader utility tone tool; experience is control-heavy and less ritual-like for sleep/meditation. |
| [Online Tone Generator](https://onlinetonegenerator.com/) and [OnlineToneGen](https://onlinetonegen.com/) | Familiar frequency controls, waveform options, simple play/stop model. | Dated/general utility feel; little PWA, offline, haptic, or mobile-first care. |
| [FrequencyZen](https://www.onlinefrequencygenerator.xyz/) | Sound-healing framing, solfeggio frequencies, binaural beats. | SEO-heavy and broad; opportunity for a more trustworthy, restrained, high-quality interface. |
| [PureBinaural](https://purebinaural.com/) | Strong binaural-beat positioning for sleep/focus, Web Audio API real-time generation, headphone guidance. | Headphone-specific binaural framing; PocketTone can start with universal single-frequency tones for earbuds, external speakers, and phone speakers. |
| [Lamda Hz](https://apps.apple.com/us/app/lamda-hz-frequency-portal/id6747421302) | Polished wellness app positioning, calm/focus/sleep programs, immersive scenes, subscription model. | App-store friction and monetization; PocketTone can be free/simple/open, installable from the web, offline-first, and transparent. |

Recent Reddit discussion also shows demand for a no-ads, no-subscription 432 Hz app: users complain that something as basic as a frequency tone is often wrapped in subscriptions or unnecessary purchases. PocketTone should lean into that: fast, free, private, no tracking, no account, works offline.

## Technical foundation

Use a static Vite app deployed on Netlify.

- Framework: React + TypeScript + Vite, or vanilla TypeScript if the UI remains small.
- Audio: Web Audio API with `AudioContext`, `OscillatorNode`, `GainNode`, `ChannelMergerNode`, and `StereoPannerNode` where supported.
- Core tone: single real-time `sine` oscillator by default. MDN documents `OscillatorNode.frequency` in hertz and built-in waveform types including `sine`.
- Binaural beats: optional headphone-only mode using two sine oscillators, one routed left and one routed right, with a small beat-frequency offset.
- Isochronic pulse: later optional mode using a single carrier tone with amplitude pulsing, useful because it can work over speakers without stereo separation.
- Volume: gain ramping with short fade-in/fade-out to prevent clicks.
- PWA: web app manifest, service worker, cached app shell, offline use after first load. MDN notes installable PWAs use a manifest and commonly use service workers for offline capability.
- Haptics: browser Vibration API via `navigator.vibrate()` for play/stop, preset selection, and timer completion. MDN notes unsupported devices simply do nothing, so haptics should be progressive enhancement.
- Deployment: Netlify static build with `npm run build` and `dist` publish directory, matching Netlify's Vite guidance.

## Differentiated user experience

1. Start screen is the working instrument, not a landing page.
2. Presets are labelled by intent, not just numbers:
   - `432 Hz - Calm`
   - `528 Hz - Unwind`
   - `396 Hz - Release`
   - `174 Hz - Deep Rest`
   - `285 Hz - Reset`
   - `40 Hz - Focus`
   - `440 Hz - Reference`
   - `1 kHz - Test Tone`
3. Custom frequency accepts decimals, clamps to a safe audible range, and explains when a low frequency may be felt more than heard.
4. Large play/stop control with tactile haptic response.
5. Sleep-friendly timer: 5, 10, 20, 30, 45, 60 minutes, plus custom.
6. Smooth fade-in/fade-out options: off, 3s, 10s, 30s.
7. Mode switch keeps the app honest and uncluttered:
   - Pure Tone: default, works through earbuds, speakers, or phone speaker.
   - Binaural Beat: optional, requires earbuds/headphones for the intended effect.
   - Isochronic Pulse: marked as planned/later, speaker-friendly but more noticeable.
8. Output mode guidance:
   - Earbuds: best isolation, use lower volume.
   - External speaker: ambient room tone.
   - Phone speaker: convenient, limited bass response.
9. Offline-first and private: no login, no analytics by default, no network after install except app updates.
10. Accessibility: full keyboard support, large touch targets, reduced-motion support, clear contrast, ARIA status for playback.
11. Responsible claims: relaxation/ritual language, not medical treatment language.

## MVP scope

- Installable PWA with manifest icons, theme color, service worker, and offline shell.
- Pure tone mode with one sine oscillator, frequency, volume, and timer controls.
- Binaural beat mode with carrier frequency, beat frequency, volume, timer, and headphone guidance.
- Labelled preset grid plus custom frequency input.
- Real-time frequency and beat adjustment while playing.
- Fade-in/fade-out to avoid pops.
- Haptic feedback where available.
- Local persistence of last mode, frequency, beat frequency, volume, fade, timer, and preferred output mode.
- Basic safety/about panel.
- Netlify configuration.

## Later enhancements

- Gentle visualizer using the same oscillator state, with reduced-motion fallback.
- Favorite presets and named custom tones.
- Optional ambient layer such as brown noise or rain, clearly separate from pure-tone mode.
- Isochronic pulse mode with carrier frequency, pulse rate, depth, and softened pulse shapes.
- Tone sweep and interval sessions.
- Shareable preset URLs, e.g. `/tone/432`.
- Wake Lock API option for active sessions, with clear battery warning.
- Export short WAV clips only if user demand appears; this is not core to the meditation/sleep experience.

## Architecture

Suggested structure:

```text
src/
  audio/
    toneEngine.ts        # AudioContext, shared routing, gain ramps
    pureTone.ts          # Single oscillator mode
    binauralBeat.ts      # Dual oscillator stereo mode
    isochronicPulse.ts   # Planned pulsed-amplitude mode
  components/
    Player.tsx
    ModeTabs.tsx
    PresetGrid.tsx
    FrequencyInput.tsx
    BeatInput.tsx
    TimerControl.tsx
    OutputMode.tsx
    SafetyPanel.tsx
  data/
    presets.ts
  hooks/
    usePersistentState.ts
    useHaptics.ts
  pwa/
    registerServiceWorker.ts
```

Core audio lifecycle:

1. Create/resume `AudioContext` only after a user gesture.
2. On play in Pure Tone mode, create `OscillatorNode`, set `type = "sine"`, set frequency, connect to `GainNode`, then destination.
3. On play in Binaural Beat mode, create two `OscillatorNode`s and route them as separate left/right channels. If carrier is `432 Hz` and beat frequency is `6 Hz`, use `429 Hz` left and `435 Hz` right, or use a clearly documented alternative such as carrier-left plus offset-right.
4. For Binaural Beat mode, show headphone guidance before playback and keep phone/external speaker output available only as ordinary stereo audio, not as the intended binaural effect.
5. For future Isochronic Pulse mode, use a single carrier oscillator and modulate gain at the selected pulse rate with smoothed gain curves to avoid harsh clicks.
6. Start with gain at `0`, ramp to selected volume over fade duration.
7. On frequency changes, use `setTargetAtTime` or short linear ramp to avoid abrupt artifacts.
8. On stop/timer, ramp gain to `0`, then stop/disconnect the oscillator.
9. Suspend or close the audio context when idle.

## Data model

```ts
type Preset = {
  id: string;
  label: string;
  mode: "pure" | "binaural" | "isochronic";
  frequency: number;
  beatFrequency?: number;
  pulseRate?: number;
  intent: "sleep" | "meditation" | "focus" | "test";
  note: string;
};

type SessionSettings = {
  mode: "pure" | "binaural" | "isochronic";
  frequency: number;
  beatFrequency: number;
  pulseRate: number;
  volume: number;
  timerMinutes: number | null;
  fadeSeconds: 0 | 3 | 10 | 30;
  outputMode: "earbuds" | "speaker" | "phone";
  hapticsEnabled: boolean;
};
```

## Netlify deployment plan

- Add `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/manifest.webmanifest"
  [headers.values]
    Content-Type = "application/manifest+json"
```

- Use Netlify continuous deployment from GitHub.
- Build command: `npm run build`.
- Publish directory: `dist`.
- No server functions are needed for the MVP.
- Keep the app static so it remains cheap, fast, and reliable.

## Testing checklist

- Unit-test frequency validation, beat-frequency validation, timer behavior, preset data, and persistence.
- Browser-test play/stop, frequency changes, and binaural channel routing with a mocked or integration-tested Web Audio layer.
- PWA checks with Lighthouse: installable, offline, manifest, service worker.
- Mobile checks on iOS Safari and Android Chrome:
  - audio starts only after gesture,
  - haptics degrade gracefully,
  - app remains usable from home screen,
  - phone speaker, earbuds, and external speaker guidance is clear.
- Manual audio QA:
  - no pop/click on start/stop,
  - volume defaults low,
  - timer fade-out works,
  - changing frequency while playing is smooth,
  - binaural mode produces distinct left/right frequencies and warns clearly that headphones are required.

## Milestones

1. Project setup: Vite, TypeScript, linting, Netlify config, PWA baseline.
2. Audio engine: pure tone and binaural oscillators, gain ramps, live frequency changes, safe teardown.
3. Core UI: player, mode tabs, presets, custom frequency, beat frequency, volume, timer, output mode.
4. Mobile polish: haptics, touch ergonomics, install flow, offline behavior.
5. QA and deploy: Lighthouse, device testing, Netlify preview, production deploy.

## Open product decisions

- Should PocketTone be explicitly free/open source in the UI, or just quietly free?
- Should the first release include any ambient layer, or stay focused on pure tone plus binaural beats?
- Should isochronic pulse ship in the MVP behind a simple mode tab, or wait until after device testing?
- Should preset notes mention the popular wellness associations, or keep the copy strictly practical and non-claimy?
- Should the repository be public immediately, or remain private until an MVP exists?

## Sources

- [MDN: OscillatorNode](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode)
- [MDN: Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [Netlify Docs: Vite on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/)
- [Freqence](https://www.freqence.com/)
- [ToneMaker](https://tonemaker.app/)
- [Online Tone Generator](https://onlinetonegenerator.com/)
- [OnlineToneGen](https://onlinetonegen.com/)
- [FrequencyZen](https://www.onlinefrequencygenerator.xyz/)
- [PureBinaural](https://purebinaural.com/)
- [Lamda Hz on the App Store](https://apps.apple.com/us/app/lamda-hz-frequency-portal/id6747421302)
