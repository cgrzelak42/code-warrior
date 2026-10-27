// Tiny synthesized sound effects via the Web Audio API (no audio assets to download).

export type SoundName = "card" | "chip" | "flip" | "win" | "blackjack" | "lose" | "push" | "shuffle" | "correct" | "wrong";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(ac: AudioContext, at: number, dur: number, gain: number, freq: number) {
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(at);
}

function tone(ac: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export function playSound(name: SoundName, volume: number): void {
  const ac = audio();
  if (!ac || volume <= 0) return;
  const v = Math.min(1, volume);
  const t = ac.currentTime + 0.005;
  switch (name) {
    case "card":
      noise(ac, t, 0.09, 0.5 * v, 2400);
      break;
    case "flip":
      noise(ac, t, 0.06, 0.4 * v, 3200);
      noise(ac, t + 0.05, 0.05, 0.25 * v, 1800);
      break;
    case "chip":
      tone(ac, t, 2600, 0.05, 0.12 * v, "triangle");
      tone(ac, t + 0.035, 3300, 0.06, 0.09 * v, "triangle");
      break;
    case "shuffle":
      for (let i = 0; i < 8; i++) noise(ac, t + i * 0.045, 0.05, 0.3 * v, 2000 + i * 120);
      break;
    case "win":
      [523.25, 659.25, 783.99].forEach((f, i) => tone(ac, t + i * 0.09, f, 0.35, 0.12 * v));
      break;
    case "blackjack":
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, t + i * 0.08, f, 0.5, 0.13 * v, "triangle"));
      break;
    case "push":
      tone(ac, t, 440, 0.25, 0.08 * v);
      break;
    case "lose":
      tone(ac, t, 220, 0.35, 0.09 * v);
      tone(ac, t + 0.12, 185, 0.4, 0.07 * v);
      break;
    case "correct":
      tone(ac, t, 880, 0.12, 0.09 * v);
      tone(ac, t + 0.08, 1318.5, 0.18, 0.08 * v);
      break;
    case "wrong":
      tone(ac, t, 196, 0.22, 0.09 * v, "triangle");
      break;
  }
}
