// 第一人稱控制與互動（近距離＋視線夾角判定）
import * as THREE from 'three';
import { G } from './state.js';
import { walkable, BENCH_POS } from './world.js';

export const player = { x: 0, z: 7, yaw: 0, pitch: 0, speed: 4.6 };
// 與 THREE 相機一致：rotation.y = yaw 時，面向向量 = (-sin(yaw), 0, -cos(yaw))
// yaw=0 → 面向 -z（廳內）

export const keys = {};

export function initPlayer(camera, dom) {
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Tab', 'KeyE', 'KeyR'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement !== dom || G.mode !== 'walk') return;
    player.yaw -= e.movementX * 0.0026;
    player.pitch -= e.movementY * 0.0026;
    player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));
  });
  syncCamera(camera);
}

export function updatePlayer(dt, camera) {
  if (G.mode !== 'walk') return;
  const f = new THREE.Vector2(-Math.sin(player.yaw), -Math.cos(player.yaw));
  const r = new THREE.Vector2(-f.y, f.x); // 右方向
  let mx = 0, mz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) { mx += f.x; mz += f.y; }
  if (keys['KeyS'] || keys['ArrowDown']) { mx -= f.x; mz -= f.y; }
  if (keys['KeyA'] || keys['ArrowLeft']) { mx -= r.x; mz -= r.y; }
  if (keys['KeyD'] || keys['ArrowRight']) { mx += r.x; mz += r.y; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len; mz /= len;
    const step = player.speed * dt;
    const nx = player.x + mx * step, nz = player.z + mz * step;
    if (walkable(nx, player.z)) player.x = nx;
    if (walkable(player.x, nz)) player.z = nz;
  }
  syncCamera(camera);
}

export function syncCamera(camera) {
  camera.position.set(player.x, 1.6, player.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

// 面向 + 距離的互動目標判定
function facingScore(tx, tz, maxDist) {
  const dx = tx - player.x, dz = tz - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist > maxDist) return -1;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const dot = (dx * fx + dz * fz) / (dist || 1);
  if (dot < 0.45) return -1;
  return dot / (0.5 + dist); // 越近越正對分數越高
}

// 回傳目前可互動目標：{type:'artifact'|'bench'|'pedestal', obj, hint}
export function getInteractTarget() {
  let best = null, bestScore = 0;
  const consider = (score, t) => { if (score > bestScore) { bestScore = score; best = t; } };

  if (G.carrying) {
    for (const p of G.pedestals) {
      if (p.artifact) continue;
      const s = facingScore(p.x, p.z, 3.0);
      if (s > 0) consider(s, {
        type: 'pedestal', obj: p,
        hint: `R　將「${G.carrying.name}」安置於${p.golden ? '【黃金展位】' : '此展位'}`,
      });
    }
    const sb = facingScore(BENCH_POS.x, BENCH_POS.z, 3.4);
    if (sb > 0) consider(sb * 1.2, {
      type: 'bench', obj: null,
      hint: `E　將「${G.carrying.name}」放上修復台`,
    });
  } else {
    for (const a of G.artifacts) {
      if (!a.pedestal) continue;
      const s = facingScore(a.pedestal.x, a.pedestal.z, 3.0);
      if (s > 0) consider(s, {
        type: 'artifact', obj: a,
        hint: `E　檢視「${a.name}」　｜　R　搬起送修`,
      });
    }
    const sb = facingScore(BENCH_POS.x, BENCH_POS.z, 3.4);
    if (sb > 0) consider(sb, { type: 'bench', obj: null, hint: '修復台（先用 R 搬一件文物過來）' });
  }
  return best;
}
