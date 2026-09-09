// 全域遊戲狀態與常數（單一來源，各模組共享）

export const DAY_LEN = 300;        // 開館時段長度（秒）
export const SEASON_DAYS = 7;      // 一季天數
export const TICKET_DEFAULT = 150;

export const G = {
  mode: 'title',        // title | walk | bench | menu | modal
  paused: true,         // 暫停時不走日循環與劣化
  day: 1,
  dayT: 0,              // 本日已經過秒數
  endless: false,
  gameOver: false,

  funds: 50000,
  ticket: TICKET_DEFAULT,
  reputation: 0,
  repToday: 0,
  visitorsToday: 0,
  incomeToday: 0,
  expenseToday: 0,
  satSum: 0,            // 今日滿意度累計
  satCount: 0,
  moodHistory: [0.75],  // 前幾日滿意度均值 → 口碑係數

  marketingDays: 0,     // 行銷檔期剩餘天數
  humidCase: false,     // 恆濕展櫃（全館劣化 -30%）
  outsourceQueue: [],   // 委外修復：隔日早上生效的文物 id
  scandals: 0,
  ethicsLog: [],        // 每次修復的倫理評分（結算時轉聲望）
  newsQueue: [],        // 今日事件 → 晚間新聞

  carrying: null,       // 手上搬著的文物（artifact 物件）
  tutorialStep: 0,

  artifacts: [],        // 由 artifacts.js 填入
  pedestals: [],        // 由 world.js 填入
};

// 南院（數值模擬體）
export const RIVAL = {
  funds: 50000,
  reputation: 0,
  repToday: 0,
  visitorsToday: 0,
  humidCase: false,
  marketingDays: 0,
  arts: [
    { name: '龍藏經',       fame: 80, q: 80, decay: 2.0 },
    { name: '青花穿蓮龍紋執壺', fame: 80, q: 82, decay: 1.0 },
    { name: '戰國嵌綠松石方豆', fame: 80, q: 75, decay: 1.4 },
    { name: '亞洲織品收藏',   fame: 55, q: 78, decay: 2.0 },
    { name: '高麗青瓷梅瓶',   fame: 55, q: 74, decay: 1.0 },
  ],
};

export const RUBBER_BAND = true; // 落後方 +8% 來客

export function fameStars(fame) {
  return fame >= 110 ? 5 : fame >= 80 ? 4 : fame >= 55 ? 3 : fame >= 35 ? 2 : 1;
}

export function fmtMoney(n) { return Math.round(n).toLocaleString('zh-Hant'); }

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// 文物吸引力（GDD 11.2）
export function artifactAppeal(a) {
  if (a.q < 20 || a.offDisplay || !a.pedestal) return 0; // 強制下架 / 搬離展位
  const ped = a.pedestal.golden ? 1.3 : 1.0;
  return a.fame * Math.pow(a.q / 100, 1.2) * ped * (a.themeBonus || 1);
}

export function hallAppeal(state) {
  let sum = 0;
  for (const a of state.artifacts) sum += artifactAppeal(a);
  return sum;
}

// 票價彈性：150 = 1.0，每 +50 ×0.88
export function ticketElasticity(ticket) {
  return Math.pow(0.88, (ticket - TICKET_DEFAULT) / 50);
}

// 每日聲望
export function dailyRep(visitors, avgQ, satAvg) {
  return visitors / 10 + avgQ * 0.5 + satAvg * 10;
}

export function avgQuality(arts) {
  if (!arts.length) return 0;
  return arts.reduce((s, a) => s + a.q, 0) / arts.length;
}

// 簡易事件匯流排
const listeners = {};
export function on(ev, fn) { (listeners[ev] ||= []).push(fn); }
export function emit(ev, data) { for (const fn of listeners[ev] || []) fn(data); }

export function pushNews(kind, text) { G.newsQueue.push({ kind, text }); }
