/* Tiny synthesized sound kit shared by the arena and the pilot campaign.
   No audio files: every cue is generated with WebAudio, kept short and quiet.
   window.SFX.play(name) · SFX.toggle() · SFX.muted */
(() => {
  "use strict";
  const KEY = "signal-sound";
  let ctx = null, master = null, comp = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === "off"; } catch {}
  const last = new Map();

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.32;
    master.connect(comp); comp.connect(ctx.destination);
    return ctx;
  }

  function tone({ type = "sine", from = 440, to = from, dur = 0.12, gain = 0.3, attack = 0.005, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.2, gain = 0.25, freq = 1200, q = 0.8, type = "lowpass", sweep = 0.4, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t);
  }

  const cues = {
    shoot: () => tone({ type: "triangle", from: 1400, to: 700, dur: 0.05, gain: 0.045 }),
    hit: () => tone({ type: "square", from: 300, to: 180, dur: 0.04, gain: 0.04 }),
    kill: () => { noise({ dur: 0.16, gain: 0.16, freq: 2600, sweep: 0.2 }); tone({ type: "sine", from: 620, to: 180, dur: 0.12, gain: 0.08 }); },
    bigkill: () => { noise({ dur: 0.7, gain: 0.35, freq: 1800, sweep: 0.08 }); tone({ type: "sine", from: 160, to: 40, dur: 0.6, gain: 0.3 }); },
    hurt: () => { tone({ type: "sawtooth", from: 220, to: 70, dur: 0.22, gain: 0.14 }); noise({ dur: 0.18, gain: 0.12, freq: 900, sweep: 0.3 }); },
    pickup: () => { tone({ type: "sine", from: 988, dur: 0.09, gain: 0.09 }); tone({ type: "sine", from: 1319, dur: 0.14, gain: 0.08, delay: 0.06 }); },
    // chained coins climb a major scale, so a clean trail plays as a rising run
    coin: (step = 0) => { const k = Math.pow(2, [0, 2, 4, 5, 7, 9, 11, 12, 14, 16][Math.min(9, step)] / 12); tone({ type: "square", from: 1568 * k, dur: 0.05, gain: 0.035 }); tone({ type: "square", from: 2093 * k, dur: 0.1, gain: 0.035, delay: 0.045 }); },
    medal: () => { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: "triangle", from: f, dur: 0.26, gain: 0.08, delay: i * 0.05 })); tone({ type: "sine", from: 3136, dur: 0.5, gain: 0.03, delay: 0.2 }); },
    spring: () => { tone({ type: "sine", from: 180, to: 900, dur: 0.22, gain: 0.12 }); noise({ dur: 0.08, gain: 0.06, freq: 2400, sweep: 0.4 }); },
    magnet: () => { tone({ type: "sine", from: 220, to: 880, dur: 0.4, gain: 0.08 }); tone({ type: "triangle", from: 440, to: 1760, dur: 0.4, gain: 0.04, delay: 0.05 }); },
    power: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: "triangle", from: f, dur: 0.18, gain: 0.07, delay: i * 0.06 })),
    levelup: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: "sine", from: f, dur: 0.3, gain: 0.08, delay: i * 0.07 })),
    boss: () => { tone({ type: "sawtooth", from: 55, to: 110, dur: 1.1, gain: 0.12, attack: 0.3 }); tone({ type: "sine", from: 110, to: 55, dur: 1.2, gain: 0.12, attack: 0.2, delay: 0.1 }); },
    pulse: () => { noise({ dur: 0.55, gain: 0.25, freq: 400, type: "bandpass", q: 1.2, sweep: 6 }); tone({ type: "sine", from: 90, to: 360, dur: 0.4, gain: 0.16 }); },
    dash: () => noise({ dur: 0.18, gain: 0.12, freq: 600, type: "bandpass", q: 1.5, sweep: 4 }),
    jump: () => tone({ type: "triangle", from: 300, to: 620, dur: 0.12, gain: 0.06 }),
    land: () => noise({ dur: 0.07, gain: 0.07, freq: 500, sweep: 0.5 }),
    stomp: () => { tone({ type: "square", from: 500, to: 120, dur: 0.12, gain: 0.07 }); noise({ dur: 0.1, gain: 0.08, freq: 1500, sweep: 0.3 }); },
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: "triangle", from: f, dur: 0.35, gain: 0.08, delay: i * 0.09 })),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ type: "triangle", from: f, dur: 0.3, gain: 0.07, delay: i * 0.12 })),
    ui: () => tone({ type: "sine", from: 880, dur: 0.05, gain: 0.04 }),
  };
  const minGap = { shoot: 0.07, hit: 0.03, kill: 0.03, coin: 0.02, land: 0.08, spring: 0.1 };

  const SFX = {
    get muted() { return muted; },
    unlock() { ensure(); },
    play(name, arg) {
      if (muted || !cues[name]) return;
      if (!ensure()) return;
      const now = ctx.currentTime, gap = minGap[name] || 0;
      if (gap && now - (last.get(name) || -1) < gap) return;
      last.set(name, now);
      try { cues[name](arg); } catch {}
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? "off" : "on"); } catch {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.32, ctx.currentTime, 0.05);
      if (!muted) { ensure(); SFX.play("ui"); }
      window.dispatchEvent(new CustomEvent("sfx-change", { detail: { muted } }));
      return muted;
    },
    haptic(ms = 18) { try { if (!muted && navigator.vibrate) navigator.vibrate(ms); } catch {} },
  };
  // Browsers only allow audio after a gesture.
  for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, () => ensure(), { once: true, passive: true });
  window.SFX = SFX;
})();
