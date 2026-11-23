// Four Winds: sound. One job: small WebAudio synth bleeps — no audio
// files, no network. The context is created on the first user gesture,
// so autoplay rules never block the game.
export function createAudio() {
  let ctx = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return ctx;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + when;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  return {
    /** Call from any user gesture so later sounds are allowed. */
    unlock() { ensure(); },
    /** Soft click when a card is played. */
    click() { tone(660, 0.09, 'triangle', 0.12); },
    /** Low thud when damage lands. */
    damage() { tone(140, 0.22, 'sine', 0.22, 0, 70); },
    /** Rising chime on a round won. */
    chime() {
      tone(523, 0.12, 'sine', 0.14);
      tone(659, 0.12, 'sine', 0.14, 0.09);
      tone(784, 0.2, 'sine', 0.16, 0.18);
    },
    /** Win flourish: a short arpeggio. */
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.11));
    },
    /** Low descending note on a loss. */
    lowNote() { tone(220, 0.4, 'sine', 0.16, 0, 110); },
  };
}
