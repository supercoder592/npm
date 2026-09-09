// 觀光客 agent：進場買票 → 看文物 → 逛文創 → 離場
import * as THREE from 'three';
import { G, RIVAL, RUBBER_BAND, hallAppeal, ticketElasticity, artifactAppeal, clamp } from './state.js';
import { sndCash } from './audio.js';

const MAX_CONCURRENT = 14;
const BASE_RATE = 0.15;           // 每秒生成基準（吸引力滿檔時）
const APPEAL_REF = 440;           // 開局滿品質時的參考吸引力

let scene = null;
const visitors = [];
let spawnAcc = 0;

const CLOTH = [0x5a8ab0, 0x9a4a3a, 0x7fc76f, 0xd9a441, 0xb0a0c0, 0x6b7276, 0xe0956a];

function makeVisitorMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.2),
    new THREE.MeshLambertMaterial({ color: CLOTH[(Math.random() * CLOTH.length) | 0] }));
  body.position.y = 0.68; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.2),
    new THREE.MeshLambertMaterial({ color: 0xe8c8a0 }));
  head.position.y = 1.12; g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.18),
    new THREE.MeshLambertMaterial({ color: 0x33302c }));
  legs.position.y = 0.18; g.add(legs);
  // 表情泡泡（預設隱藏）
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter;
  const bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  bub.scale.set(0.4, 0.4, 1); bub.position.y = 1.5; bub.visible = false;
  g.add(bub);
  g.userData.bubble = bub;
  return g;
}

function showBubble(v, ch, color) {
  const bub = v.mesh.userData.bubble;
  const g = bub.material.map.image.getContext('2d');
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = color; g.font = 'bold 24px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 16, 18);
  bub.material.map.needsUpdate = true;
  bub.visible = true;
}

function pickTour() {
  // 依吸引力加權挑 2–4 件文物
  const pool = G.artifacts.filter(a => artifactAppeal(a) > 0);
  const n = Math.min(pool.length, 2 + ((Math.random() * 3) | 0));
  const stops = [];
  const cand = [...pool];
  for (let i = 0; i < n && cand.length; i++) {
    let total = cand.reduce((s, a) => s + artifactAppeal(a), 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let j = 0; j < cand.length; j++) { r -= artifactAppeal(cand[j]); if (r <= 0) { idx = j; break; } }
    stops.push(cand.splice(idx, 1)[0]);
  }
  return stops;
}

function spawnVisitor() {
  const mesh = makeVisitorMesh();
  mesh.position.set((Math.random() - 0.5) * 2.5, 0, 8.2);
  scene.add(mesh);
  const stops = pickTour();
  const v = {
    mesh, stops, stopIdx: 0, dwell: 0, viewedQ: [], state: 'walk',
    speed: 1.3 + Math.random() * 0.5,
    target: null,
  };
  nextTarget(v);
  visitors.push(v);
  // 買票
  G.funds += G.ticket;
  G.incomeToday += G.ticket;
  G.visitorsToday += 1;
  if (Math.random() < 0.25) sndCash();
}

function nextTarget(v) {
  if (v.stopIdx < v.stops.length) {
    const a = v.stops[v.stopIdx];
    if (!a.pedestal || artifactAppeal(a) <= 0) { v.stopIdx++; return nextTarget(v); }
    const ang = Math.random() * Math.PI * 2;
    v.target = { x: a.pedestal.x + Math.cos(ang) * 1.7, z: clamp(a.pedestal.z + Math.sin(ang) * 1.7, -8, 8), a };
  } else {
    v.target = { x: (Math.random() - 0.5) * 2.5, z: 8.4, a: null }; // 離場
  }
}

export function initVisitors(sc) { scene = sc; }

export function updateVisitors(dt, open) {
  // 生成
  if (open) {
    const mood = clamp(0.7 + (G.moodHistory[G.moodHistory.length - 1] || 0.75) * 0.6, 0.8, 1.2);
    const marketing = G.marketingDays > 0 ? 1.5 : 1.0;
    const rubber = (RUBBER_BAND && G.reputation < RIVAL.reputation) ? 1.08 : 1.0;
    const rate = BASE_RATE * (hallAppeal(G) / APPEAL_REF) * ticketElasticity(G.ticket) * mood * marketing * rubber;
    spawnAcc += rate * dt;
    while (spawnAcc >= 1 && visitors.length < MAX_CONCURRENT) { spawnAcc -= 1; spawnVisitor(); }
    if (visitors.length >= MAX_CONCURRENT) spawnAcc = Math.min(spawnAcc, 2);
  }

  // 移動與停留
  for (let i = visitors.length - 1; i >= 0; i--) {
    const v = visitors[i];
    if (v.state === 'walk') {
      const dx = v.target.x - v.mesh.position.x, dz = v.target.z - v.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        if (v.target.a) {
          const a = v.target.a;
          if (!a.pedestal || artifactAppeal(a) <= 0) {
            // 走到一半文物被搬走了——聳聳肩看下一件
            v.stopIdx++; nextTarget(v);
            continue;
          }
          v.state = 'view'; v.dwell = 2.5 + Math.random() * 2.5;
          v.viewedQ.push(a.q);
          v.mesh.lookAt(a.pedestal.x, 1, a.pedestal.z);
          if (a.q < 40) showBubble(v, '!', '#e06c5a');
          else if (a.q >= 80) showBubble(v, '♥', '#e0788a');
        } else {
          // 離場：結算滿意度與文創消費
          const sat = v.viewedQ.length ? clamp((v.viewedQ.reduce((s, q) => s + q, 0) / v.viewedQ.length) / 100, 0, 1) : 0.3;
          G.satSum += sat; G.satCount += 1;
          const shop = Math.round(sat * 45 * Math.random() * 2 * 0.7 + sat * 15);
          G.funds += shop; G.incomeToday += shop;
          scene.remove(v.mesh);
          visitors.splice(i, 1);
          continue;
        }
      } else {
        const s = v.speed * dt;
        v.mesh.position.x += dx / d * s;
        v.mesh.position.z += dz / d * s;
        v.mesh.rotation.y = Math.atan2(dx, dz);
        v.mesh.position.y = Math.abs(Math.sin(performance.now() / 130 + i)) * 0.04; // 小碎步
      }
    } else if (v.state === 'view') {
      v.dwell -= dt;
      if (v.dwell <= 0) {
        v.mesh.userData.bubble.visible = false;
        v.stopIdx++; v.state = 'walk'; nextTarget(v);
      }
    }
  }
}

// 閉館：全部請出去
export function clearVisitors() {
  for (const v of visitors) scene.remove(v.mesh);
  visitors.length = 0;
  spawnAcc = 0;
}

export function visitorCount() { return visitors.length; }
