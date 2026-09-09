// 修復台：小遊戲載入、結果套用、收工
import { G, clamp, pushNews } from '../state.js';
import { spend } from '../economy.js';
import { rebuildArtifactMesh, drawLabel } from '../artifacts.js';
import { ScrubGame } from './scrub.js';
import { ShardsGame } from './shards.js';
import { sndGood, sndBad } from '../audio.js';

let game = null;
let scene = null;

const $ = id => document.getElementById(id);

export function initBench(sc) {
  scene = sc;
  $('bench-exit').onclick = () => abortBench();
}

export function openBench(artifact) {
  G.mode = 'bench';
  G.benchArtifact = artifact;
  G.carrying = null;
  $('bench').classList.remove('hidden');
  $('bench-title').textContent = `修復台：${artifact.name}`;
  const canvas = $('bench-canvas');
  const opts = {
    artifact,
    onDone: r => applyResult(artifact, r),
    setFoot: html => { $('bench-foot').innerHTML = html; },
    setPhase: t => { $('bench-phase').textContent = t; },
  };
  if (artifact.minigame === 'shards' && artifact.broken) {
    game = new ShardsGame(canvas, opts);
  } else if (artifact.minigame === 'derust') {
    game = new ScrubGame(canvas, { ...opts, mode: 'derust' });
  } else {
    game = new ScrubGame(canvas, { ...opts, mode: 'dust' });
  }
  window.__bench = game; // 測試掛勾
}

export function benchUpdate(dt) {
  if (game) game.update(dt);
}

export function abortBench() {
  if (game && !game.done) game.abort();
}

function applyResult(a, r) {
  const before = Math.round(a.q);
  a.q = clamp(a.q + r.restore, 0, 100);
  spend(r.cost);
  if (r.decayMult && r.decayMult !== 1) a.decay *= r.decayMult;
  if (r.hazardDays) { a.hazardDay = G.day + r.hazardDays; a.hazardNote = r.hazardNote; }
  if (r.fixedBroken && a.broken) { a.broken = false; rebuildArtifactMesh(a, scene); }
  if (r.grade) G.ethicsLog.push({ name: a.name, grade: r.grade });
  if (r.complete && r.restore > 20) pushNews('good', `北院修復室捷報：「${a.name}」完成修復，重現風華`);
  drawLabel(a);
  (r.grade === 'S' || r.grade === 'A') ? sndGood() : (r.grade === 'F' ? sndBad() : null);

  // 結果卡
  const gradeTxt = r.grade
    ? `<div style="font-size:34px;margin:6px 0" class="${['S', 'A'].includes(r.grade) ? 'ethic-good' : ['C', 'F'].includes(r.grade) ? 'ethic-bad' : ''}">倫理評分：${r.grade}</div>`
    : `<div style="margin:6px 0">（中途收工，不列入評鑑）</div>`;
  $('bench-phase').textContent = '修復完成';
  $('bench-foot').innerHTML = `
    <div style="text-align:center">
      品質 ${before} → <b>${Math.round(a.q)}</b>（${r.restore >= 0 ? '+' : ''}${Math.round(r.restore)}）　材料費 $${r.cost}
      ${gradeTxt}
      <div style="font-size:12px;color:#b0a080">${(r.notes || []).join('　·　')}</div>
      <button class="px-btn small" id="bench-done" style="margin-top:8px">帶文物離開修復台</button>
    </div>`;
  $('bench-done').onclick = closeBench;
}

export function closeBench() {
  if (game) { game.destroy(); game = null; }
  const a = G.benchArtifact;
  G.benchArtifact = null;
  G.carrying = a;               // 修完抱在手上，走回展廳放展位
  $('bench').classList.add('hidden');
  G.mode = 'walk';
  document.getElementById('view3d').requestPointerLock?.();
}
