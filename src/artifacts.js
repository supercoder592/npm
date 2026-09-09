// 文物：資料、程序化模型、狀態牌、劣化與主題展加成
import * as THREE from 'three';
import { G, DAY_LEN, clamp, fameStars, pushNews } from './state.js';

const CAT_NAME = { jade: '玉石', bronze: '青銅', ceramic: '陶瓷', painting: '書畫' };

export const ARTIFACT_DEFS = [
  { id: 'cabbage', name: '翠玉白菜', cat: 'jade', fame: 110, q: 78, decay: 1.2, minigame: 'dust' },
  { id: 'meatstone', name: '肉形石', cat: 'jade', fame: 110, q: 85, decay: 0.8, minigame: 'dust' },
  { id: 'ding', name: '毛公鼎', cat: 'bronze', fame: 110, q: 46, decay: 1.5, minigame: 'derust' },
  { id: 'basin', name: '汝窯青瓷水仙盆', cat: 'ceramic', fame: 80, q: 38, decay: 1.0, minigame: 'shards', broken: true },
  { id: 'scroll', name: '快雪時晴帖', cat: 'painting', fame: 80, q: 41, decay: 2.2, minigame: 'dust' },
];

function lam(color) { return new THREE.MeshLambertMaterial({ color }); }

// ---- 程序化低面數模型 ----
function buildMesh(a) {
  const g = new THREE.Group();
  if (a.id === 'cabbage') {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.5, 7), lam(0xe8e6d0));
    stalk.position.y = 0.25; g.add(stalk);
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), lam(0x3f8f3a));
      const ang = i * Math.PI / 2 + 0.4;
      leaf.position.set(Math.cos(ang) * 0.1, 0.55, Math.sin(ang) * 0.1);
      leaf.rotation.z = Math.cos(ang) * 0.35;
      leaf.rotation.x = -Math.sin(ang) * 0.35;
      g.add(leaf);
    }
    const bug = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.1), lam(0x2f6f2a));
    bug.position.set(0.08, 0.72, 0.05); g.add(bug);
  } else if (a.id === 'meatstone') {
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.38), lam(0x6b3a26));
    l1.position.y = 0.08; g.add(l1);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.4), lam(0x8a4a30));
    l2.position.y = 0.23; l2.rotation.y = 0.1; g.add(l2);
    const l3 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.36), lam(0xb87050));
    l3.position.y = 0.37; g.add(l3);
    const skin = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.05, 0.37), lam(0x7a4a38));
    skin.position.y = 0.455; g.add(skin);
  } else if (a.id === 'ding') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.34, 9), lam(0x4a5a48));
    body.position.y = 0.38; g.add(body);
    for (let i = 0; i < 3; i++) {
      const ang = i * Math.PI * 2 / 3;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.24, 6), lam(0x44523f));
      leg.position.set(Math.cos(ang) * 0.2, 0.12, Math.sin(ang) * 0.2);
      g.add(leg);
    }
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.024, 5, 8), lam(0x44523f));
      ear.position.set(s * 0.24, 0.6, 0);
      g.add(ear);
    }
  } else if (a.id === 'basin') {
    if (a.broken) { // 碎片堆
      for (let i = 0; i < 7; i++) {
        const frag = new THREE.Mesh(
          new THREE.BoxGeometry(0.1 + Math.random() * 0.12, 0.04, 0.08 + Math.random() * 0.1),
          lam(0x9fc4c0));
        frag.position.set((Math.random() - 0.5) * 0.45, 0.05, (Math.random() - 0.5) * 0.45);
        frag.rotation.y = Math.random() * Math.PI;
        frag.rotation.z = (Math.random() - 0.5) * 0.6;
        g.add(frag);
      }
    } else {
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector2(0.12 + i * 0.032, i * 0.05));
      const basin = new THREE.Mesh(new THREE.LatheGeometry(pts, 10),
        new THREE.MeshLambertMaterial({ color: 0x9fc4c0, side: THREE.DoubleSide }));
      basin.position.y = 0.06; g.add(basin);
      for (let i = 0; i < 4; i++) {
        const ang = i * Math.PI / 2 + Math.PI / 4;
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.07), lam(0x8ab4b0));
        foot.position.set(Math.cos(ang) * 0.2, 0.03, Math.sin(ang) * 0.2);
        g.add(foot);
      }
    }
  } else if (a.id === 'scroll') {
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.01, 0.3), lam(0xe8dcc0));
    paper.position.y = 0.1; g.add(paper);
    for (const s of [-1, 1]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 7), lam(0x4a3424));
      rod.rotation.x = Math.PI / 2;
      rod.position.set(s * 0.31, 0.1, 0);
      g.add(rod);
    }
    const ink = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 0.2), lam(0xd0c0a0));
    ink.position.y = 0.11; g.add(ink);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 0.34), lam(0x2b1810));
    stand.position.y = 0.045; g.add(stand);
  }
  g.traverse(m => { if (m.isMesh) m.userData.baseColor = m.material.color.clone(); });
  return g;
}

// ---- 狀態牌（Sprite） ----
function makeLabel(a) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 80;
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  sp.scale.set(1.7, 0.53, 1);
  a.labelCanvas = c; a.labelTex = t; a.label = sp;
  drawLabel(a);
  return sp;
}

export function drawLabel(a) {
  const g = a.labelCanvas.getContext('2d');
  g.clearRect(0, 0, 256, 80);
  g.fillStyle = 'rgba(20,14,10,.85)'; g.fillRect(0, 0, 256, 80);
  g.strokeStyle = a.pedestal && a.pedestal.golden ? '#d9a441' : '#8a6d3b';
  g.lineWidth = 3; g.strokeRect(2, 2, 252, 76);
  g.fillStyle = '#f0e6d2'; g.font = 'bold 22px "Microsoft JhengHei", sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'middle';
  const flag = a.q < 20 ? ' ⛔' : a.q < 40 ? ' ⚠' : '';
  g.fillText(a.name + flag, 10, 22);
  g.fillStyle = '#d9a441'; g.font = '16px sans-serif';
  g.fillText('★'.repeat(fameStars(a.fame)), 10, 46);
  // 品質條
  g.fillStyle = '#3a2c1c'; g.fillRect(10, 58, 200, 12);
  g.fillStyle = a.q >= 70 ? '#7fc76f' : a.q >= 40 ? '#d9a441' : '#e06c5a';
  g.fillRect(10, 58, 200 * clamp(a.q, 0, 100) / 100, 12);
  g.strokeStyle = '#8a6d3b'; g.lineWidth = 1; g.strokeRect(10, 58, 200, 12);
  g.fillStyle = '#f0e6d2'; g.font = '14px monospace'; g.textAlign = 'right';
  g.fillText(Math.round(a.q), 250, 64);
  a.labelTex.needsUpdate = true;
  a._labelQ = Math.round(a.q);
}

// 品質視覺：低品質 → 材質染髒
function applyDirtTint(a) {
  const dirt = clamp(1 - a.q / 100, 0, 1) * 0.55;
  a.mesh.traverse(m => {
    if (m.isMesh && m.userData.baseColor) {
      m.material.color.copy(m.userData.baseColor).lerp(new THREE.Color(0x3a2c1c), dirt);
    }
  });
}

export function rebuildArtifactMesh(a, scene) {
  const parent = a.group;
  parent.remove(a.mesh);
  a.mesh = buildMesh(a);
  a.mesh.scale.setScalar(1.4);
  parent.add(a.mesh);
  applyDirtTint(a);
}

export function initArtifacts(scene) {
  G.artifacts = ARTIFACT_DEFS.map(def => ({ ...def, pedestal: null, offDisplay: false, themeBonus: 1, hazardDay: 0, hazardNote: '' }));
  // 初始配置：白菜/肉形石佔黃金展位，鼎、帖、盆在後排
  const slots = { cabbage: 0, meatstone: 1, ding: 2, scroll: 3, basin: 6 };
  for (const a of G.artifacts) {
    a.group = new THREE.Group();
    a.mesh = buildMesh(a);
    a.mesh.scale.setScalar(1.4);
    a.group.add(a.mesh);
    a.group.add(makeLabel(a));
    a.label.position.y = 1.6;
    scene.add(a.group);
    placeOnPedestal(a, G.pedestals[slots[a.id]]);
    applyDirtTint(a);
  }
  recomputeThemeBonus();
}

export function placeOnPedestal(a, ped) {
  if (a.pedestal) a.pedestal.artifact = null;
  a.pedestal = ped;
  ped.artifact = a;
  a.group.position.set(ped.x, 1.12, ped.z);
  a.group.visible = true;
  recomputeThemeBonus();
  drawLabel(a);
}

export function removeFromPedestal(a) {
  if (a.pedestal) a.pedestal.artifact = null;
  a.pedestal = null;
  a.group.visible = false;
  recomputeThemeBonus();
}

// 主題展加成：相鄰展位同類別 ×1.15
const ADJ = [[0, 1], [2, 4], [3, 5], [6, 7]];
export function recomputeThemeBonus() {
  for (const a of G.artifacts) a.themeBonus = 1;
  for (const [i, j] of ADJ) {
    const A = G.pedestals[i].artifact, B = G.pedestals[j].artifact;
    if (A && B && A.cat === B.cat) { A.themeBonus = 1.15; B.themeBonus = 1.15; }
  }
}

// 每幀更新：劣化、隱患、下架判定
export function updateArtifacts(dt, open) {
  for (const a of G.artifacts) {
    if (open && a !== G.benchArtifact) {
      const caseFactor = G.humidCase ? 0.7 : 1.0;
      const prev = a.q;
      a.q = clamp(a.q - a.decay * caseFactor * (dt / DAY_LEN), 0, 100);
      if (prev >= 40 && a.q < 40) pushNews('bad', `媒體點名：「${a.name}」狀況堪憂，觀眾直呼失望`);
      if (prev >= 20 && a.q < 20) {
        a.offDisplay = true;
        pushNews('bad', `「${a.name}」品質崩壞，依規強制下架！`);
      }
    }
    if (a.offDisplay && a.q >= 40) a.offDisplay = false; // 修好即可重新展出
    if (Math.round(a.q) !== a._labelQ) { drawLabel(a); applyDirtTint(a); }
    if (a.label) a.label.material.opacity = a.offDisplay ? 0.5 : 1;
  }
}

// 隱患引爆檢查（每日早上呼叫）
export function checkHazards() {
  const blown = [];
  for (const a of G.artifacts) {
    if (a.hazardDay && G.day >= a.hazardDay) {
      a.q = clamp(a.q - 25, 0, 100);
      a.hazardDay = 0;
      blown.push(a);
      pushNews('bad', `修復隱患爆發：「${a.name}」${a.hazardNote}，品質重挫！（不可逆材料的代價）`);
      drawLabel(a);
    }
  }
  return blown;
}

export function catName(cat) { return CAT_NAME[cat]; }
