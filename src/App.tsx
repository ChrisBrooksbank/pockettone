import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bluetooth,
  CircleStop,
  Headphones,
  Info,
  Moon,
  Play,
  Smartphone,
  Speaker,
  Sparkles,
  Timer,
  Volume2,
  Waves,
} from "lucide-react";
import { ToneEngine, type NoiseColor, type ToneMode } from "./audio/toneEngine";
import { needs } from "./data/needs";
import { presets } from "./data/presets";
import { recommendations } from "./data/recommendations";
import type { OutputMode, Preset, SessionSettings, UserNeed } from "./data/types";
import { useHaptics } from "./hooks/useHaptics";
import { usePersistentState } from "./hooks/usePersistentState";

const defaultSettings: SessionSettings = {
  selectedNeed: "sleep",
  mode: "pure",
  frequency: 174,
  beatFrequency: 4,
  pulseRate: 6,
  noiseColor: "brown",
  volume: 0.18,
  timerMinutes: 30,
  fadeSeconds: 10,
  outputMode: "earbuds",
  hapticsEnabled: true,
};

const timers = [5, 10, 20, 30, 45, 60];
const fades: SessionSettings["fadeSeconds"][] = [0, 3, 10, 30];
const noiseColors: NoiseColor[] = ["brown", "pink", "white", "blue", "violet"];

export default function App() {
  const [settings, setSettings] = usePersistentState("pockettone-settings", defaultSettings);
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [status, setStatus] = useState("Choose what you need, then press play.");
  const engineRef = useRef<ToneEngine | null>(null);
  const haptic = useHaptics(settings.hapticsEnabled);

  const selectedPreset = useMemo(
    () =>
      presets.find(
        (preset) => {
          if (preset.mode !== settings.mode) {
            return false;
          }

          if (settings.mode === "noise") {
            return preset.noiseColor === settings.noiseColor;
          }

          return (
            preset.frequency === settings.frequency &&
            (preset.beatFrequency ?? settings.beatFrequency) === settings.beatFrequency
          );
        },
      ),
    [settings.beatFrequency, settings.frequency, settings.mode, settings.noiseColor],
  );

  const activeRecommendations = recommendations
    .filter((recommendation) => recommendation.need === settings.selectedNeed)
    .map((recommendation) => ({
      ...recommendation,
      preset: presets.find((preset) => preset.id === recommendation.presetId)!,
    }));

  const activePresets = presets.filter((preset) => preset.intent === settings.selectedNeed);
  const selectedNeed = needs.find((need) => need.id === settings.selectedNeed) ?? needs[0];

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new ToneEngine(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (!isPlaying || !engineRef.current) {
      return;
    }

    engineRef.current.update(settings);
  }, [isPlaying, settings]);

  useEffect(() => {
    if (!isPlaying || settings.timerMinutes === null) {
      setRemainingSeconds(null);
      return;
    }

    setRemainingSeconds(settings.timerMinutes * 60);
    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current === null) {
          return null;
        }

        if (current <= 1) {
          window.clearInterval(interval);
          stopTone("Timer complete.");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPlaying, settings.timerMinutes]);

  async function togglePlayback() {
    if (!engineRef.current) {
      engineRef.current = new ToneEngine(settings);
    }

    if (isPlaying) {
      await stopTone("Stopped.");
      return;
    }

    await engineRef.current.play(settings);
    setIsPlaying(true);
    setStatus(playbackLabel(settings));
    haptic([12, 35, 12]);
  }

  async function stopTone(message = "Stopped.") {
    await engineRef.current?.stop();
    setIsPlaying(false);
    setStatus(message);
    setRemainingSeconds(null);
    haptic(20);
  }

  function patchSettings(patch: Partial<SessionSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function applyPreset(preset: Preset, timerMinutes?: number | null) {
    patchSettings({
      mode: preset.mode,
      frequency: preset.frequency,
      beatFrequency: preset.beatFrequency ?? settings.beatFrequency,
      pulseRate: preset.pulseRate ?? settings.pulseRate,
      noiseColor: preset.noiseColor ?? settings.noiseColor,
      timerMinutes: timerMinutes ?? settings.timerMinutes,
      selectedNeed: preset.intent,
      outputMode: preset.mode === "binaural" ? "earbuds" : settings.outputMode,
    });
    setStatus(`${preset.label} selected. ${preset.note}`);
    haptic(10);
  }

  const outputIcon = getOutputIcon(settings.outputMode);

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            <Waves size={26} />
          </div>
          <div>
            <p className="eyebrow">PocketTone</p>
            <h1 id="app-title">What do you need right now?</h1>
          </div>
        </div>

        <div className="need-grid" aria-label="Choose a need">
          {needs.map((need) => (
            <button
              className={need.id === settings.selectedNeed ? "need-tile active" : "need-tile"}
              key={need.id}
              onClick={() => {
                patchSettings({ selectedNeed: need.id });
                setStatus(`Showing ${need.label.toLowerCase()} recommendations. Pick a card below to load a sound.`);
                haptic(8);
              }}
              type="button"
            >
              <span>{need.label}</span>
              <small>{need.prompt}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="player-surface" aria-label="Tone player">
        <div className="tone-readout">
          <div>
            <p className="eyebrow">{modeLabel(settings.mode)}</p>
            <h2>{selectedPreset?.label ?? customTitle(settings)}</h2>
            <p>{selectedPreset?.note ?? customToneCopy(settings.mode)}</p>
          </div>
          <button
            className={isPlaying ? "play-button stop" : "play-button"}
            onClick={togglePlayback}
            type="button"
            aria-label={isPlaying ? "Stop tone" : "Play tone"}
          >
            {isPlaying ? <CircleStop size={34} /> : <Play size={36} fill="currentColor" />}
          </button>
        </div>

        <div className="selection-cue" aria-live="polite">
          <span>Current need</span>
          <b>{selectedNeed.label}</b>
          <small>{selectedNeed.prompt}</small>
        </div>

        <div className="mode-tabs" aria-label="Tone mode">
          <ModeButton current={settings.mode} mode="pure" onClick={() => patchSettings({ mode: "pure" })} />
          <ModeButton current={settings.mode} mode="noise" onClick={() => patchSettings({ mode: "noise" })} />
          <ModeButton
            current={settings.mode}
            mode="binaural"
            onClick={() => patchSettings({ mode: "binaural", outputMode: "earbuds" })}
          />
          <ModeButton current={settings.mode} mode="isochronic" onClick={() => patchSettings({ mode: "isochronic" })} />
        </div>

        <div className="control-grid">
          {settings.mode === "noise" ? (
            <div className="control color-control">
              <span>Noise color</span>
              <div className="color-grid" aria-label="Noise color">
                {noiseColors.map((color) => (
                  <button
                    className={settings.noiseColor === color ? "color-chip active" : "color-chip"}
                    key={color}
                    onClick={() => patchSettings({ noiseColor: color })}
                    type="button"
                  >
                    {noiseLabel(color)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <label className="control">
              <span>Frequency</span>
              <div className="number-field">
                <input
                  min="20"
                  max="20000"
                  step="0.1"
                  type="number"
                  value={settings.frequency}
                  onChange={(event) => patchSettings({ frequency: Number(event.target.value) })}
                />
                <b>Hz</b>
              </div>
            </label>
          )}

          {settings.mode === "binaural" && (
            <label className="control">
              <span>Beat</span>
              <div className="number-field">
                <input
                  min="0.5"
                  max="40"
                  step="0.5"
                  type="number"
                  value={settings.beatFrequency}
                  onChange={(event) => patchSettings({ beatFrequency: Number(event.target.value) })}
                />
                <b>Hz</b>
              </div>
            </label>
          )}

          {settings.mode === "isochronic" && (
            <label className="control">
              <span>Pulse rate</span>
              <div className="number-field">
                <input
                  min="0.5"
                  max="40"
                  step="0.5"
                  type="number"
                  value={settings.pulseRate}
                  onChange={(event) => patchSettings({ pulseRate: Number(event.target.value) })}
                />
                <b>Hz</b>
              </div>
            </label>
          )}

          <label className="control range-control">
            <span>
              <Volume2 size={18} /> Volume
            </span>
            <input
              min="0"
              max="1"
              step="0.01"
              type="range"
              value={settings.volume}
              onChange={(event) => patchSettings({ volume: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="segmented-row" aria-label="Timer">
          <span className="segment-label">
            <Timer size={17} /> Timer
          </span>
          <button className={settings.timerMinutes === null ? "chip active" : "chip"} onClick={() => patchSettings({ timerMinutes: null })} type="button">
            Off
          </button>
          {timers.map((minutes) => (
            <button
              className={settings.timerMinutes === minutes ? "chip active" : "chip"}
              key={minutes}
              onClick={() => patchSettings({ timerMinutes: minutes })}
              type="button"
            >
              {minutes}m
            </button>
          ))}
        </div>

        <div className="segmented-row" aria-label="Fade">
          <span className="segment-label">Fade</span>
          {fades.map((seconds) => (
            <button
              className={settings.fadeSeconds === seconds ? "chip active" : "chip"}
              key={seconds}
              onClick={() => patchSettings({ fadeSeconds: seconds })}
              type="button"
            >
              {seconds === 0 ? "Off" : `${seconds}s`}
            </button>
          ))}
        </div>

        <div className="output-grid" aria-label="Output mode">
          {(["earbuds", "speaker", "phone"] as OutputMode[]).map((mode) => (
            <button
              className={settings.outputMode === mode ? "output active" : "output"}
              key={mode}
              onClick={() => patchSettings({ outputMode: mode })}
              type="button"
            >
              {getOutputIcon(mode)}
              <span>{outputLabel(mode)}</span>
            </button>
          ))}
        </div>

        <p className="status-line" role="status" aria-live="polite">
          {isPlaying ? <Sparkles size={17} /> : <Info size={17} />}
          <span>
            {status}
            {remainingSeconds !== null ? ` ${formatTime(remainingSeconds)} remaining.` : ""}
          </span>
        </p>

        {settings.mode === "binaural" && (
          <p className="guidance">
            <Headphones size={17} /> Binaural beats need separate left and right channels, so use earbuds or headphones.
          </p>
        )}

        {settings.mode === "isochronic" && (
          <p className="guidance">
            <Bluetooth size={17} /> Isochronic pulse is more noticeable than a pure tone and can work over speakers.
          </p>
        )}

        {settings.mode === "noise" && (
          <p className="guidance">
            <Waves size={17} /> Brown and pink noise are usually gentler for sleep or focus. White, blue, and violet are
            brighter, so keep them low.
          </p>
        )}
      </section>

      <section className="recommendation-section" aria-labelledby="recommendations-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recommended for {selectedNeed.label}</p>
            <h2 id="recommendations-title">Pick a starting sound</h2>
          </div>
          <Moon size={22} />
        </div>
        <div className="recommendation-grid">
          {activeRecommendations.map((recommendation) => (
            <button
              className="recommendation-card"
              key={recommendation.id}
              onClick={() => applyPreset(recommendation.preset, recommendation.defaultTimerMinutes ?? settings.timerMinutes)}
              type="button"
            >
              <span>{recommendation.title}</span>
              <b>{recommendation.preset.label}</b>
              <small>{recommendation.rationale}</small>
              {recommendation.caution ? <em>{recommendation.caution}</em> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="preset-section" aria-labelledby="presets-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">All {needLabel(settings.selectedNeed)} presets</p>
            <h2 id="presets-title">More choices for {selectedNeed.label.toLowerCase()}</h2>
          </div>
        </div>
        <div className="preset-grid">
          {activePresets.map((preset) => (
            <button className="preset-card" key={preset.id} onClick={() => applyPreset(preset)} type="button">
              <span>{preset.label}</span>
              <small>{preset.note}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="safety-panel">
        <Info size={19} />
        <p>
          Start quietly, especially with earbuds. PocketTone is for listening rituals, relaxation, focus, and audio checks;
          it does not diagnose, treat, or guarantee health outcomes.
        </p>
        <label className="haptic-toggle">
          <input
            type="checkbox"
            checked={settings.hapticsEnabled}
            onChange={(event) => patchSettings({ hapticsEnabled: event.target.checked })}
          />
          Haptics
        </label>
      </section>
    </main>
  );
}

function ModeButton({ current, mode, onClick }: { current: ToneMode; mode: ToneMode; onClick: () => void }) {
  return (
    <button className={current === mode ? "mode-button active" : "mode-button"} onClick={onClick} type="button">
      {modeLabel(mode)}
    </button>
  );
}

function modeLabel(mode: ToneMode) {
  if (mode === "binaural") {
    return "Binaural beat";
  }
  if (mode === "isochronic") {
    return "Isochronic pulse";
  }
  if (mode === "noise") {
    return "Noise";
  }
  return "Pure tone";
}

function playbackLabel(settings: SessionSettings) {
  if (settings.mode === "noise") {
    return `Playing ${noiseLabel(settings.noiseColor).toLowerCase()} noise.`;
  }
  if (settings.mode === "binaural") {
    return `Playing ${formatNumber(settings.frequency)} Hz with a ${formatNumber(settings.beatFrequency)} Hz binaural beat.`;
  }
  if (settings.mode === "isochronic") {
    return `Playing ${formatNumber(settings.frequency)} Hz with a ${formatNumber(settings.pulseRate)} Hz pulse.`;
  }
  return `Playing ${formatNumber(settings.frequency)} Hz pure sine wave.`;
}

function customToneCopy(mode: ToneMode) {
  if (mode === "noise") {
    return "Custom noise color. Brown and pink are gentler; white, blue, and violet are brighter.";
  }
  if (mode === "binaural") {
    return "Custom headphone-only stereo beat. Keep it subtle.";
  }
  if (mode === "isochronic") {
    return "Custom pulsed tone. Useful over speakers, but more noticeable.";
  }
  return "Custom pure sine wave. Low frequencies may be felt more than heard.";
}

function customTitle(settings: SessionSettings) {
  if (settings.mode === "noise") {
    return `${noiseLabel(settings.noiseColor)} noise`;
  }

  return `${formatNumber(settings.frequency)} Hz Custom`;
}

function noiseLabel(color: NoiseColor) {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const leftover = seconds % 60;
  return `${minutes}:${leftover.toString().padStart(2, "0")}`;
}

function needLabel(need: UserNeed) {
  return needs.find((item) => item.id === need)?.label ?? "current";
}

function outputLabel(mode: OutputMode) {
  if (mode === "earbuds") {
    return "Earbuds";
  }
  if (mode === "speaker") {
    return "Speaker";
  }
  return "Phone";
}

function getOutputIcon(mode: OutputMode) {
  if (mode === "earbuds") {
    return <Headphones size={18} />;
  }
  if (mode === "speaker") {
    return <Speaker size={18} />;
  }
  return <Smartphone size={18} />;
}
