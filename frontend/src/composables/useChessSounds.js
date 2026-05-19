/**
 * Звуки ходов в стиле Chess.com (Web Audio API, без файлов).
 */
import { useSoundStore } from '@/stores/useSoundStore';

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function tone(freq, duration, type = 'sine', volume = 0.15, delay = 0) {
  const soundStore = useSoundStore();
  if (!soundStore.enabled) return;

  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = volume * soundStore.volume;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch {
    // ignore — autoplay policy
  }
}

export function playMoveSound({ capture = false, check = false, castle = false } = {}) {
  if (check) {
    tone(880, 0.08, 'sine', 0.12);
    tone(1100, 0.1, 'sine', 0.1, 0.08);
    return;
  }
  if (capture) {
    tone(220, 0.12, 'triangle', 0.2);
    tone(180, 0.08, 'triangle', 0.12, 0.04);
    return;
  }
  if (castle) {
    tone(440, 0.06, 'sine', 0.1);
    tone(520, 0.06, 'sine', 0.08, 0.06);
    return;
  }
  tone(600, 0.05, 'sine', 0.1);
}

export function playGameEndSound(won) {
  if (won) {
    tone(523, 0.15, 'sine', 0.12);
    tone(659, 0.15, 'sine', 0.12, 0.12);
    tone(784, 0.2, 'sine', 0.12, 0.24);
  } else {
    tone(400, 0.25, 'triangle', 0.1);
    tone(300, 0.35, 'triangle', 0.08, 0.15);
  }
}

export function playIllegalSound() {
  tone(150, 0.1, 'square', 0.08);
}
