// 展廳／修復室場景（全程序化生成，PSX 低面數風）
import * as THREE from 'three';
import { G } from './state.js';

export const BENCH_POS = new THREE.Vector3(-19.2, 1.0, 0);

function pixelTexture(draw, w = 64, h = 64, repeat = [4, 4]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const floorTex = () => pixelTexture((g, w, h) => {
  g.fillStyle = '#4a3424'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) {
    g.fillStyle = y % 32 ? '#503a28' : '#443020';
    g.fillRect(0, y, w, 15);
    g.fillStyle = '#2e2014';
    g.fillRect(0, y + 15, w, 1);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = Math.random() > .5 ? '#55402c' : '#3e2c1c';
      g.fillRect((Math.random() * w) | 0, y + ((Math.random() * 14) | 0), 2, 1);
    }
  }
}, 64, 64, [10, 7]);

const wallTex = () => pixelTexture((g, w, h) => {
  g.fillStyle = '#c9b891'; g.fillRect(0, 0, w, h);         // 米黃牆
  for (let i = 0; i < 120; i++) {
    g.fillStyle = Math.random() > .5 ? '#c2b088' : '#d0c09a';
    g.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 2, 2);
  }
  g.fillStyle = '#7a1f1f'; g.fillRect(0, h - 18, w, 18);   // 朱紅牆裙
  g.fillStyle = '#5a1414'; g.fillRect(0, h - 18, w, 2);
  g.fillStyle = '#d9a441'; g.fillRect(0, 4, w, 3);         // 金線
}, 64, 64, [8, 1]);

const repairWallTex = () => pixelTexture((g, w, h) => {
  g.fillStyle = '#aeb4b8'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = Math.random() > .5 ? '#a6acb0' : '#b6bcc0';
    g.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 2, 2);
  }
  g.fillStyle = '#6b7276'; g.fillRect(0, h - 12, w, 12);
}, 64, 64, [6, 1]);

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// 碰撞：可行走區域 + 圓形障礙
const obstacles = []; // {x,z,r}
export function addObstacle(x, z, r) { obstacles.push({ x, z, r }); }

export function walkable(x, z) {
  const inHall = x > -13.5 && x < 13.5 && z > -8.5 && z < 8.5;
  const inRepair = x > -21.5 && x < -14.5 && z > -3.5 && z < 3.5;
  const inDoor = x > -14.9 && x < -13.1 && z > -1.1 && z < 1.1;
  if (!(inHall || inRepair || inDoor)) return false;
  for (const o of obstacles) {
    const dx = x - o.x, dz = z - o.z;
    if (dx * dx + dz * dz < o.r * o.r) return false;
  }
  return true;
}

export function initWorld(scene) {
  scene.background = new THREE.Color(0x1a120c);
  scene.fog = new THREE.Fog(0x1a120c, 18, 46);

  const matFloor = new THREE.MeshLambertMaterial({ map: floorTex() });
  const matWall = new THREE.MeshLambertMaterial({ map: wallTex() });
  const matRWall = new THREE.MeshLambertMaterial({ map: repairWallTex() });
  const matCeil = new THREE.MeshLambertMaterial({ color: 0x241a10 });
  const matPillar = new THREE.MeshLambertMaterial({ color: 0x7a1f1f });
  const matGold = new THREE.MeshLambertMaterial({ color: 0xd9a441 });

  // 地板 / 天花板
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 20), matFloor);
  floor.rotation.x = -Math.PI / 2; floor.position.set(-4, 0, 0);
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(46, 20), matCeil);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(-4, 5.2, 0);
  scene.add(ceil);

  const H = 5.2, root = new THREE.Group();
  scene.add(root);
  // 大廳外牆
  box(28.6, H, 0.6, matWall, 0, H / 2, -9, root);              // 北
  box(28.6, H, 0.6, matWall, 0, H / 2, 9, root);               // 南（入口意象：門框）
  box(0.6, H, 18.6, matWall, 14, H / 2, 0, root);              // 東
  box(0.6, H, 7.2, matWall, -14, H / 2, -5.4, root);           // 西（留門洞）
  box(0.6, H, 7.2, matWall, -14, H / 2, 5.4, root);
  box(0.6, 2.0, 3.0, matWall, -14, 4.2, 0, root);              // 門楣
  // 修復室外牆
  box(0.6, H, 8.6, matRWall, -22, H / 2, 0, root);
  box(7.6, H, 0.6, matRWall, -18, H / 2, -4, root);
  box(7.6, H, 0.6, matRWall, -18, H / 2, 4, root);

  // 入口門面裝飾（南牆內側）
  box(1.0, 4.2, 0.4, matPillar, -2.6, 2.1, 8.6, root);
  box(1.0, 4.2, 0.4, matPillar, 2.6, 2.1, 8.6, root);
  box(6.6, 0.8, 0.5, matGold, 0, 4.4, 8.6, root);
  makeSign(scene, '國立故宮博物院 · 北部院區', 0, 3.6, 8.55);

  // 紅柱
  for (const [cx, cz] of [[-6.5, 0], [6.5, 0]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, H, 8), matPillar);
    p.position.set(cx, H / 2, cz); scene.add(p);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.3, 8), matGold);
    base.position.set(cx, 0.15, cz); scene.add(base);
    addObstacle(cx, cz, 0.95);
  }

  // 展位（8 座，前排 2 座黃金展位）
  const pedDefs = [
    { x: -4, z: 5, golden: true },  { x: 4, z: 5, golden: true },
    { x: -10, z: 2, golden: false }, { x: 10, z: 2, golden: false },
    { x: -10, z: -4, golden: false }, { x: 10, z: -4, golden: false },
    { x: -4, z: -6.5, golden: false }, { x: 4, z: -6.5, golden: false },
  ];
  const matPed = new THREE.MeshLambertMaterial({ color: 0x3a2c1c });
  const matPedG = new THREE.MeshLambertMaterial({ color: 0x6b5320 });
  const matGlass = new THREE.MeshLambertMaterial({
    color: 0xbfe0e8, transparent: true, opacity: 0.16, depthWrite: false,
  });
  G.pedestals = pedDefs.map((d, i) => {
    const g = new THREE.Group();
    g.position.set(d.x, 0, d.z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.5), d.golden ? matPedG : matPed);
    base.position.y = 0.55; g.add(base);
    if (d.golden) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 1.62), matGold);
      trim.position.y = 1.1; g.add(trim);
    }
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 1.3), matGlass);
    glass.position.y = 1.75; g.add(glass);
    scene.add(g);
    addObstacle(d.x, d.z, 1.25);

    // 展位聚光（暖黃）
    const lamp = new THREE.PointLight(0xffd9a0, 30, 9, 2);
    lamp.position.set(d.x, 3.6, d.z);
    scene.add(lamp);

    return { index: i, x: d.x, z: d.z, golden: d.golden, artifact: null, glass, group: g };
  });

  // 修復室：工作檯 + 工具牆 + 無影燈
  const matBench = new THREE.MeshLambertMaterial({ color: 0xd8d4cc });
  const bench = new THREE.Group();
  bench.position.set(BENCH_POS.x, 0, BENCH_POS.z);
  box(2.6, 0.15, 1.4, matBench, 0, 1.0, 0, bench);
  box(0.2, 1.0, 0.2, new THREE.MeshLambertMaterial({ color: 0x8a8a8a }), -1.1, 0.5, -0.5, bench);
  box(0.2, 1.0, 0.2, new THREE.MeshLambertMaterial({ color: 0x8a8a8a }), 1.1, 0.5, -0.5, bench);
  box(0.2, 1.0, 0.2, new THREE.MeshLambertMaterial({ color: 0x8a8a8a }), -1.1, 0.5, 0.5, bench);
  box(0.2, 1.0, 0.2, new THREE.MeshLambertMaterial({ color: 0x8a8a8a }), 1.1, 0.5, 0.5, bench);
  box(2.4, 1.6, 0.1, new THREE.MeshLambertMaterial({ color: 0x5a5248 }), 0, 2.6, -2.2, bench); // 工具牆板
  for (let i = 0; i < 5; i++) {
    box(0.12, 0.5 + (i % 3) * 0.14, 0.06,
      new THREE.MeshLambertMaterial({ color: [0xc0c0c0, 0xd9a441, 0x8a6d3b, 0xb0b8c0, 0x9a4a3a][i] }),
      -0.9 + i * 0.45, 2.6, -2.14, bench);
  }
  scene.add(bench);
  addObstacle(BENCH_POS.x, BENCH_POS.z, 1.5);
  makeSign(scene, '文 物 修 復 室', -14, 3.2, 1.8, 3.2);

  const rLight = new THREE.PointLight(0xeef4ff, 20, 10, 2);
  rLight.position.set(-18, 4.2, 0);
  scene.add(rLight);

  // 環境光
  scene.add(new THREE.HemisphereLight(0xfff2d8, 0x2a1c10, 1.05));
  const dir = new THREE.DirectionalLight(0xffe8c0, 0.65);
  dir.position.set(6, 10, 4);
  scene.add(dir);

  return { benchPos: BENCH_POS };
}

function makeSign(scene, text, x, y, z, w = 6.6) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2b1810'; g.fillRect(0, 0, 512, 64);
  g.strokeStyle = '#d9a441'; g.lineWidth = 4; g.strokeRect(4, 4, 504, 56);
  g.fillStyle = '#d9a441'; g.font = 'bold 36px "Microsoft JhengHei", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 34);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 8),
    new THREE.MeshBasicMaterial({ map: t, transparent: false }));
  m.position.set(x, y, z);
  if (Math.abs(x + 14) < 0.5) m.rotation.y = Math.PI / 2; // 修復室門牌貼西牆
  else m.rotation.y = Math.PI;                             // 入口牌面向北（廳內）
  scene.add(m);
}
