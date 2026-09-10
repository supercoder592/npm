// 故宮守藝人：兼任館長 — 主程式（狀態機、主迴圈、輸入）
import * as THREE from 'three';
import { G, RIVAL, DAY_LEN, clamp } from './state.js';
import { initWorld } from './world.js';
import { initArtifacts, updateArtifacts, placeOnPedestal, removeFromPedestal, catName } from './artifacts.js';
import { initPlayer, updatePlayer, getInteractTarget, player } from './player.js';
import { initVisitors, updateVisitors, clearVisitors } from './visitors.js';
import { beginDay, endDay } from './economy.js';
import { initBench, openBench, benchUpdate, abortBench } from './restore/bench.js';
import {
  updateHUD, showHint, showToast, hideToast,
  showIntro, showMorning, showNews, showSeasonEnd,
  openMenu, closeMenu, initMenu,
} from './ui.js';
import { fameStars } from './state.js';
import { beep } from './audio.js';
import { initTouch, touch, updateTouchUI } from './touch.js';

const canvas = document.getElementById('view3d');
const RW = 640, RH = 360; // PSX 低解析內部渲染

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(RW, RH, false);
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, RW / RH, 0.1, 80);

initWorld(scene);
initArtifacts(scene);
initVisitors(scene);
initBench(scene);
initPlayer(camera, canvas);
initMenu();

// 畫面等比縮放（letterbox）
function fitCanvas() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / RW, vh / RH);
  canvas.style.width = `${RW * scale}px`;
  canvas.style.height = `${RH * scale}px`;
  canvas.style.left = `${(vw - RW * scale) / 2}px`;
  canvas.style.top = `${(vh - RH * scale) / 2}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// ---------- 流程 ----------
function startDay(first = false) {
  const lines = beginDay();
  if (first) { resumePlay(); tutorialAdvance(0); return; }
  G.mode = 'modal'; G.paused = true;
  showMorning(lines, resumePlay);
}

function resumePlay() {
  G.mode = 'walk';
  G.paused = false;
  if (!touch.active) canvas.requestPointerLock?.();
}

let dayEnding = false;
function endOfDay() {
  if (dayEnding) return;
  dayEnding = true;
  G.mode = 'modal'; G.paused = true;
  clearVisitors();
  const s = endDay();
  updateHUD();
  const scandalOut = G.scandals >= 3 && !G.endless;
  showNews(s, () => {
    dayEnding = false;
    if (s.seasonEnd || scandalOut) {
      showSeasonEnd(() => { G.endless = true; G.day++; startDay(); });
    } else {
      G.day++;
      startDay();
    }
  });
}

// ---------- 教學 ----------
function tutorialAdvance(step) {
  G.tutorialStep = step;
  if (step === 0) {
    showToast('<span class="toast-tag">【教學】</span> 巡館開始。走向左側後排、鏽蝕嚴重的<b>毛公鼎</b>（品質 46），面向它按 <b>R</b> 搬起送修。');
  } else if (step === 1) {
    showToast('<span class="toast-tag">【教學】</span> 很好！搬著鼎前往西側的<b>文物修復室</b>（門上有牌），面向白色修復台按 <b>E</b>。');
  } else if (step === 2) {
    hideToast();
  } else if (step === 3) {
    showToast('<span class="toast-tag">【教學】</span> 修復完成！把毛公鼎<b>放回展位</b>：面向任一空展位按 <b>R</b>。金邊的「黃金展位」吸引力 ×1.3。');
  } else if (step === 4) {
    showToast('<span class="toast-tag">【教學】</span> 上手了！<b>Tab</b> 開館長手冊（票價／行銷／委外／戰況）。<b>水仙盆還碎成八片</b>，快雪時晴帖也在發霉——時間不等人，南院也是。', 12);
  }
}

function tutorialCheck() {
  const s = G.tutorialStep;
  if (s === 0 && G.carrying && G.carrying.id === 'ding') tutorialAdvance(1);
  else if (s === 1 && G.benchArtifact && G.benchArtifact.id === 'ding') tutorialAdvance(2);
  else if (s === 2 && G.carrying && G.carrying.id === 'ding') tutorialAdvance(3);
  else if (s === 3 && !G.carrying) tutorialAdvance(4);
}

// ---------- 動作（鍵盤與觸控共用） ----------
function actionInteract() {
  if (G.mode !== 'walk') return;
  const t = getInteractTarget();
  if (!t) return;
  if (t.type === 'artifact') {
    const a = t.obj;
    showToast(`<b>${a.name}</b>　${'★'.repeat(fameStars(a.fame))}<br>
      <span style="font-size:13px">${catName(a.cat)}・品質 ${Math.round(a.q)}・劣化 ${a.decay.toFixed(1)}/日
      ${a.broken ? '・<span style="color:#e06c5a">碎裂待拼接</span>' : ''}
      ${a.offDisplay ? '・<span style="color:#e06c5a">強制下架中</span>' : ''}</span>`, 4);
  } else if (t.type === 'bench') {
    if (G.carrying) {
      document.exitPointerLock?.();
      hideToast();
      openBench(G.carrying);
    } else {
      showToast('修復台空著。先面向展廳的文物按 <b>R</b>（搬/放）搬過來。', 3);
    }
  }
}

function actionCarry() {
  if (G.mode !== 'walk') return;
  const t = getInteractTarget();
  if (!t) return;
  if (t.type === 'artifact' && !G.carrying) {
    G.carrying = t.obj;
    removeFromPedestal(t.obj);
    beep(520, 0.07);
  } else if (t.type === 'pedestal' && G.carrying) {
    placeOnPedestal(G.carrying, t.obj);
    G.carrying = null;
    beep(700, 0.07);
  }
}

function actionMenuToggle() {
  if (G.mode === 'walk') {
    G.mode = 'menu'; G.paused = true;
    document.exitPointerLock?.();
    openMenu();
  } else if (G.mode === 'menu') {
    closeMenu();
    resumePlay();
  }
}

// ---------- 輸入 ----------
window.addEventListener('keydown', e => {
  if (G.mode === 'walk') {
    if (e.code === 'Tab') { e.preventDefault(); actionMenuToggle(); }
    else if (e.code === 'KeyE') actionInteract();
    else if (e.code === 'KeyR') actionCarry();
  } else if (G.mode === 'menu') {
    if (e.code === 'Tab' || e.code === 'Escape') { e.preventDefault(); actionMenuToggle(); }
  } else if (G.mode === 'bench') {
    if (e.code === 'Escape') abortBench();
  }
});

initTouch({ onInteract: actionInteract, onCarry: actionCarry, onMenu: actionMenuToggle });

// 點擊畫面重新鎖定滑鼠
canvas.addEventListener('click', () => {
  if (G.mode === 'walk' && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
});

// ---------- 開始 ----------
document.getElementById('btn-start').onclick = () => {
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  beep(660, 0.1); beep(880, 0.12);
  showIntro(() => startDay(true));
};

// ---------- 主迴圈 ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;

  if (!G.paused && (G.mode === 'walk' || G.mode === 'bench')) {
    G.dayT += dt;
    const open = G.dayT < DAY_LEN;
    updateArtifacts(dt, true);
    updateVisitors(dt, open && G.mode !== 'modal');
    if (G.mode === 'bench') benchUpdate(dt);
    if (G.dayT >= DAY_LEN && G.mode === 'walk') endOfDay();
    tutorialCheck();
  }

  updatePlayer(dt, camera);

  updateTouchUI(G.mode);

  // 互動提示
  if (G.mode === 'walk') {
    if (!touch.active && document.pointerLockElement !== canvas && !G.paused) {
      showHint('點擊畫面以繼續');
    } else {
      const t = getInteractTarget();
      if (t) showHint(t.hint);
      else if (G.carrying) showHint(`搬運中：「${G.carrying.name}」——送往修復台（E），或面向空展位按 R 放置`);
      else showHint(null);
    }
  } else {
    showHint(null);
  }

  updateHUD();
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

// 除錯掛勾（Playwright 煙霧測試用）
window.__game = {
  G, RIVAL,
  fastForward: () => { G.dayT = DAY_LEN; },
  teleport: (x, z) => { player.x = x; player.z = z; },
};
