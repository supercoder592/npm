// 日循環與經營：晨間處理、閉館結算、投資動作
import { G, RIVAL, SEASON_DAYS, dailyRep, avgQuality, clamp, pushNews, fmtMoney } from './state.js';
import { checkHazards } from './artifacts.js';
import { rivalDay, rivalIntel } from './rival.js';

export const COSTS = {
  humidCase: 12000,
  marketing: 2000,
  outsource: 3000,
};

// 開館前處理：委外完工、隱患引爆。回傳晨報段落（HTML 字串陣列）
export function beginDay() {
  const lines = [];
  G.dayT = 0;
  G.visitorsToday = 0; G.incomeToday = 0; G.expenseToday = 0;
  G.satSum = 0; G.satCount = 0;
  G.repToday = 0;

  // 委外修復完工
  for (const a of G.outsourceQueue) {
    a.q = clamp(a.q + 25, 0, 100);
    lines.push(`<span class="good">委外修復完工：「${a.name}」品質 +25（現況 ${Math.round(a.q)}）</span>`);
  }
  G.outsourceQueue = [];

  // 隱患引爆
  for (const a of checkHazards()) {
    lines.push(`<span class="bad">⚠ 修復隱患爆發：「${a.name}」品質重挫 −25！當初省下的材料費，今天連本帶利討回來了。</span>`);
  }

  // 健檢警示
  const worst = [...G.artifacts].sort((x, y) => x.q - y.q);
  for (const a of worst.slice(0, 3)) {
    if (a.q < 40) lines.push(`<span class="bad">健檢警戒：「${a.name}」品質 ${Math.round(a.q)}，${a.q < 20 ? '已強制下架' : '媒體已在觀望'}</span>`);
    else if (a.q < 60) lines.push(`健檢提醒：「${a.name}」品質 ${Math.round(a.q)}，建議安排修復`);
  }
  if (G.marketingDays > 0) lines.push(`行銷檔期進行中（剩 ${G.marketingDays} 天），今日來客 +50%`);
  return lines;
}

// 閉館結算：計玩家聲望、跑南院模擬。回傳結算資料
export function endDay() {
  const satAvg = G.satCount ? G.satSum / G.satCount : 0.5;
  G.moodHistory.push(satAvg);
  const avgQ = avgQuality(G.artifacts);

  let rep = dailyRep(G.visitorsToday, avgQ, satAvg);
  // 倫理評分轉聲望
  const ETHIC_REP = { S: 15, A: 8, B: 3, C: 0, F: -10 };
  const ethicLines = [];
  for (const e of G.ethicsLog) {
    rep += ETHIC_REP[e.grade] ?? 0;
    ethicLines.push({ grade: e.grade, text: `修復評鑑：「${e.name}」倫理評分 ${e.grade}（聲望 ${ETHIC_REP[e.grade] >= 0 ? '+' : ''}${ETHIC_REP[e.grade]}）` });
  }
  G.ethicsLog = [];
  if (G.marketingDays > 0) G.marketingDays -= 1;

  G.repToday = Math.round(rep);
  G.reputation += G.repToday;

  const rival = rivalDay();
  const settlement = {
    day: G.day,
    playerVisitors: G.visitorsToday,
    playerIncome: G.incomeToday,
    playerExpense: G.expenseToday,
    playerRepToday: G.repToday,
    avgQ: Math.round(avgQ),
    satAvg,
    ethicLines,
    news: [...G.newsQueue],
    rivalEvents: rival.events,
    rivalVisitors: RIVAL.visitorsToday,
    rivalRepToday: RIVAL.repToday,
    intel: rivalIntel(),
    seasonEnd: !G.endless && G.day >= SEASON_DAYS,
  };
  G.newsQueue = [];
  return settlement;
}

// ---- 投資動作（館長手冊呼叫） ----
export function buyHumidCase() {
  if (G.humidCase || G.funds < COSTS.humidCase) return false;
  G.funds -= COSTS.humidCase; G.expenseToday += COSTS.humidCase;
  G.humidCase = true;
  pushNews('good', '北院添購恆濕展櫃，全館劣化速度 −30%');
  return true;
}

export function startMarketing() {
  if (G.marketingDays > 0 || G.funds < COSTS.marketing) return false;
  G.funds -= COSTS.marketing; G.expenseToday += COSTS.marketing;
  G.marketingDays = 3;
  pushNews('good', '北院行銷檔期開跑（3 天），明起來客 +50%');
  return true;
}

export function outsourceRepair(a) {
  if (G.funds < COSTS.outsource || G.outsourceQueue.includes(a)) return false;
  if (a === G.carrying || a === G.benchArtifact) return false;
  G.funds -= COSTS.outsource; G.expenseToday += COSTS.outsource;
  G.outsourceQueue.push(a);
  return true;
}

export function spend(amount) {
  G.funds -= amount;
  G.expenseToday += amount;
}

export function fundsText() { return fmtMoney(G.funds); }
