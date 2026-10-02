// ─────────────────────────────────────────────────────────────
// WASHWISE Water-Bubble Button Sound Utility
// Produces a gentle, organic water-bubble / water-drop sound
// using Web Audio API synthesis (zero network latency, offline, lightweight).
// ─────────────────────────────────────────────────────────────

const SOUND_STORAGE_KEY = 'washwise_sound_enabled';
const SOUND_EVENT_NAME = 'washwise-sound-changed';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Check if sound effects are enabled (default: true).
 */
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
}

/**
 * Toggle sound effects on/off and broadcast the change.
 */
export function toggleSound(): boolean {
  const next = !isSoundEnabled();
  localStorage.setItem(SOUND_STORAGE_KEY, next ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(SOUND_EVENT_NAME, { detail: { enabled: next } }));
  if (next) {
    playWaterBubbleSound();
  }
  return next;
}

/**
 * Play a subtle, soft water-bubble droplet sound.
 * Physics: rapid upward frequency sweep (420Hz -> 850Hz in 50ms)
 * with an exponential volume decay envelope.
 */
export function playWaterBubbleSound(): void {
  try {
    if (!isSoundEnabled()) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Oscillator node
    const osc = ctx.createOscillator();
    osc.type = 'sine';

    // Upward pitch bend gives the characteristic "bloop / bubble pop" sound
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);

    // Gain (volume) envelope: soft peak decaying to zero quickly
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01); // Soft max volume
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07); // Gentle fade out

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // Non-blocking: sound failures should never interrupt application actions
  }
}
