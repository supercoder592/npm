// UI：HUD、提示、館長手冊、晨報／晚間新聞／結局
import { G, RIVAL, SEASON_DAYS, DAY_LEN, fmtMoney, fameStars, clamp, avgQuality } from './state.js';
import { COSTS, buyHumidCase, startMarketing, outsourceRepair } from './economy.js';
import { catName } from './artifacts.js';
import { sndCash, beep } from './audio.js';

const $ = id => document.getElementById(id);

// ---------- HUD ----------
export function updateHUD() {
  $('hud-funds').textContent = `💰 ${fmtMoney(G.funds)}`;
  $('hud-day').textContent = G.endless ? `第 ${G.day} 天（無盡）` : `第 ${G.day}／${SEASON_DAYS} 天`;
  $('hud-clock-fill').style.width = `${clamp(G.dayT / DAY_LEN, 0, 1) * 100}%`;
  $('hud-visitors').textContent = `👥 ${G.visitorsToday}`;
  $('hud-pk').textContent = `北 ${Math.round(G.reputation)}｜南 ${Math.round(RIVAL.reputation)}`;
}

export function showHint(text) {
  const h = $('hint');
  if (!text) { h.classList.add('hidden'); return; }
  h.innerHTML = text;
  h.classList.remove('hidden');
}

let toastTimer = null;
export function showToast(html, duration = 0) {
  const t = $('toast');
  t.innerHTML = html;
  t.classList.remove('hidden');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  if (duration > 0) toastTimer = setTimeout(() => t.classList.add('hidden'), duration * 1000);
}
export function hideToast() { $('toast').classList.add('hidden'); }

// ---------- 通用彈窗 ----------
function openModal(title, bodyHTML, btnText, onClose) {
  document.exitPointerLock?.();   // 彈窗期間必須拿回滑鼠
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHTML;
  const btn = $('modal-btn');
  btn.textContent = btnText;
  btn.onclick = () => { $('modal').classList.add('hidden'); onClose && onClose(); };
  $('modal').classList.remove('hidden');
}

export function showIntro(onStart) {
  openModal('就任公文', `
    <p>敬啟者：</p>
    <p>前館長倉皇離任，留下三件待修文物與一館子的爛攤子。
    自即日起，由你——本院最資深的修復師——<b>兼任館長</b>。</p>
    <p>七天後的「雙十文化週」總評鑑，北院將與嘉義的<b>南部院區</b>正面對決：
    比觀光客、比收入、比聲望。輸了，我們的預算就是人家的了。</p>
    <p class="bad">健檢速報：毛公鼎鏽蝕嚴重（46）、汝窯水仙盆碎成八片（38）、快雪時晴帖霉斑擴散（41）。</p>
    <p>修文物的手，現在也要撥算盤了。祝　好運。</p>
    <p style="text-align:right">──國立故宮博物院 人事室</p>`,
    '開 館', onStart);
}

export function showMorning(lines, onStart) {
  openModal(`第 ${G.day} 天・開館前晨報`, `
    <h4>今日文物健檢與館務</h4>
    ${lines.length ? lines.map(l => `<div class="news-line">・${l}</div>`).join('') : '<div class="news-line">・一切如常。難得的平靜。</div>'}
    <h4>帳上資金</h4>
    <div class="news-line">$${fmtMoney(G.funds)}</div>`,
    '開 館', onStart);
}

function barRow(label, val, max, cls, suffix = '') {
  const w = max > 0 ? clamp(val / max, 0, 1) * 100 : 0;
  return `<div class="bar-row"><span class="bar-label">${label}</span>
    <span class="bar-track"><span class="bar-fill ${cls}" style="width:${w}%"></span></span>
    <span class="bar-val">${fmtMoney(val)}${suffix}</span></div>`;
}

export function showNews(s, onNext) {
  const maxV = Math.max(s.playerVisitors, s.rivalVisitors, 1);
  const maxR = Math.max(G.reputation, RIVAL.reputation, 1);
  const headline =
    s.news.find(n => n.kind === 'bad')?.text ||
    s.rivalEvents[0] ||
    s.news.find(n => n.kind === 'good')?.text ||
    (s.playerVisitors >= s.rivalVisitors ? '北院人氣穩坐龍頭，南院急起直追' : '南院來勢洶洶，北院老大哥挫著等？');

  const lead = G.reputation >= RIVAL.reputation;
  openModal(`第 ${s.day} 天・晚間新聞`, `
    <div style="text-align:center;font-size:17px;border:2px solid #d9a441;padding:8px;margin-bottom:10px">
      📺 頭條：${headline}
    </div>
    <h4>今日訪客</h4>
    ${barRow('北院', s.playerVisitors, maxV, 'north', ' 人')}
    ${barRow('南院', s.rivalVisitors, maxV, 'south', ' 人')}
    <h4>北院收支</h4>
    <div class="news-line">收入 <span class="good">+$${fmtMoney(s.playerIncome)}</span>　支出 <span class="bad">−$${fmtMoney(s.playerExpense)}</span>　（均品質 ${s.avgQ}・滿意度 ${Math.round(s.satAvg * 100)}%）</div>
    ${s.ethicLines.map(e => `<div class="news-line ${['S', 'A'].includes(e.grade) ? 'good' : ['C', 'F'].includes(e.grade) ? 'bad' : ''}">・${e.text}</div>`).join('')}
    ${s.news.map(n => `<div class="news-line ${n.kind}">・${n.text}</div>`).join('')}
    ${s.rivalEvents.map(t => `<div class="news-line">・${t}</div>`).join('')}
    <h4>累計聲望　${lead ? '<span class="good">北院領先</span>' : '<span class="bad">南院領先</span>'}</h4>
    ${barRow('北院', Math.round(G.reputation), maxR, 'north')}
    ${barRow('南院', Math.round(RIVAL.reputation), maxR, 'south')}
    <div class="news-line" style="margin-top:8px;color:#b0a080">🕵 ${s.intel}</div>`,
    s.seasonEnd ? '總 結 算' : '就 寢', onNext);
}

export function showSeasonEnd(onEndless) {
  const p = Math.round(G.reputation), r = Math.round(RIVAL.reputation);
  let title, body;
  if (G.scandals >= 3) {
    title = '結局：黯然去職';
    body = `<p class="bad">一季之內連爆 ${G.scandals} 起文物受損醜聞，文化部震怒。你被撤除館長兼職，修復師執照送懲戒審議。</p>`;
  } else if (p > r * 1.3) {
    title = '結局：升任總院長';
    body = `<p class="good">北院聲望 ${p} 對南院 ${r}，壓倒性勝利！雙十文化週上，你以修復師之手撐起整個院區。董事會全票通過——請你出任總院長。</p>`;
  } else if (p >= r) {
    title = '結局：連任館長';
    body = `<p class="good">北院聲望 ${p}，險勝南院的 ${r}。評鑑委員在報告上寫著：「修復與經營，難得兩全。」你繼續兼任下去——雖然沒人幫你加薪。</p>`;
  } else if (p >= r * 0.7) {
    title = '結局：留院察看';
    body = `<p class="bad">南院以 ${r} 對 ${p} 勝出。預算被砍了三成，你回到修復室，看著工作檯發呆。明年，再來。</p>`;
  } else {
    title = '結局：撤職查辦';
    body = `<p class="bad">${r} 對 ${p}，一面倒的敗局。北院被要求「向南院學習經營」。你收拾工具箱離開的那天，翠玉白菜在櫃子裡，好像也蔫了。</p>`;
  }
  openModal(title, `${body}
    <p style="margin-top:10px;color:#b0a080;font-size:13px">最終數據：訪客累計聲望 北 ${p}／南 ${r}・資金 $${fmtMoney(G.funds)}・館藏均品質 ${Math.round(avgQuality(G.artifacts))}・醜聞 ${G.scandals} 起</p>`,
    '繼續經營（無盡模式）', onEndless);
}

// ---------- 館長手冊 ----------
let menuTab = 'collection';

export function openMenu() {
  $('menu').classList.remove('hidden');
  renderMenu();
}
export function closeMenu() { $('menu').classList.add('hidden'); }
export function menuVisible() { return !$('menu').classList.contains('hidden'); }

export function initMenu() {
  for (const b of document.querySelectorAll('.tab-btn')) {
    b.onclick = () => {
      menuTab = b.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(x => x.classList.toggle('active', x === b));
      renderMenu();
    };
  }
}

function artifactState(a) {
  if (a === G.benchArtifact) return '🔧 修復中';
  if (a === G.carrying) return '📦 搬運中';
  if (G.outsourceQueue.includes(a)) return '🚚 已委外';
  if (a.offDisplay) return '⛔ 強制下架';
  if (a.broken) return '💔 碎裂';
  if (!a.pedestal) return '庫房';
  return a.pedestal.golden ? '★黃金展位' : '展出中';
}

function renderMenu() {
  const body = $('menu-body');
  if (menuTab === 'collection') {
    body.innerHTML = G.artifacts.map((a, i) => `
      <div class="art-row">
        <span class="art-name">${a.name}<br><span style="font-size:11px;color:#9a8a68">${catName(a.cat)}・劣化 ${a.decay.toFixed(1)}/日</span></span>
        <span class="art-star">${'★'.repeat(fameStars(a.fame))}</span>
        <span class="q-track"><span class="q-fill" style="width:${clamp(a.q, 0, 100)}%;background:${a.q >= 70 ? '#7fc76f' : a.q >= 40 ? '#d9a441' : '#e06c5a'}"></span></span>
        <span class="art-q">${Math.round(a.q)}</span>
        <span class="art-flag">${artifactState(a)}</span>
        <button class="px-btn small" data-out="${i}" ${G.funds < COSTS.outsource || G.outsourceQueue.includes(a) || a === G.carrying || a === G.benchArtifact ? 'disabled' : ''}>委外</button>
      </div>`).join('') + `
      <div style="font-size:12px;color:#9a8a68;margin-top:6px">
      委外修復 $${fmtMoney(COSTS.outsource)}／件：明早品質 +25，不經你手、無倫理評分。鎮館之寶還是自己修吧。<br>
      提示：相鄰展位擺同類文物可觸發「主題展」加成（吸引力 +15%）。</div>`;
    body.querySelectorAll('[data-out]').forEach(b => {
      b.onclick = () => { if (outsourceRepair(G.artifacts[+b.dataset.out])) { sndCash(); renderMenu(); } };
    });
  } else if (menuTab === 'manage') {
    body.innerHTML = `
      <div class="manage-block">
        <h4>門票定價：$<span id="tk-val">${G.ticket}</span></h4>
        <input type="range" id="tk-slider" min="50" max="300" step="10" value="${G.ticket}">
        <div class="desc">150 元為基準；每 +50 元，來客意願 ×0.88。薄利多銷或精品路線，你決定。</div>
      </div>
      <div class="manage-block">
        <h4>行銷檔期　$${fmtMoney(COSTS.marketing)}／3 天</h4>
        <button class="px-btn small" id="mk-btn" ${G.marketingDays > 0 || G.funds < COSTS.marketing ? 'disabled' : ''}>
          ${G.marketingDays > 0 ? `檔期中（剩 ${G.marketingDays} 天）` : '投放廣告'}</button>
        <div class="desc">檔期內每日來客 +50%。廣告費是流水，文物才是根本——吧？</div>
      </div>
      <div class="manage-block">
        <h4>恆濕展櫃（全館）　$${fmtMoney(COSTS.humidCase)}</h4>
        <button class="px-btn small" id="hc-btn" ${G.humidCase || G.funds < COSTS.humidCase ? 'disabled' : ''}>
          ${G.humidCase ? '已安裝 ✓' : '採購安裝'}</button>
        <div class="desc">全館劣化速度 −30%。書畫尤其受益（它們爛得最快）。</div>
      </div>`;
    $('tk-slider').oninput = e => {
      G.ticket = +e.target.value;
      $('tk-val').textContent = G.ticket;
    };
    $('mk-btn').onclick = () => { if (startMarketing()) { beep(880, 0.1); renderMenu(); } };
    $('hc-btn').onclick = () => { if (buyHumidCase()) { sndCash(); renderMenu(); } };
  } else {
    const p = Math.round(G.reputation), r = Math.round(RIVAL.reputation);
    const maxR = Math.max(p, r, 1);
    body.innerHTML = `
      <h4 style="color:#d9a441">南北院聲望戰</h4>
      ${barRow('北院(你)', p, maxR, 'north')}
      ${barRow('南院', r, maxR, 'south')}
      <div style="margin:8px 0;font-size:13px">${p >= r ? '<span class="good">目前由北院領先。</span>' : '<span class="bad">南院領先中——把文物修好，把客人搶回來。</span>'}
      第 ${SEASON_DAYS} 天閉館後總結算，聲望高者勝。</div>
      <h4 style="color:#d9a441">南院情報（僅供參考）</h4>
      ${RIVAL.arts.map(a => `<div class="news-line">・「${a.name}」狀態${a.q >= 75 ? '良好' : a.q >= 50 ? '普通' : '<span class="good">堪憂——它們也在痛</span>'}</div>`).join('')}
      <div class="news-line">・南院帳上資金：${RIVAL.funds > 40000 ? '充裕' : RIVAL.funds > 20000 ? '普通' : '吃緊'}</div>
      <div class="news-line">・${RIVAL.humidCase ? '南院已裝設恆濕設備' : '南院尚未升級展櫃'}</div>
      <div style="margin-top:10px;font-size:12px;color:#9a8a68">聲望＝每日訪客/10＋均品質×0.5＋滿意度加成＋修復倫理評分。醜聞 3 次直接敗北。</div>`;
  }
}
