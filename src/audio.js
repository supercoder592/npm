// 極簡 WebAudio 程序化音效
let ctx = null;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* 無音效 */ } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function beep(freq = 660, dur = 0.08, type = 'square', vol = 0.06) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start(); o.stop(c.currentTime + dur);
}

export function chord(freqs, dur = 0.25, type = 'square') {
  freqs.forEach((f, i) => setTimeout(() => beep(f, dur, type, 0.05), i * 60));
}

// 刷子沙沙聲（白噪音短脈衝）
let noiseBuf = null;
export function brushNoise(vol = 0.03) {
  const c = ac(); if (!c) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  s.buffer = noiseBuf;
  f.type = 'highpass'; f.frequency.value = 2500;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.09);
  s.connect(f).connect(g).connect(c.destination);
  s.start();
}

export function sndDamage() { beep(160, 0.2, 'sawtooth', 0.1); beep(90, 0.3, 'sawtooth', 0.08); }
export function sndSnap()   { beep(880, 0.05, 'square', 0.07); beep(1320, 0.08, 'square', 0.05); }
export function sndCash()   { chord([880, 1100, 1320], 0.1); }
export function sndBad()    { chord([440, 330, 220], 0.18, 'sawtooth'); }
export function sndGood()   { chord([660, 880, 1100, 1320], 0.15); }
