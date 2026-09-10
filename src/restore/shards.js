// 陶瓷拼接：碎片拖曳＋旋轉＋相鄰順序 → 黏合劑 → 全色
import { G, pushNews } from '../state.js';
import { sndSnap, sndDamage, beep } from '../audio.js';

const W = 860, H = 520, CX = 430, CY = 268, R = 128;
const N = 8;

function angNorm(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class ShardsGame {
  /** opts: { artifact, onDone(result), setFoot(html), setPhase(text) } */
  constructor(canvas, opts) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.o = opts;
    this.phase = 'assemble';
    this.glue = null;
    this.tintL = 40;
    this.done = false;
    this.msg = ''; this.msgT = 0;

    // 邊界折線：N 條放射狀鋸齒邊（相鄰碎片共用 → 斷面吻合）
    const bounds = [];
    for (let i = 0; i < N; i++) {
      const ang = i * Math.PI * 2 / N + (Math.random() - 0.5) * 0.18;
      const jit = [0, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, 0];
      bounds.push({ ang, jit });
    }
    // 碎片多邊形（以圓心為原點）
    this.pieces = [];
    for (let i = 0; i < N; i++) {
      const b1 = bounds[i], b2 = bounds[(i + 1) % N];
      const poly = [];
      // 內心點
      poly.push([Math.cos(b1.ang) * 18, Math.sin(b1.ang) * 18]);
      // 邊 1 往外（含鋸齒）
      for (let k = 1; k <= 2; k++) {
        const t = 18 + (R - 18) * k / 3;
        const px = Math.cos(b1.ang) * t - Math.sin(b1.ang) * b1.jit[k];
        const py = Math.sin(b1.ang) * t + Math.cos(b1.ang) * b1.jit[k];
        poly.push([px, py]);
      }
      poly.push([Math.cos(b1.ang) * R, Math.sin(b1.ang) * R]);
      // 外弧
      for (let k = 1; k <= 3; k++) {
        const a = b1.ang + angNorm(b2.ang - b1.ang) * k / 4;
        poly.push([Math.cos(a) * R, Math.sin(a) * R]);
      }
      poly.push([Math.cos(b2.ang) * R, Math.sin(b2.ang) * R]);
      // 邊 2 往內
      for (let k = 2; k >= 1; k--) {
        const t = 18 + (R - 18) * k / 3;
        const px = Math.cos(b2.ang) * t - Math.sin(b2.ang) * b2.jit[k];
        const py = Math.sin(b2.ang) * t + Math.cos(b2.ang) * b2.jit[k];
        poly.push([px, py]);
      }
      poly.push([Math.cos(b2.ang) * 18, Math.sin(b2.ang) * 18]);

      // 質心（散置用）
      let cx = 0, cy = 0;
      for (const [px, py] of poly) { cx += px; cy += py; }
      cx /= poly.length; cy /= poly.length;

      this.pieces.push({
        idx: i, poly, cx, cy,
        x: 110 + (i % 4) * 180 + (Math.random() - 0.5) * 40,
        y: (i < 4 ? 80 : 452) + (Math.random() - 0.5) * 30,
        rot: Math.random() * Math.PI * 2,
        placed: false,
        shade: 0.9 + Math.random() * 0.15,
      });
    }
    this.drag = null;
    this.sel = null;         // 觸控：點選碎片後可用旋轉鈕
    this.dragId = null;
    this.mouse = { x: 0, y: 0 };

    this._down = e => this.onDown(e);
    this._up = e => this.onUp(e);
    this._move = e => this.onMove(e);
    this._wheel = e => { e.preventDefault(); this.rotate(e.deltaY > 0 ? 1 : -1); };
    this._key = e => {
      if (G.mode !== 'bench') return;
      if (e.code === 'KeyQ') this.rotate(-1);
      if (e.code === 'KeyE') this.rotate(1);
    };
    canvas.addEventListener('pointerdown', this._down);
    window.addEventListener('pointerup', this._up);
    canvas.addEventListener('pointermove', this._move);
    canvas.addEventListener('wheel', this._wheel, { passive: false });
    window.addEventListener('keydown', this._key);
    this.refreshFoot();
  }

  destroy() {
    this.cv.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointerup', this._up);
    this.cv.removeEventListener('pointermove', this._move);
    this.cv.removeEventListener('wheel', this._wheel);
    window.removeEventListener('keydown', this._key);
  }

  canvasPos(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }

  // 點是否在碎片內（世界座標）
  hitPiece(p, pc) {
    const cos = Math.cos(-pc.rot), sin = Math.sin(-pc.rot);
    const lx0 = p.x - pc.x, ly0 = p.y - pc.y;
    const lx = lx0 * cos - ly0 * sin + pc.cx;
    const ly = lx0 * sin + ly0 * cos + pc.cy;
    let inside = false;
    const poly = pc.poly;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > ly) !== (yj > ly) && lx < (xj - xi) * (ly - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  onDown(e) {
    if (e.button !== 0 || this.phase !== 'assemble' || this.drag) return;
    const p = this.canvasPos(e);
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const pc = this.pieces[i];
      if (pc.placed) continue;
      if (this.hitPiece(p, pc)) {
        this.drag = { pc, ox: p.x - pc.x, oy: p.y - pc.y };
        this.dragId = e.pointerId;
        this.sel = pc;
        // 拉到最上層
        this.pieces.splice(i, 1); this.pieces.push(pc);
        return;
      }
    }
  }

  onMove(e) {
    if (this.drag && e.pointerId !== this.dragId) return; // 多指：只跟主指
    this.mouse = this.canvasPos(e);
    if (this.drag) {
      this.drag.pc.x = this.mouse.x - this.drag.ox;
      this.drag.pc.y = this.mouse.y - this.drag.oy;
    }
  }

  rotate(dir) {
    const pc = this.drag ? this.drag.pc : this.sel;
    if (!pc || pc.placed) return;
    pc.rot += dir * Math.PI / 18;
    if (!this.drag) this.trySnap(pc); // 放著旋轉到位也能咬合
  }

  adjacentOK(pc) {
    const placed = this.pieces.filter(p => p.placed);
    if (!placed.length) return true;
    return placed.some(p => Math.abs(p.idx - pc.idx) === 1 || Math.abs(p.idx - pc.idx) === N - 1);
  }

  onUp(e) {
    if (!this.drag || e.pointerId !== this.dragId) return;
    const pc = this.drag.pc;
    this.drag = null;
    this.dragId = null;
    this.trySnap(pc);
  }

  trySnap(pc) {
    // 未拼合碎片以質心為原點繪製 → 質心世界位置即 (pc.x, pc.y)
    // 目標：質心對上 (CX+cx, CY+cy)，且旋轉歸零
    const tx = CX + pc.cx, ty = CY + pc.cy;
    const dist = Math.hypot(pc.x - tx, pc.y - ty);
    const angOff = Math.abs(angNorm(pc.rot));
    if (dist < 26 && angOff < 0.28) {
      if (!this.adjacentOK(pc)) {
        this.msg = '斷面對不上——碎瓷要從相鄰的一片接下去（拼接順序！）';
        this.msgT = 2.2;
        sndDamage();
        pc.x += 46; pc.y += 24;
        return;
      }
      pc.placed = true; pc.x = CX; pc.y = CY; pc.rot = 0;
      if (this.sel === pc) this.sel = null;
      sndSnap();
      this.refreshFoot();
      if (this.pieces.every(p => p.placed)) { this.phase = 'glue'; this.refreshFoot(); }
    }
  }

  placedCount() { return this.pieces.filter(p => p.placed).length; }

  refreshFoot() {
    const f = this.o.setFoot, ph = this.o.setPhase;
    if (this.phase === 'assemble') {
      ph('工序 1／3：拼接復位 — 拖曳碎片至中央虛線圓，旋轉到位、斷面吻合會自動咬合。從相鄰碎片依序拼！');
      f(`已拼合 <b>${this.placedCount()}</b> ／ ${N} 片
         <button class="px-btn small" id="sh-ccw">⟲ 左旋 (Q)</button>
         <button class="px-btn small" id="sh-cw">⟳ 右旋 (E)</button>
         <span style="font-size:12px;color:#9a8a68">點選碎片後旋轉；滑鼠亦可用滾輪</span>`);
      document.getElementById('sh-ccw').onclick = () => this.rotate(-1);
      document.getElementById('sh-cw').onclick = () => this.rotate(1);
    } else if (this.phase === 'glue') {
      ph('工序 2／3：黏合 — 碎片全數歸位。選擇黏合劑（前輩的忠告：便宜的膠，貴的教訓）。');
      f(`<button class="px-btn small" id="gl-b72">Paraloid B-72（$800・可逆）</button>
         <button class="px-btn small" id="gl-cheap">快乾膠（$150・不可逆…）</button>`);
      document.getElementById('gl-b72').onclick = () => { this.glue = 'b72'; this.phase = 'tint'; beep(880, 0.08); this.refreshFoot(); };
      document.getElementById('gl-cheap').onclick = () => { this.glue = 'cheap'; this.phase = 'tint'; beep(330, 0.12, 'triangle'); this.refreshFoot(); };
    } else if (this.phase === 'tint') {
      ph('工序 3／3：全色 — 為接縫補色。修復倫理要求「遠看一致、近看可辨」：比原色【略淺】才是正解。');
      f(`原色　<span style="display:inline-block;width:40px;height:20px;background:hsl(174,25%,66%);border:1px solid #888;vertical-align:middle"></span>
         　補色　<span id="tint-sw" style="display:inline-block;width:40px;height:20px;background:hsl(174,25%,${this.tintL}%);border:1px solid #888;vertical-align:middle"></span>
         <input type="range" id="tint-sl" min="30" max="72" value="${this.tintL}">
         <button class="px-btn small" id="tint-ok">上色定案</button>`);
      const sl = document.getElementById('tint-sl');
      sl.oninput = () => {
        this.tintL = +sl.value;
        document.getElementById('tint-sw').style.background = `hsl(174,25%,${this.tintL}%)`;
      };
      document.getElementById('tint-ok').onclick = () => this.finish(true);
    }
  }

  update(dt) {
    if (this.done) return;
    this.msgT = Math.max(0, this.msgT - dt);
    this.draw();
  }

  drawPiece(pc, fill) {
    const g = this.g;
    g.save();
    g.translate(pc.x, pc.y);
    g.rotate(pc.rot);
    g.beginPath();
    pc.poly.forEach(([px, py], i) => {
      const ox = pc.placed ? 0 : pc.cx, oy = pc.placed ? 0 : pc.cy;
      i === 0 ? g.moveTo(px - ox, py - oy) : g.lineTo(px - ox, py - oy);
    });
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = pc.placed ? 'rgba(60,90,86,.8)' : (pc === this.sel ? '#ffd94a' : '#5a4830');
    g.lineWidth = pc === this.sel && !pc.placed ? 3 : 2;
    g.stroke();
    g.restore();
  }

  draw() {
    const g = this.g;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#2a2622'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#3a4a3a'; g.fillRect(30, 30, W - 60, H - 60);

    // 目標輪廓
    g.setLineDash([8, 6]);
    g.strokeStyle = 'rgba(240,230,210,.4)'; g.lineWidth = 2;
    g.beginPath(); g.arc(CX, CY, R, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);

    // 已就位碎片（位於圓心，poly 直接以圓心為原點）
    for (const pc of this.pieces) {
      if (pc.placed) this.drawPiece(pc, `hsl(174,25%,${66 * pc.shade}%)`);
    }
    // 接縫全色預覽
    if (this.phase === 'tint' || (this.done && this.glue)) {
      g.save();
      g.translate(CX, CY);
      g.strokeStyle = `hsl(174,25%,${this.tintL}%)`;
      g.lineWidth = 5;
      for (const pc of this.pieces) {
        g.beginPath();
        g.moveTo(pc.poly[0][0], pc.poly[0][1]);
        for (let k = 1; k <= 3; k++) g.lineTo(pc.poly[k][0], pc.poly[k][1]);
        g.stroke();
      }
      g.restore();
    }
    // 散落碎片（原點=質心）
    for (const pc of this.pieces) {
      if (!pc.placed) this.drawPiece(pc, `hsl(174,22%,${58 * pc.shade}%)`);
    }

    if (this.msgT > 0) {
      g.fillStyle = 'rgba(20,14,10,.9)';
      g.fillRect(CX - 240, 6, 480, 34);
      g.fillStyle = '#e06c5a'; g.font = '16px "Microsoft JhengHei", sans-serif';
      g.textAlign = 'center';
      g.fillText(this.msg, CX, 28);
    }
  }

  finish(complete) {
    if (this.done) return;
    this.done = true;
    const a = this.o.artifact;
    const frac = this.placedCount() / N;
    let restore = 48 * frac;
    let cost = 150; // 基礎材料
    const notes = [];
    let hazardDays = 0, hazardNote = '';
    let grade = null;

    if (complete) {
      if (this.glue === 'b72') { cost += 800; notes.push('B-72 黏合：可逆，教科書等級'); }
      else { cost += 150; hazardDays = 4; hazardNote = '黏合面崩開'; notes.push('快乾膠黏合：不可逆，遲早出事'); }

      const dL = 66 - this.tintL; // 比原色淺多少
      let pen = this.glue === 'cheap' ? 4 : 0;
      if (Math.abs(dL) <= 3) {
        pen += 3;
        notes.push('全色與原色無法辨識——專家評鑑記「作偽嫌疑」');
        pushNews('bad', `爭議：「${a.name}」修復處與原件難以辨識，學界質疑作偽`);
      } else if (dL >= 4 && dL <= 16) {
        notes.push('全色略淺、可辨識——完美符合修復倫理');
        restore += 4;
      } else {
        pen += 1;
        notes.push('補色過淺，遠看突兀（扣觀感）');
        restore -= 3;
      }
      grade = pen <= 0 ? 'S' : pen === 1 ? 'A' : pen <= 3 ? 'B' : pen <= 5 ? 'C' : 'F';
    } else {
      notes.push(`拼接中途收工（${this.placedCount()}／${N} 片）`);
      restore *= 0.6; // 未黏合的拼合不穩
    }

    this.o.onDone({
      restore, cost, grade, notes, hazardDays, hazardNote, decayMult: 1,
      complete,
      fixedBroken: complete,
    });
  }

  abort() { this.finish(false); }
}
