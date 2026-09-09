// 南院 AI：同公式的數值模擬體（切片版：均衡型館長）
import { G, RIVAL, RUBBER_BAND, ticketElasticity, dailyRep, avgQuality, clamp } from './state.js';

const R_TICKET = 150;
const REPAIR_COST_PER_PT = 40;   // 每恢復 1 點品質花費
const REPAIR_PTS_PER_DAY = 26;   // 南院修復量能／日

function rivalAppeal() {
  let sum = 0;
  for (const a of RIVAL.arts) {
    if (a.q < 20) continue;
    sum += a.fame * Math.pow(a.q / 100, 1.2);
  }
  return sum;
}

// 每日決策 + 結算，回傳今日南院大事（給晚間新聞與情報）
export function rivalDay() {
  const events = [];

  // 1. 劣化
  for (const a of RIVAL.arts) {
    a.q = clamp(a.q - a.decay * (RIVAL.humidCase ? 0.7 : 1.0), 0, 100);
  }

  // 2. 決策：修復優先（均衡型），行有餘力買設備/行銷
  let pts = REPAIR_PTS_PER_DAY;
  const byQ = [...RIVAL.arts].sort((x, y) => x.q - y.q);
  for (const a of byQ) {
    if (pts <= 0) break;
    if (a.q >= 88) continue;
    const need = Math.min(pts, 92 - a.q);
    const cost = need * REPAIR_COST_PER_PT;
    if (RIVAL.funds < cost) break;
    a.q = clamp(a.q + need, 0, 100);
    RIVAL.funds -= cost;
    pts -= need;
    if (need >= 15) events.push(`南院完成「${a.name}」大修，狀態回穩`);
  }
  if (!RIVAL.humidCase && RIVAL.funds > 26000 && G.day >= 3) {
    RIVAL.humidCase = true;
    RIVAL.funds -= 12000;
    events.push('南院添購恆濕展櫃，館藏劣化趨緩');
  } else if (RIVAL.marketingDays <= 0 && RIVAL.funds > 15000 && Math.random() < 0.45) {
    RIVAL.marketingDays = 3;
    RIVAL.funds -= 2000;
    events.push('南院發起行銷檔期，遊覽車一輛接一輛');
  }
  if (RIVAL.marketingDays > 0) RIVAL.marketingDays -= 1;

  // 3. 訪客與收入（同玩家公式 + 亂數）
  const marketing = RIVAL.marketingDays > 0 ? 1.5 : 1.0;
  const rubber = (RUBBER_BAND && RIVAL.reputation < G.reputation) ? 1.08 : 1.0;
  const baseVisitors = 45 * (rivalAppeal() / 440) * ticketElasticity(R_TICKET) * marketing * rubber;
  RIVAL.visitorsToday = Math.max(0, Math.round(baseVisitors * (0.85 + Math.random() * 0.3)));
  const satAvg = clamp(avgQuality(RIVAL.arts) / 100, 0, 1);
  const income = RIVAL.visitorsToday * R_TICKET + Math.round(RIVAL.visitorsToday * satAvg * 45);
  RIVAL.funds += income;

  // 4. 聲望
  RIVAL.repToday = Math.round(dailyRep(RIVAL.visitorsToday, avgQuality(RIVAL.arts), satAvg));
  RIVAL.reputation += RIVAL.repToday;

  return { events, income };
}

// 明日動向模糊情報（給晚間新聞尾巴）
export function rivalIntel() {
  const lowest = [...RIVAL.arts].sort((x, y) => x.q - y.q)[0];
  const pool = [
    `情報：南院修復室連夜亮燈，疑似在搶救「${lowest.name}」`,
    RIVAL.marketingDays > 0 ? '情報：南院行銷檔期未歇，明日恐再搶走大批陸客團' : '情報：南院行銷部門近日按兵不動',
    RIVAL.funds > 40000 ? '情報：南院資金充裕，恐有大動作' : '情報：南院近期開銷頗大，帳上吃緊',
  ];
  return pool[(Math.random() * pool.length) | 0];
}
