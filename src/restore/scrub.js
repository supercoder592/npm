// 塗刮引擎：青銅除鏽（檢視→除鏽→封護）與基礎除塵共用
import { G, clamp, pushNews } from '../state.js';
import { brushNoise, sndDamage, sndSnap, beep } from '../audio.js';
import { touch } from '../touch.js';

const W = 860, H = 520, CX = 430, CY = 280;

// ---- 文物底圖（程序化 2D） ----
function drawArt(g, id) {
  g.save();
  g.translate(CX, CY);
  if (id === 'ding') {
    g.fillStyle = '#4a5a48';
    g.beginPath(); g.ellipse(0, -10, 150, 120, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#44523f';
    for (const s of [-1, 1]) {                       // 雙耳
      g.beginPath(); g.ellipse(s * 130, -120, 34, 46, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a2622';
      g.beginPath(); g.ellipse(s * 130, -120, 16, 26, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#44523f';
    }
    for (const s of [-1, 0, 1]) {                    // 三足
      g.fillRect(s * 90 - 18, 92, 36, 70);
    }
    g.strokeStyle = '#3a4838'; g.lineWidth = 3;      // 紋帶
    for (let i = 0; i < 8; i++) {
      g.strokeRect(-140 + i * 36, -80, 26, 26);
    }
    g.fillStyle = '#3a4838'; g.font = '18px serif';  // 銘文意象
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      g.fillText(['⿱', '⿰', '亖', '文', '王', '鼎'][(r * 6 + c) % 6], -85 + c * 30, -10 + r * 30);
    }
  } else if (id === 'cabbage') {
    g.fillStyle = '#e8e6d0';
    g.beginPath(); g.ellipse(0, 60, 70, 110, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3f8f3a';
    for (const [ox, oy, rx, ry, rot] of [[-40, -60, 55, 110, -0.35], [40, -60, 55, 110, 0.35], [0, -80, 50, 105, 0]]) {
      g.beginPath(); g.ellipse(ox, oy, rx, ry, rot, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = '#2f6f2a'; g.lineWidth = 3;
    for (const [ox, rot] of [[-40, -0.35], [40, 0.35], [0, 0]]) {
      g.beginPath(); g.moveTo(ox, 40); g.quadraticCurveTo(ox + rot * 60, -80, ox + rot * 30, -160); g.stroke();
    }
    g.fillStyle = '#2f6f2a';                          // 螽斯
    g.beginPath(); g.ellipse(30, -140, 26, 12, 0.4, 0, Math.PI * 2); g.fill();
  } else if (id === 'meatstone') {
    const layers = [['#6b3a26', 90], ['#8a4a30', 40], ['#b87050', -10], ['#c88868', -50]];
    for (const [col, y] of layers) {
      g.fillStyle = col;
      g.beginPath(); g.ellipse(0, y, 170, 55, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(-170, y - 50 < -105 ? -105 : y - 50, 340, 50);
    }
    g.fillStyle = '#7a4a38';
    g.beginPath(); g.ellipse(0, -105, 170, 40, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(90,40,30,.5)';
      g.fillRect(-160 + Math.random() * 320, -120 + Math.random() * 30, 3, 3);
    }
  } else if (id === 'scroll') {
    g.fillStyle = '#4a3424';
    g.fillRect(-330, -90, 40, 180); g.fillRect(290, -90, 40, 180);
    g.fillStyle = '#e8dcc0';
    g.fillRect(-290, -80, 580, 160);
    g.fillStyle = '#d8c8a0';
    g.fillRect(-290, -80, 60, 160); g.fillRect(230, -80, 60, 160);
    g.fillStyle = '#2a2622'; g.font = '26px serif';
    const chars = '羲之頓首快雪時晴佳想安善未果為結力不次';
    for (let c = 0; c < 8; c++) for (let r = 0; r < 4; r++) {
      g.fillText(chars[(c * 4 + r) % chars.length], 190 - c * 52, -40 + r * 36);
    }
    g.fillStyle = '#9a2a2a';
    g.fillRect(-240, 30, 24, 24); g.fillRect(150, -66, 20, 20);   // 印章
  }
  g.restore();
}

// 在底圖不透明處取樣放斑點
function samplePoints(baseCtx, n, minDist = 55) {
  const img = baseCtx.getImageData(0, 0, W, H).data;
  const pts = [];
  let guard = 0;
  while (pts.length < n && guard++ < 4000) {
    const x = 80 + Math.random() * (W - 160), y = 60 + Math.random() * (H - 130);
    if (img[((y | 0) * W + (x | 0)) * 4 + 3] < 200) continue;
    if (pts.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < minDist * minDist)) continue;
    pts.push({ x, y });
  }
  return pts;
}

const SPOT_STYLE = {
  harmful: { fill: '#8fdc5a', speck: '#c8f090', name: '有害鏽（粉狀綠鏽）' },
  patina:  { fill: '#3d5a52', speck: '#4a6a60', name: '穩定皮殼（勿除）' },
  dust:    { fill: '#6b5a42', speck: '#8a7a5a', name: '積塵' },
};

export class ScrubGame {
  /**
   * opts: { artifact, mode:'derust'|'dust', onDone(result), setFoot(html), setPhase(text) }
   */
  constructor(canvas, opts) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.o = opts;
    const a = opts.artifact;
    this.fragile = a.cat === 'painting';
    this.speedLimit = this.fragile ? 520 : 850;

    this.base = document.createElement('canvas');
    this.base.width = W; this.base.height = H;
    const bg = this.base.getContext('2d');
    drawArt(bg, a.id);

    // 生成斑點
    this.spots = [];
    if (opts.mode === 'derust') {
      const pts = samplePoints(bg, 11);
      pts.forEach((p, i) => this.spots.push({
        ...p, r: 26 + Math.random() * 14,
        type: i < 7 ? 'harmful' : 'patina',
        hp: 1, tagged: false, warned: false,
        blob: this.makeBlob(),
      }));
      this.phase = 'survey';
    } else {
      const pts = samplePoints(bg, 8);
      pts.forEach(p => this.spots.push({
        ...p, r: 24 + Math.random() * 12, type: 'dust', hp: 1, tagged: true, warned: false,
        blob: this.makeBlob(),
      }));
      this.phase = 'scrub';
    }

    this.mouse = { x: -99, y: -99 };
    this.lmb = false; this.rmb = false;
    this.damage = 0; this.patinaHurt = 0;
    this.dmgCooldown = 0; this.flash = 0;
    this.seal = null;
    this.done = false;

    this._down = e => this.onDown(e);
    this._up = e => this.onUp(e);
    this._move = e => this.onMove(e);
    this._ctx = e => e.preventDefault();
    canvas.addEventListener('pointerdown', this._down);
    window.addEventListener('pointerup', this._up);
    canvas.addEventListener('pointermove', this._move);
    canvas.addEventListener('contextmenu', this._ctx);
    this.refreshFoot();
  }

  makeBlob() {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      parts.push({ dx: (Math.random() - 0.5) * 1.3, dy: (Math.random() - 0.5) * 1.3, s: 0.4 + Math.random() * 0.5 });
    }
    return parts;
  }

  destroy() {
    this.cv.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointerup', this._up);
    this.cv.removeEventListener('pointermove', this._move);
    this.cv.removeEventListener('contextmenu', this._ctx);
  }

  canvasPos(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }

  onDown(e) {
    const p = this.canvasPos(e);
    if (e.button === 0) this.lmb = true;
    if (e.button === 2) this.rmb = true;
    if (this.phase === 'survey' && e.button === 0) {
      for (const s of this.spots) {
        if ((p.x - s.x) ** 2 + (p.y - s.y) ** 2 < (s.r + 12) ** 2 && !s.tagged && !s.marked) {
          if (s.type === 'harmful') { s.tagged = true; beep(880, 0.06); }
          else { s.marked = true; beep(330, 0.1, 'triangle'); }
          this.refreshFoot();
          return;
        }
      }
    }
  }
  onUp(e) {
    if (e.button === 0) this.lmb = false;
    if (e.button === 2) this.rmb = false;
  }
  onMove(e) { this.mouse = this.canvasPos(e); }

  taggedAll() { return this.spots.filter(s => s.type === 'harmful').every(s => s.tagged); }
  cleanFraction() {
    const targets = this.spots.filter(s => s.type !== 'patina');
    if (!targets.length) return 1;
    return targets.reduce((sum, s) => sum + (1 - s.hp), 0) / targets.length;
  }

  refreshFoot() {
    const f = this.o.setFoot, ph = this.o.setPhase;
    if (this.phase === 'survey') {
      ph('工序 1／3：檢視建檔 — 移動滑鼠以紫外燈檢視，左鍵標記【有害鏽】。深色沉穩的是皮殼，不要標！');
      const left = this.spots.filter(s => s.type === 'harmful' && !s.tagged).length;
      f(`尚有 <b>${left}</b> 處有害鏽未標記
         <button class="px-btn small" id="sc-next" ${this.taggedAll() ? '' : 'disabled'}>開始除鏽 →</button>`);
      const b = document.getElementById('sc-next');
      if (b) b.onclick = () => { this.phase = 'scrub'; this.refreshFoot(); };
    } else if (this.phase === 'scrub') {
      if (this.o.mode === 'derust') {
        ph('工序 2／3：除鏽 — 按住左鍵刮除【綠色有害鏽】。手速過快會刮傷本體；長按右鍵＝屏息精修。皮殼碰了會後悔。');
      } else {
        ph(this.fragile
          ? '基礎除塵 — 紙絹嬌貴！輕輕地、慢慢地刷（長按右鍵屏息精修更穩）。'
          : '基礎除塵 — 按住左鍵以軟毛刷清除積塵，手速過快會傷及本體。');
      }
      f(`清潔進度 <b id="sc-prog">0%</b>　失誤 <b id="sc-dmg">0</b> 次
         ${touch.active ? '<button class="px-btn small" id="sc-hold">按住＝屏息精修</button>' : ''}
         <button class="px-btn small" id="sc-fin" disabled>完成清潔 →</button>`);
      const b = document.getElementById('sc-fin');
      if (b) b.onclick = () => {
        if (this.o.mode === 'derust') { this.phase = 'seal'; this.refreshFoot(); }
        else this.finish(true);
      };
      const hold = document.getElementById('sc-hold');
      if (hold) {
        hold.addEventListener('pointerdown', e => { e.preventDefault(); this.rmb = true; hold.classList.add('holding'); });
        const off = () => { this.rmb = false; hold.classList.remove('holding'); };
        hold.addEventListener('pointerup', off);
        hold.addEventListener('pointercancel', off);
        hold.addEventListener('pointerleave', off);
      }
    } else if (this.phase === 'seal') {
      ph('工序 3／3：封護 — 選擇封護材料。可逆性是修復倫理的底線……但錢包也是現實。');
      f(`<button class="px-btn small" id="sl-b72">Paraloid B-72（$800・可逆・劣化−25%）</button>
         <button class="px-btn small" id="sl-epoxy">環氧樹脂（$200・不可逆…）</button>
         <button class="px-btn small" id="sl-skip">不封護（$0）</button>`);
      document.getElementById('sl-b72').onclick = () => { this.seal = 'b72'; this.finish(true); };
      document.getElementById('sl-epoxy').onclick = () => { this.seal = 'epoxy'; this.finish(true); };
      document.getElementById('sl-skip').onclick = () => { this.seal = null; this.finish(true); };
    }
  }

  update(dt) {
    if (this.done) return;
    const m = this.mouse;
    // 手速
    const last = this._lastMouse || m;
    const speed = Math.hypot(m.x - last.x, m.y - last.y) / Math.max(dt, 0.001);
    this._lastMouse = { ...m };
    this.dmgCooldown = Math.max(0, this.dmgCooldown - dt);
    this.flash = Math.max(0, this.flash - dt * 3);

    if (this.phase === 'scrub' && this.lmb) {
      const brushR = this.rmb ? 16 : 28;
      const rate = this.rmb ? 0.55 : 0.95;
      let touching = false;
      for (const s of this.spots) {
        const d = Math.hypot(m.x - s.x, m.y - s.y);
        if (d < brushR + s.r) {
          touching = true;
          if (s.type === 'patina') {
            if (this.phaseAllowsPatina()) continue;
            s.hp = clamp(s.hp - dt * rate * 0.7, 0, 1);
            if (s.hp < 0.6 && !s.warned) {
              s.warned = true; this.patinaHurt++;
              this.flash = 1; sndDamage();
              this.o.setPhase('⚠ 你把穩定皮殼除掉了！那是文物的歲月價值……（品質與倫理雙扣）');
            }
          } else {
            s.hp = clamp(s.hp - dt * rate, 0, 1);
          }
        }
      }
      if (touching) {
        if (Math.random() < dt * 14) brushNoise();
        const limit = this.rmb ? this.speedLimit * 1.8 : this.speedLimit;
        if (speed > limit && this.dmgCooldown <= 0) {
          this.damage++; this.dmgCooldown = 0.6; this.flash = 1;
          sndDamage();
        }
      }
      // 即時 HUD
      const pr = document.getElementById('sc-prog');
      if (pr) pr.textContent = Math.round(this.cleanFraction() * 100) + '%';
      const dm = document.getElementById('sc-dmg');
      if (dm) dm.textContent = this.damage + this.patinaHurt;
      const fin = document.getElementById('sc-fin');
      if (fin && this.cleanFraction() > 0.98) fin.disabled = false;
    }
    this.draw();
  }

  phaseAllowsPatina() { return false; }

  draw() {
    const g = this.g;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#2a2622'; g.fillRect(0, 0, W, H);
    // 工作檯墊布
    g.fillStyle = '#3a4a3a'; g.fillRect(30, 30, W - 60, H - 60);
    g.drawImage(this.base, 0, 0);

    // 斑點
    for (const s of this.spots) {
      if (s.hp <= 0.02) continue;
      const st = SPOT_STYLE[s.type];
      g.globalAlpha = s.hp * (s.type === 'patina' ? 0.9 : 0.85);
      g.fillStyle = st.fill;
      for (const b of s.blob) {
        g.beginPath();
        g.arc(s.x + b.dx * s.r, s.y + b.dy * s.r, s.r * b.s, 0, Math.PI * 2);
        g.fill();
      }
      if (s.type === 'harmful') {   // 粉狀質感
        g.fillStyle = st.speck;
        for (let i = 0; i < 6; i++) {
          g.fillRect(s.x + (((i * 37) % 20) - 10) * s.r / 12, s.y + (((i * 53) % 22) - 11) * s.r / 12, 3, 3);
        }
      }
      g.globalAlpha = 1;
    }

    if (this.phase === 'survey') {
      // 暗場 + 紫外燈
      g.save();
      g.fillStyle = 'rgba(8,6,16,.82)';
      g.beginPath(); g.rect(0, 0, W, H);
      g.arc(this.mouse.x, this.mouse.y, 85, 0, Math.PI * 2, true);
      g.fill('evenodd');
      g.restore();
      g.strokeStyle = '#b58ae0'; g.lineWidth = 2;
      g.beginPath(); g.arc(this.mouse.x, this.mouse.y, 85, 0, Math.PI * 2); g.stroke();
      // 標記
      for (const s of this.spots) {
        if (s.tagged) {
          g.strokeStyle = '#ffd94a'; g.lineWidth = 3;
          g.beginPath(); g.arc(s.x, s.y, s.r + 8, 0, Math.PI * 2); g.stroke();
        } else if (s.marked) {
          g.strokeStyle = '#9aa0a6'; g.lineWidth = 3;
          g.beginPath();
          g.moveTo(s.x - 12, s.y - 12); g.lineTo(s.x + 12, s.y + 12);
          g.moveTo(s.x + 12, s.y - 12); g.lineTo(s.x - 12, s.y + 12);
          g.stroke();
          g.fillStyle = '#9aa0a6'; g.font = '13px sans-serif'; g.textAlign = 'center';
          g.fillText('皮殼·勿除', s.x, s.y + s.r + 18);
        }
      }
    } else if (this.phase === 'scrub') {
      // 已標記提示圈
      for (const s of this.spots) {
        if (s.type === 'harmful' && s.tagged && s.hp > 0.02) {
          g.strokeStyle = 'rgba(255,217,74,.5)'; g.lineWidth = 2;
          g.beginPath(); g.arc(s.x, s.y, s.r + 8, 0, Math.PI * 2); g.stroke();
        }
      }
      // 筆刷游標
      const r = this.rmb ? 16 : 28;
      g.strokeStyle = this.rmb ? '#8ad4ff' : '#f0e6d2';
      g.lineWidth = 2;
      g.beginPath(); g.arc(this.mouse.x, this.mouse.y, r, 0, Math.PI * 2); g.stroke();
      if (this.rmb) {
        g.fillStyle = '#8ad4ff'; g.font = '12px sans-serif'; g.textAlign = 'center';
        g.fillText('屏息', this.mouse.x, this.mouse.y - r - 6);
      }
    }

    if (this.flash > 0) {
      g.fillStyle = `rgba(200,40,30,${this.flash * 0.25})`;
      g.fillRect(0, 0, W, H);
    }
  }

  // 完成（或收工的部分成果）
  finish(complete) {
    if (this.done) return;
    this.done = true;
    const a = this.o.artifact;
    const frac = this.cleanFraction();
    const baseRestore = this.o.mode === 'derust' ? 38 : (a.cat === 'painting' ? 20 : 18);
    let restore = baseRestore * frac - this.damage * 2 - this.patinaHurt * 5;
    let cost = this.o.mode === 'derust' ? 200 : 100;
    const notes = [];
    let hazardDays = 0, hazardNote = '', decayMult = 1;

    if (this.seal === 'b72') { cost += 800; decayMult = 0.75; notes.push('B-72 封護：可逆、劣化 −25%'); }
    if (this.seal === 'epoxy') {
      cost += 200; decayMult = 0.7;
      hazardDays = 3; hazardNote = '封護層開裂泛黃';
      notes.push('環氧樹脂封護：省了錢，埋了雷（不可逆）');
    }
    if (this.patinaHurt > 0) notes.push(`誤除穩定皮殼 ×${this.patinaHurt}（品質與倫理受損）`);
    if (this.damage > 0) notes.push(`施力過猛刮傷 ×${this.damage}`);

    let grade = null;
    if (complete) {
      const pen = this.patinaHurt * 2 + this.damage + (this.seal === 'epoxy' ? 4 : 0);
      grade = pen <= 0 ? 'S' : pen === 1 ? 'A' : pen <= 3 ? 'B' : pen <= 5 ? 'C' : 'F';
    }
    if (this.damage + this.patinaHurt >= 6) {
      grade = 'F';
      pushNews('bad', `修復事故：「${a.name}」在修復中受損，文化圈譁然！`);
      G.scandals += 1;
    }

    this.o.onDone({
      restore: Math.max(restore, -8),
      cost, grade, notes, hazardDays, hazardNote, decayMult,
      complete,
    });
  }

  // Esc 收工：帶走部分成果
  abort() { this.finish(false); }
}
