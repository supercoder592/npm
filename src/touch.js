// 觸控支援：虛擬搖桿、視角拖曳、動作按鈕（pointer: coarse 裝置自動啟用）
export const touch = {
  active: false,
  moveX: 0, moveY: 0,   // 搖桿向量（-1..1；Y 負 = 前進）
  lookDX: 0, lookDY: 0, // 本幀視角增量（消費後歸零）
};

export function consumeLook() {
  const dx = touch.lookDX, dy = touch.lookDY;
  touch.lookDX = 0; touch.lookDY = 0;
  return [dx, dy];
}

export function initTouch({ onInteract, onCarry, onMenu }) {
  const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (!coarse) return;
  touch.active = true;
  document.body.classList.add('touch');

  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  ui.innerHTML = `
    <div id="joy"><div id="joy-knob"></div></div>
    <div id="look-zone"></div>
    <button class="touch-btn" id="tb-e">互動<br>E</button>
    <button class="touch-btn" id="tb-r">搬/放<br>R</button>
    <button class="touch-btn small-tb" id="tb-menu">手冊</button>`;
  document.getElementById('game-root').appendChild(ui);

  // --- 搖桿 ---
  const joy = document.getElementById('joy');
  const knob = document.getElementById('joy-knob');
  let joyId = null, joyCX = 0, joyCY = 0;
  const R = 46;
  joy.addEventListener('pointerdown', e => {
    joyId = e.pointerId;
    const r = joy.getBoundingClientRect();
    joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
    joy.setPointerCapture(e.pointerId);
    moveKnob(e);
    e.preventDefault();
  });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) moveKnob(e); });
  const joyEnd = e => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    touch.moveX = 0; touch.moveY = 0;
    knob.style.transform = 'translate(0,0)';
  };
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);
  function moveKnob(e) {
    let dx = e.clientX - joyCX, dy = e.clientY - joyCY;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    touch.moveX = dx / R; touch.moveY = dy / R;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  }

  // --- 視角拖曳 ---
  const look = document.getElementById('look-zone');
  let lookId = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', e => {
    lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    look.setPointerCapture(e.pointerId);
  });
  look.addEventListener('pointermove', e => {
    if (e.pointerId !== lookId) return;
    touch.lookDX += e.clientX - lx;
    touch.lookDY += e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
  });
  const lookEnd = e => { if (e.pointerId === lookId) lookId = null; };
  look.addEventListener('pointerup', lookEnd);
  look.addEventListener('pointercancel', lookEnd);

  // --- 動作按鈕 ---
  document.getElementById('tb-e').addEventListener('click', onInteract);
  document.getElementById('tb-r').addEventListener('click', onCarry);
  document.getElementById('tb-menu').addEventListener('click', onMenu);

  return ui;
}

// 依模式顯示/隱藏觸控 UI（主迴圈呼叫）
export function updateTouchUI(mode) {
  if (!touch.active) return;
  const ui = document.getElementById('touch-ui');
  if (ui) ui.classList.toggle('hidden', mode !== 'walk');
}
