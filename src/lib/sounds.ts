// Programmatic Web Audio chimes — no asset dependencies.
// Each tone uses a sine wave with a fast attack + exponential decay envelope
// so it sounds like a soft bell rather than a beep.

type AudioContextCtor = typeof AudioContext;

// Module-level singleton: AudioContext is a heavy OS-backed resource and browsers
// cap how many can exist (~6 on Chromium). Creating one per chime risks the cap
// and adds noticeable latency; reuse a single context for the lifetime of the page.
let cachedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (cachedCtx) return cachedCtx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    cachedCtx = new Ctor();
    return cachedCtx;
  } catch {
    return null;
  }
}

function playChime(frequencies: number[], noteDurationMs = 180, peakGain = 0.25) {
  const ctx = getAudioContext();
  if (!ctx) return;
  // Browsers auto-suspend the context if no recent user gesture; resume() is a no-op
  // when already running. Schedule notes after resume resolves so they always play.
  const ensureRunning = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
  ensureRunning
    .then(() => {
      const now = ctx.currentTime;
      const noteDuration = noteDurationMs / 1000;

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = now + i * noteDuration;
        const endTime = startTime + noteDuration;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, endTime);

        osc.connect(gain).connect(ctx.destination);
        osc.start(startTime);
        osc.stop(endTime);
      });
    })
    .catch(() => {});
}

// C5 → E5 — positive ascending two-tone bell.
export function playSetCompleteChime() {
  playChime([523.25, 659.25], 180);
}

// G4 — single soft tone signaling "ready for next set".
export function playBreakCompleteChime() {
  playChime([392], 220, 0.2);
}
