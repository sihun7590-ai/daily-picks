/**
 * 차트프로 초급 40개 + 중급 22개 강의를 숫자 규칙으로 옮긴 것.
 *
 * 강사는 "차트는 계산이 아니라 감각의 영역"이라고 말하고 숫자 기준을 일부러 주지 않는다.
 * 그래서 아래 임계값은 강의 내용이 아니라 강의를 읽고 정한 판단이다. 값을 바꾸면
 * `RULES_VERSION`을 올린다 — 지난 기록과 "기준이 달라진 것"을 구분할 수 있어야 한다.
 *
 * 이 파일은 순수 함수만 둔다. fetch·파일 접근 금지.
 * 모든 판단은 t 시점까지의 봉만 본다 (test/rules.test.ts가 미래 참조를 검사한다).
 */
import type { Analysis, Bar, BaseInfo, Levels, ScoreItem, SetupId, Signal, Watch } from "./types";

export const RULES_VERSION = 1;
/** 시장 평균이 60일 평균 아래인 날은 신호를 내지 않는다. 2022~2024 검증에서 손실을 크게 줄였다. */
export const USE_REGIME = true;
/** 목표에서 절반 익절 후 나머지는 20일선 이탈까지 (초급 29·37화) */
export const EXIT_MODE: "fixed" | "half_trail" = "half_trail";

export const P = {
  trend: {
    /**
     * 1년 고점 대비 위치. 이 아래면 위쪽에 물린 매물이 많아 올라가기 어렵다 (초급 7·37화, 중급 19화).
     * 2022~2024 코스피에서 차이가 뚜렷했다: 고점 대비 95%+ 신호는 20일 뒤 시장 대비 +3.9%, 85% 미만은 -4.0%.
     */
    minVsHigh: 0.85,
  },
  /** 기준봉: 거래 터진 장대양봉으로 저항을 종가 돌파 (초급 11화) */
  base: {
    minGain: 0.03,
    /** 평소 변동폭 대비 장대 여부. 변동성 큰 종목의 3%는 장대가 아니다 */
    gainVsRange: 1.3,
    /** 평소 대비 2~3배+ (초급 28화) */
    minVolRatio: 2,
    /** 종가가 캔들 위쪽 — 윗꼬리 긴 양봉은 매도 승 (초급 3화) */
    minClosePos: 0.6,
    /** 옆의 큰 산을 못 넘은 돌파는 의미 없다 (중급 19화) */
    highLookback: 60,
    /** 이평이 벌어진 채 터지면 마지막 트랩이 많다 (초급 11화) */
    maxPrevVsMa20: 1.15,
    maxMa20VsMa60: 1.2,
  },
  leg: {
    /** 이보다 오래된 기준봉은 매매 구간이 끝난 것으로 본다 */
    maxAge: 60,
    startLookback: 20,
    minGain: 0.08,
    minGainVsRange: 3,
    waistZone: [0.35, 0.65],
    maxDepth: 0.75,
  },
  pullback: {
    minBars: 3,
    /** 전고 돌파는 시간 조정이 충분해야 한다 (중급 16화) */
    minBarsForPeakBreak: 5,
    /** 눌릴 때 거래량 / 오를 때 거래량 (초급 5화) */
    maxDryUp: 0.85,
    /** 강의 예시는 10일 연속 음봉. 평범한 눌림까지 걸러내지 않도록 그보다 조금만 앞에서 끊는다 (초급 38화) */
    maxDownRun: 8,
    shallowDepth: 0.25,
    /** F 구간: 작은 캔들로 2봉 이상 (초급 26화) */
    fMinBars: 2,
    boxMaxBars: 10,
    boxMaxWidthVsRange: 1.8,
  },
  trigger: {
    minClosePos: 0.6,
    /** 돌파일 거래량 / 20일 평균 */
    breakoutVol: 1.2,
    peakBreakoutVol: 1.5,
    /** 돌파일 거래량 / 눌림 구간 평균 */
    volVsPullback: 1.5,
    confirmPrevVol: 0.8,
    confirmVolUp: 1.2,
    confirmNearSupport: 1.0,
    /** 평균 거래량에 못 미치는 첫 양봉은 신뢰할 수 없다 (초급 38화). 2022~2024에서 성적을 가장 많이 끌어올린 조건 */
    confirmMinVol: 1,
  },
  risk: {
    /** 이보다 크면 매수 자리를 낮춰 기다린다 (중급 20화) */
    maxRiskPct: 12,
    minRr: 1.5,
    /** 예측 매매는 위험한 대신 크게 먹어야 한다 (중급 22화) */
    minRrPredictive: 2,
    /** 이평 벌어진 곳에서 사면 고점 물린다 (초급 14화) */
    maxVsMa20: 1.2,
    /** 트랩 2번이면 박스로 본다 (중급 6화) */
    maxFailedBreakouts: 1,
  },
  /** 고점 대량거래: 신규 매수 금지 (초급 10화) */
  climax: { volRatio: 3, upperWick: 0.5, vsMa20: 1.1, lookback: 5 },
  /**
   * 강의의 "지지 이탈 복귀"는 사람이 맥락을 보고 고르는 자리다. 기계 판별로는 2022~2024에
   * 코스피 -2.6%(10건), S&P -5.1%(22건)로 나빠서 후보에서 뺀다. 판별이 나아지면 enabled를 켠다.
   */
  trap: { enabled: false, window: 40, minTouches: 3, minSpan: 8, tolVsRange: 0.4, recentBars: 3, minVolRatio: 1 },
};

/** 지표가 쌓이는 최소 봉 수 (120일선 + 비교 여유) */
export const MIN_BARS = 130;

export type Ctx = {
  bars: Bar[];
  ma5: (number | null)[];
  ma20: (number | null)[];
  ma60: (number | null)[];
  ma120: (number | null)[];
  ma240: (number | null)[];
  /** 당일을 뺀 직전 20봉 평균 거래량 */
  vol20: (number | null)[];
  /** 당일을 뺀 직전 20봉 평균 변동폭 비율 */
  range20: (number | null)[];
  isBase: boolean[];
};

export function sma(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

function prevAvg(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i >= n) out[i] = sum / n;
    sum += values[i];
    if (i >= n) sum -= values[i - n];
  }
  return out;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function closePos(b: Bar): number {
  return b.h === b.l ? 1 : (b.c - b.l) / (b.h - b.l);
}

/** 전일 종가와 시가 중 낮은 쪽부터 잰다 — 갭까지 장대봉으로 본다 (초급 11화) */
function candleGain(bars: Bar[], i: number): number {
  const ref = Math.min(bars[i].o, bars[i - 1].c);
  return (bars[i].c - ref) / ref;
}

function isBaseCandle(bars: Bar[], i: number, ind: Omit<Ctx, "bars" | "isBase">): boolean {
  const { highLookback, minGain, gainVsRange, minVolRatio, minClosePos, maxPrevVsMa20, maxMa20VsMa60 } = P.base;
  if (i < highLookback + 5) return false;
  const b = bars[i];
  const vol = ind.vol20[i];
  const range = ind.range20[i];
  const ma20 = ind.ma20[i];
  const ma60 = ind.ma60[i];
  const prevMa20 = ind.ma20[i - 1];
  const prevMa60 = ind.ma60[i - 1];
  const earlyMa60 = ind.ma60[i - 3];
  if (vol == null || range == null || ma20 == null || ma60 == null) return false;
  if (prevMa20 == null || prevMa60 == null || earlyMa60 == null) return false;
  if (vol <= 0 || b.c <= bars[i - 1].c) return false;
  if (candleGain(bars, i) < Math.max(minGain, gainVsRange * range)) return false;
  if (b.v / vol < minVolRatio) return false;
  if (closePos(b) < minClosePos) return false;
  // 이평이 꺾인 상태의 장대양봉은 반등이지 시작이 아니다 (초급 11화)
  if (ma20 <= prevMa20 || ma60 < earlyMa60) return false;
  if (bars[i - 1].c / prevMa20 > maxPrevVsMa20) return false;
  if (prevMa20 / prevMa60 > maxMa20VsMa60) return false;
  for (let k = i - highLookback; k < i; k++) if (bars[k].c >= b.c) return false;
  return true;
}

export function prepare(bars: Bar[]): Ctx {
  const closes = bars.map((b) => b.c);
  const ranges = bars.map((b) => (b.c > 0 ? (b.h - b.l) / b.c : 0));
  const ind = {
    ma5: sma(closes, 5),
    ma20: sma(closes, 20),
    ma60: sma(closes, 60),
    ma120: sma(closes, 120),
    ma240: sma(closes, 240),
    vol20: prevAvg(bars.map((b) => b.v), 20),
    range20: prevAvg(ranges, 20),
  };
  return { bars, ...ind, isBase: bars.map((_, i) => isBaseCandle(bars, i, ind)) };
}

/** [from, to] 안에서 시종고저가 가장 많이 닿은 가격. 기준가 찾기(초급 33화)의 기계 번역. */
function findLevel(bars: Bar[], from: number, to: number, lo: number, hi: number, tol: number): { price: number; touches: number } {
  const points: number[] = [];
  for (let i = from; i <= to; i++) {
    const b = bars[i];
    for (const p of [b.o, b.h, b.l, b.c]) if (p >= lo && p <= hi) points.push(p);
  }
  let best = { price: (lo + hi) / 2, touches: 0 };
  for (const p of points) {
    let touches = 0;
    for (let i = from; i <= to; i++) {
      const b = bars[i];
      if ([b.o, b.h, b.l, b.c].some((x) => Math.abs(x - p) <= tol)) touches++;
    }
    if (touches > best.touches) best = { price: p, touches };
  }
  return best;
}

type Leg = {
  b: number;
  start: number;
  p: number;
  low: number;
  high: number;
  waist: number;
  info: BaseInfo;
};

/** asOf 시점까지만 보고 가장 최근 기준 마디를 찾는다 (초급 12화). */
function legAsOf(ctx: Ctx, asOf: number): Leg | null {
  const { bars, isBase, range20, vol20 } = ctx;
  let b = -1;
  for (let i = asOf; i >= Math.max(asOf - P.leg.maxAge, 0); i--) {
    if (isBase[i]) {
      b = i;
      break;
    }
  }
  if (b < 0) return null;

  // 마디의 시작은 기준봉이 아니라 상승이 시작된 지점이다 (초급 12화)
  let start = b;
  for (let i = b; i >= Math.max(0, b - P.leg.startLookback); i--) if (bars[i].l < bars[start].l) start = i;
  let p = b;
  for (let i = b; i <= asOf; i++) if (bars[i].h > bars[p].h) p = i;

  const low = bars[start].l;
  const high = bars[p].h;
  const range = range20[b] ?? 0;
  if ((high - low) / low < Math.max(P.leg.minGain, P.leg.minGainVsRange * range)) return null;

  // 허리는 산술 중간이 아니라 중간 부근에서 실제로 지지·저항받은 가격 (초급 23화).
  // 상승 구간에서만 찾는다. 눌림 봉까지 세면 지금 눌리는 가격대가 허리로 잡혀서
  // "허리 아래로 내려왔다"는 판단이 자기 자신을 기준으로 내려진다.
  const [zl, zh] = P.leg.waistZone;
  const lo = low + (high - low) * zl;
  const hi = low + (high - low) * zh;
  const tol = Math.max(range * bars[b].c * 0.5, bars[b].c * 0.003);
  const found = findLevel(bars, start, p, lo, hi, tol);
  const waist = found.touches >= 3 ? found.price : (low + high) / 2;

  return {
    b,
    start,
    p,
    low,
    high,
    waist,
    info: {
      date: bars[b].t,
      volRatio: bars[b].v / (vol20[b] || 1),
      gainPct: candleGain(bars, b) * 100,
    },
  };
}

function trendOk(ctx: Ctx, t: number): { ok: boolean; note: string | null } {
  const c = ctx.bars[t].c;
  const ma60 = ctx.ma60[t];
  const ma120 = ctx.ma120[t];
  const prev120 = ctx.ma120[t - 1];
  if (ma60 == null || ma120 == null || prev120 == null) return { ok: false, note: "120일선 데이터 부족" };
  if (ma60 < ma120) return { ok: false, note: "60일선이 120일선 아래(역배열)" };
  if (ma120 < prev120) return { ok: false, note: "120일선이 아직 우하향" };
  if (c < ma60) return { ok: false, note: "종가가 60일선 아래" };
  let high = -Infinity;
  for (let i = Math.max(0, t - 239); i <= t; i++) high = Math.max(high, ctx.bars[i].h);
  if (c < high * P.trend.minVsHigh) return { ok: false, note: "1년 고점과 멀어 위쪽 매물 부담" };
  return { ok: true, note: null };
}

/** 저항 돌파 후 5봉 안에 되밀린 횟수. 2번이면 박스·확장형 박스로 본다 (중급 6화). */
function failedBreakouts(bars: Bar[], t: number, window = 40): number {
  let count = 0;
  for (let i = Math.max(25, t - window); i <= t - 1; i++) {
    let hh = -Infinity;
    for (let k = i - 20; k < i; k++) hh = Math.max(hh, bars[k].h);
    if (bars[i].c <= hh) continue;
    let failed = false;
    for (let k = i + 1; k <= Math.min(t, i + 5); k++) if (bars[k].c < hh) failed = true;
    if (failed) {
      count++;
      i += 5;
    }
  }
  return count;
}

/** 최근 고점 대량거래: 거래 터지며 윗꼬리, 이미 많이 오른 자리 (초급 10화) */
function hasClimax(ctx: Ctx, t: number): boolean {
  const { volRatio, upperWick, vsMa20, lookback } = P.climax;
  for (let i = Math.max(1, t - lookback + 1); i <= t; i++) {
    const b = ctx.bars[i];
    const vol = ctx.vol20[i];
    const ma20 = ctx.ma20[i];
    if (vol == null || ma20 == null || b.h === b.l) continue;
    const wick = (b.h - Math.max(b.c, b.o)) / (b.h - b.l);
    if (b.v / vol >= volRatio && wick >= upperWick && b.h / ma20 >= vsMa20) return true;
  }
  return false;
}

/** 이전 봉들보다 높은 스윙 고점. 익절 후보이자 위쪽 저항. */
function overheadPivots(bars: Bar[], t: number, above: number, tol: number): { price: number; touches: number }[] {
  const out: { price: number; touches: number }[] = [];
  const from = Math.max(3, t - 240);
  for (let i = from; i <= t - 3; i++) {
    const h = bars[i].h;
    if (h <= above) continue;
    let pivot = true;
    for (let k = i - 3; k <= i + 3; k++) if (k !== i && bars[k].h > h) pivot = false;
    if (!pivot) continue;
    const near = out.find((x) => Math.abs(x.price - h) <= tol);
    if (near) near.touches++;
    else out.push({ price: h, touches: 1 });
  }
  return out.sort((a, b) => a.price - b.price);
}

type Plan = { target: number; basis: string; rr: number; warnings: string[] } | { reject: string };

function makePlan(
  bars: Bar[],
  t: number,
  entry: number,
  stop: number,
  minRr: number,
  candidates: { price: number; basis: string }[],
  tol: number,
): Plan {
  const risk = entry - stop;
  const pivots = overheadPivots(bars, t, entry * 1.005, tol);
  const strong = pivots.find((p) => p.touches >= 3);
  // 바로 위가 여러 번 막힌 자리면 올라갈 공간이 없다
  if (strong && (strong.price - entry) / risk < 1) {
    return { reject: "바로 위에 강한 저항" };
  }
  const all = [
    ...pivots.map((p) => ({ price: p.price, basis: "저항 기준가" })),
    ...candidates.filter((c) => c.price > entry),
  ].sort((a, b) => a.price - b.price);
  const pick = all.find((c) => (c.price - entry) / risk >= minRr);
  if (!pick) return { reject: `손익비 ${minRr} 미달` };
  const passed = pivots.filter((p) => p.price < pick.price);
  const warnings = passed.length ? [`목표 전에 저항 ${passed.length}곳을 넘어야 합니다`] : [];
  return { target: pick.price, basis: pick.basis, rr: (pick.price - entry) / risk, warnings };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function scoreSignal(
  ctx: Ctx,
  t: number,
  leg: Leg,
  o: { volRatio: number; dryUp: number | null; depth: number | null; barsSincePeak: number | null; rr: number; predictive: boolean; trap: boolean },
): { score: number; breakdown: ScoreItem[] } {
  const { bars, ma5, ma20, ma60, ma120, ma240 } = ctx;
  const items: ScoreItem[] = [];

  const volScore = 15 * clamp01((o.volRatio - 1) / 2);
  const dryScore = o.dryUp == null ? 5 : 10 * clamp01((0.85 - o.dryUp) / 0.45);
  items.push({
    key: "volume",
    label: "거래량",
    score: volScore + dryScore,
    max: 25,
    detail: `오늘 평균의 ${o.volRatio.toFixed(1)}배${o.dryUp == null ? "" : `, 눌림 때 상승 구간의 ${Math.round(o.dryUp * 100)}%로 감소`}`,
  });

  const m5 = ma5[t]!;
  const m20 = ma20[t]!;
  const m60 = ma60[t]!;
  const m120 = ma120[t]!;
  const m240 = ma240[t];
  let trend = 0;
  const notes: string[] = [];
  if (m5 > m20 && m20 > m60 && m60 > m120) {
    trend += 10;
    notes.push("5>20>60>120 정배열");
  } else if (m20 > m60 && m60 > m120) {
    trend += 6;
    notes.push("20>60>120 정배열");
  } else {
    trend += 3;
    notes.push("60>120만 정배열");
  }
  if (m240 != null && ctx.ma240[t - 1] != null && m240 > ctx.ma240[t - 1]!) {
    trend += 5;
    notes.push("240일선 우상향");
  }
  // 수렴할수록 위로 벌어질 여지가 크다 (중급 11화)
  const spread = (Math.max(m20, m60, m120) - Math.min(m20, m60, m120)) / m120;
  trend += 10 * clamp01((0.25 - spread) / 0.2);
  notes.push(`20·60·120일선 간격 ${(spread * 100).toFixed(0)}%`);
  items.push({ key: "trend", label: "추세", score: trend, max: 25, detail: notes.join(", ") });

  const legGain = (leg.high - leg.low) / leg.low;
  const legScore = 10 * clamp01((leg.info.volRatio - 2) / 3) + 10 * clamp01((legGain - 0.08) / 0.32);
  items.push({
    key: "leg",
    label: "기준 마디",
    score: legScore,
    max: 20,
    detail: `기준봉 거래량 ${leg.info.volRatio.toFixed(1)}배, 마디 상승폭 ${(legGain * 100).toFixed(0)}%`,
  });

  // 조정은 길고 얕을수록 강하다 (초급 17화)
  const depthScore = o.depth == null ? 5 : 10 * clamp01((0.6 - o.depth) / 0.5);
  const timeScore = o.barsSincePeak == null ? 2 : 5 * clamp01((o.barsSincePeak - 2) / 10);
  items.push({
    key: "pullback",
    label: "눌림 품질",
    score: depthScore + timeScore,
    max: 15,
    detail: o.depth == null ? "해당 없음" : `마디의 ${Math.round(o.depth * 100)}%까지 눌림, ${o.barsSincePeak}봉 조정`,
  });

  items.push({
    key: "rr",
    label: "손익비",
    score: 15 * clamp01((o.rr - 1.5) / 2.5),
    max: 15,
    detail: `1 : ${o.rr.toFixed(1)}`,
  });

  let score = items.reduce((a, x) => a + x.score, 0);
  if (o.trap) score += 5;
  if (o.predictive) score -= 5;
  void bars;
  return { score: Math.round(Math.max(0, Math.min(100, score))), breakdown: items.map((x) => ({ ...x, score: Math.round(x.score) })) };
}

function softWarnings(ctx: Ctx, t: number): string[] {
  const out: string[] = [];
  const c = ctx.bars[t].c;
  const m240 = ctx.ma240[t];
  const prev = ctx.ma240[t - 1];
  if (m240 == null) out.push("상장 후 1년이 안 돼 240일선이 없습니다");
  else if (prev != null && m240 < prev && c < m240 * 1.05) out.push("240일선이 우하향이고 가까이 있어 매물 저항 가능");
  return out;
}

type Pull = {
  pullLow: number;
  depth: number;
  dryUp: number;
  barsSincePeak: number;
  belowWaistRuns: number;
  lastBelowWaist: number;
  broken: string | null;
};

/** 고점 이후 눌림 상태. t는 포함하지 않고 판단한다 — 오늘은 트리거 봉이기 때문이다. */
function pullbackState(ctx: Ctx, leg: Leg, t: number): Pull {
  const { bars, vol20 } = ctx;
  const { p, b, waist, high, low } = leg;
  let pullLow = Infinity;
  let runs = 0;
  let inRun = false;
  let lastBelow = -1;
  let downRun = 0;
  let maxDownRun = 0;
  let spike = false;
  const upVols: number[] = [];
  const pullVols: number[] = [];
  for (let i = b; i <= p; i++) upVols.push(bars[i].v);
  let maxUpVol = 0;
  for (const x of upVols) maxUpVol = Math.max(maxUpVol, x);

  for (let i = p + 1; i <= t - 1; i++) {
    const x = bars[i];
    pullLow = Math.min(pullLow, x.l);
    pullVols.push(x.v);
    if (x.c < waist) {
      lastBelow = i;
      if (!inRun) runs++;
      inRun = true;
    } else inRun = false;
    downRun = x.c < bars[i - 1].c ? downRun + 1 : 0;
    maxDownRun = Math.max(maxDownRun, downRun);
    const vol = vol20[i] ?? Infinity;
    if (x.c < x.o && (x.v >= maxUpVol * 0.9 || x.v >= vol * 2.5)) spike = true;
  }
  if (pullLow === Infinity) pullLow = bars[t].l;
  const depth = (high - pullLow) / (high - low);
  const dryUp = pullVols.length ? mean(pullVols) / (mean(upVols) || 1) : 1;

  let broken: string | null = null;
  if (depth > P.leg.maxDepth) broken = "마디가 너무 깊게 눌렸습니다";
  else if (spike) broken = "조정 중 거래가 터졌습니다(하락 전환 신호)";
  else if (maxDownRun >= P.pullback.maxDownRun) broken = "음봉이 연속으로 이어졌습니다(물량 넘기기 의심)";
  else if (runs >= 2) broken = "허리를 두 번 이탈했습니다";
  else if (bars[t - 1].c < waist) broken = "종가가 허리 아래입니다";

  return { pullLow, depth, dryUp, barsSincePeak: t - p, belowWaistRuns: runs, lastBelowWaist: lastBelow, broken };
}

function maxHigh(bars: Bar[], from: number, to: number): number {
  let h = -Infinity;
  for (let i = from; i <= to; i++) h = Math.max(h, bars[i].h);
  return h;
}

/**
 * 돌파 직전의 수렴 구간. 고점 직후의 하락 봉까지 넣으면 상단이 사실상 전고점이 되어
 * 강의의 "수렴 후 돌파"(AF의 F, 고가놀이)를 전혀 잡지 못한다 — 첫 검증에서 실제로 그랬다.
 * end부터 거슬러 올라가 위아래 폭이 평소 변동폭의 일정 배수 안에 드는 동안만 늘린다.
 */
function consolidation(ctx: Ctx, end: number, floor: number): { top: number; low: number; bars: number } | null {
  const { bars, range20 } = ctx;
  const limit = (range20[end] ?? 0) * bars[end].c * P.pullback.boxMaxWidthVsRange;
  let top = -Infinity;
  let low = Infinity;
  let n = 0;
  for (let i = end; i >= Math.max(floor, end - P.pullback.boxMaxBars + 1); i--) {
    const h = Math.max(top, bars[i].h);
    const l = Math.min(low, bars[i].l);
    if (h - l > limit) break;
    top = h;
    low = l;
    n++;
  }
  return n >= P.pullback.fMinBars ? { top, low, bars: n } : null;
}

function levelsOf(leg: Leg, pullLow: number | null): Levels {
  return { legLow: leg.low, legHigh: leg.high, waist: leg.waist, pullLow };
}

function buildSignal(
  ctx: Ctx,
  t: number,
  leg: Leg,
  setup: SetupId,
  pull: Pull | null,
  stop: number,
  stopBasis: string,
  candidates: { price: number; basis: string }[],
  predictive: boolean,
  trap: boolean,
): { signal: Signal } | { reject: string } {
  const { bars, vol20, range20 } = ctx;
  const x = bars[t];
  const entry = x.c;
  const riskPct = ((entry - stop) / entry) * 100;
  if (riskPct <= 0) return { reject: "손절선이 현재가 위" };
  if (riskPct > P.risk.maxRiskPct) return { reject: `손절 폭 ${riskPct.toFixed(1)}%가 너무 큼` };
  const tol = Math.max((range20[t] ?? 0) * x.c * 0.5, x.c * 0.003);
  const plan = makePlan(bars, t, entry, stop, predictive ? P.risk.minRrPredictive : P.risk.minRr, candidates, tol);
  if ("reject" in plan) return plan;
  const volRatio = x.v / (vol20[t] || 1);
  const { score, breakdown } = scoreSignal(ctx, t, leg, {
    volRatio,
    dryUp: pull?.dryUp ?? null,
    depth: pull?.depth ?? null,
    barsSincePeak: pull?.barsSincePeak ?? null,
    rr: plan.rr,
    predictive,
    trap,
  });
  return {
    signal: {
      setup,
      kind: predictive ? "예측" : "확인",
      entry,
      stop,
      stopBasis,
      target: plan.target,
      targetBasis: plan.basis,
      rr: plan.rr,
      riskPct,
      score,
      breakdown,
      warnings: [...plan.warnings, ...softWarnings(ctx, t)],
      levels: levelsOf(leg, pull?.pullLow ?? null),
      base: leg.info,
      volRatio,
      dryUp: pull?.dryUp ?? null,
      depth: pull?.depth ?? null,
      barsSincePeak: pull?.barsSincePeak ?? null,
    },
  };
}

/** 지지 기준가를 깼다가 바로 복귀 — 손절 짧고 수익 큰 자리 (중급 16화, 초급 21화). */
function trapReclaim(ctx: Ctx, t: number, leg: Leg): ReturnType<typeof buildSignal> | null {
  if (!P.trap.enabled) return null;
  const { bars, range20, vol20 } = ctx;
  const { window, minTouches, minSpan, tolVsRange, recentBars, minVolRatio } = P.trap;
  const x = bars[t];
  const range = range20[t] ?? 0;
  const tol = Math.max(range * tolVsRange * x.c, x.c * 0.002);
  const from = Math.max(0, t - window);
  const to = t - recentBars;
  if (to - from < minSpan) return null;

  let bestPrice = 0;
  let bestTouches = 0;
  for (let i = from; i <= to; i++) {
    const p = bars[i].l;
    let touches = 0;
    let first = -1;
    let last = -1;
    let holds = true;
    for (let k = from; k <= to; k++) {
      if (bars[k].c < p - tol) holds = false;
      if (Math.abs(bars[k].l - p) <= tol) {
        touches++;
        if (first < 0) first = k;
        last = k;
      }
    }
    if (holds && touches >= minTouches && last - first >= minSpan && touches > bestTouches) {
      bestPrice = p;
      bestTouches = touches;
    }
  }
  if (!bestTouches) return null;

  let trapLow = Infinity;
  for (let k = t - recentBars + 1; k <= t; k++) trapLow = Math.min(trapLow, bars[k].l);
  if (trapLow >= bestPrice - tol) return null;
  if (x.c <= bestPrice || x.c <= x.o) return null;
  if (closePos(x) < P.trigger.minClosePos) return null;
  if (x.v / (vol20[t] || 1) < minVolRatio) return null;

  const boxTop = maxHigh(bars, from, t - 1);
  return buildSignal(
    ctx,
    t,
    leg,
    "trap_reclaim",
    null,
    trapLow,
    "이탈 저점",
    [
      { price: boxTop, basis: "박스 상단" },
      { price: bestPrice + (leg.high - leg.low), basis: "N자" },
    ],
    false,
    true,
  );
}

/** t 시점의 분석. 여기서 bars[t] 이후를 읽으면 미래 참조다. */
export function analyze(ctx: Ctx, t: number): Analysis {
  const { bars, vol20, range20, ma20, isBase } = ctx;
  const none = (stage: Analysis["stage"], note: string | null): Analysis => ({ stage, signal: null, watch: null, note });
  if (t < MIN_BARS) return none("history", "거래 일수 부족");

  const x = bars[t];
  const trend = trendOk(ctx, t);
  if (!trend.ok) return none("trend", trend.note);

  const leg = legAsOf(ctx, t - 1);
  const firstBaseToday = isBase[t] && (!leg || leg.b < t - P.leg.maxAge);

  if (!leg) {
    if (isBase[t]) return firstBase(ctx, t);
    return none("no_leg", "최근 60봉에 기준봉 없음");
  }
  if (firstBaseToday) return firstBase(ctx, t);

  // 아직 조정이 없다. 상승 중 추격은 하지 않는다 (중급 6화)
  if (leg.p === t - 1 && x.h >= leg.high && !isBase[t]) return risingWatch(leg);

  const pull = leg.p < t - 1 ? pullbackState(ctx, leg, t) : null;
  if (!pull) return isBase[t] ? firstBase(ctx, t) : risingWatch(leg);

  const vs20 = ma20[t] ? x.c / ma20[t]! : 1;
  const failures = failedBreakouts(bars, t);
  const climax = hasClimax(ctx, t);

  const riskStage = (reason: string, kept: Analysis | null = null): Analysis => kept ?? none("risk", reason);

  if (pull.broken) {
    // 허리를 잠깐 깼다 복귀한 건 트랩일 수 있다 — 지지 이탈 복귀만 따로 본다
    const trap = trapReclaim(ctx, t, leg);
    if (trap && "signal" in trap && !climax && failures <= P.risk.maxFailedBreakouts) return passed(trap.signal);
    return none("leg_broken", pull.broken);
  }

  const volRatio = x.v / (vol20[t] || 1);
  const bull = x.c > x.o || x.c > bars[t - 1].c;
  const strongClose = closePos(x) >= P.trigger.minClosePos;
  const pullVols: number[] = [];
  for (let i = leg.p + 1; i <= t - 1; i++) pullVols.push(bars[i].v);
  const volVsPull = pullVols.length ? x.v / (mean(pullVols) || 1) : 0;
  const dried = pull.dryUp <= P.pullback.maxDryUp;

  const trap = trapReclaim(ctx, t, leg);
  if (trap) {
    if ("signal" in trap && !climax && failures <= P.risk.maxFailedBreakouts) return passed(trap.signal);
  }

  // ① 2차 기준봉: 시간 조정 후 전고점을 거래량과 함께 돌파
  const peakBreak =
    pull.barsSincePeak >= P.pullback.minBarsForPeakBreak &&
    x.c > leg.high &&
    bars[t - 1].c <= leg.high &&
    bull &&
    strongClose &&
    volRatio >= P.trigger.peakBreakoutVol &&
    dried;

  // ② 눌림 돌파: 수렴 구간 상단을 돌파. 허리 이탈 후 복귀했다면 그 뒤만 본다
  const box = consolidation(ctx, t - 1, Math.max(leg.p + 1, pull.lastBelowWaist + 1));
  const boxBreak =
    pull.barsSincePeak >= P.pullback.minBars &&
    box != null &&
    x.c > box.top &&
    x.c <= leg.high &&
    bull &&
    strongClose &&
    volRatio >= P.trigger.breakoutVol &&
    volVsPull >= P.trigger.volVsPullback &&
    dried;

  // ③ 눌림 확인: 거래가 마른 뒤 지지 근처에서 첫 양봉 (초급 39화)
  const prev = bars[t - 1];
  const prevVol = vol20[t - 1] ?? Infinity;
  const nearTol = (range20[t] ?? 0) * x.c * P.trigger.confirmNearSupport;
  const supports = [leg.waist, ma20[t] ?? -Infinity, leg.low + (leg.high - leg.low) * 0.5];
  const nearSupport = supports.some((s) => Math.abs(Math.min(x.l, prev.l) - s) <= nearTol);
  const confirm =
    pull.barsSincePeak >= P.pullback.minBars &&
    x.c > x.o &&
    x.c > Math.max(prev.o, prev.c) &&
    strongClose &&
    prev.v <= prevVol * P.trigger.confirmPrevVol &&
    x.v >= prev.v * P.trigger.confirmVolUp &&
    volRatio >= P.trigger.confirmMinVol &&
    nearSupport &&
    dried;

  const triggered = peakBreak || boxBreak || confirm;
  if (triggered) {
    if (climax) return none("risk", "최근 고점 대량거래");
    if (failures > P.risk.maxFailedBreakouts) return none("risk", "돌파 실패 2회 이상(박스)");
    if (vs20 > P.risk.maxVsMa20) return none("risk", "20일선과 이격 과다");
  }

  const nTarget = { price: pull.pullLow + (leg.high - leg.low), basis: "N자" };
  // 수렴 후 돌파의 손절은 수렴 하단, 수렴 없이 올라왔으면 눌림 저점 (중급 3화)
  const stopAt = (b: typeof box) => (b ? { price: Math.min(b.low, x.l), basis: "수렴 하단" } : { price: Math.min(pull.pullLow, x.l), basis: "눌림 저점" });

  if (peakBreak) {
    const eTarget = { price: leg.high + (leg.high - pull.pullLow), basis: "E자" };
    const s = stopAt(box);
    const res = buildSignal(ctx, t, leg, "second_base", pull, s.price, s.basis, [nTarget, eTarget], false, false);
    return "signal" in res ? passed(res.signal) : riskStage(res.reject, firstOrWatch(ctx, t, leg, pull, res.reject));
  }

  if (boxBreak) {
    const reclaimed = pull.belowWaistRuns === 1 && pull.lastBelowWaist >= 0;
    const setup: SetupId = reclaimed ? "af" : pull.depth <= P.pullback.shallowDepth ? "high_tight" : "pullback_breakout";
    const s = stopAt(box);
    const res = buildSignal(ctx, t, leg, setup, pull, s.price, s.basis, [{ price: leg.high, basis: "전고점" }, nTarget], false, reclaimed);
    return "signal" in res ? passed(res.signal) : riskStage(res.reject, firstOrWatch(ctx, t, leg, pull, res.reject));
  }

  if (confirm) {
    const res = buildSignal(
      ctx,
      t,
      leg,
      "pullback_confirm",
      pull,
      Math.min(pull.pullLow, x.l),
      "눌림 저점",
      [{ price: leg.high, basis: "전고점" }, nTarget],
      true,
      false,
    );
    return "signal" in res ? passed(res.signal) : riskStage(res.reject, firstOrWatch(ctx, t, leg, pull, res.reject));
  }

  if (isBase[t]) return firstBase(ctx, t);
  return firstOrWatch(ctx, t, leg, pull, null) ?? none("no_trigger", "오늘 진입 신호 없음");
}

function passed(signal: Signal): Analysis {
  return { stage: "pass", signal, watch: null, note: null };
}

function firstBase(ctx: Ctx, t: number): Analysis {
  const leg = legAsOf(ctx, t);
  if (!leg) return { stage: "no_leg", signal: null, watch: null, note: "기준봉이 나왔지만 마디가 작음" };
  const watch: Watch = {
    id: "first_base",
    trigger: null,
    stop: null,
    riskPct: null,
    distancePct: null,
    score: Math.round(40 + 20 * clamp01((leg.info.volRatio - 2) / 3)),
    note: "1차 기준봉은 속임수가 많습니다. 눌림을 기다린 뒤 다음 신호를 봅니다.",
    levels: levelsOf(leg, null),
    base: leg.info,
    dryUp: null,
  };
  return { stage: "no_trigger", signal: null, watch, note: watch.note };
}

function risingWatch(leg: Leg): Analysis {
  const legGain = (leg.high - leg.low) / leg.low;
  const watch: Watch = {
    id: "rising",
    trigger: null,
    stop: null,
    riskPct: null,
    distancePct: null,
    score: Math.round(20 + 15 * clamp01((legGain - 0.08) / 0.32) + 10 * clamp01((leg.info.volRatio - 2) / 3)),
    note: "조정 없이 오르는 중입니다. 따라 사지 않고 첫 눌림을 기다립니다.",
    levels: levelsOf(leg, null),
    base: leg.info,
    dryUp: null,
  };
  return { stage: "no_trigger", signal: null, watch, note: watch.note };
}

/**
 * 오늘 신호가 없는 종목을 관심 목록에 올린다. 신호 기준을 풀지 않고도 매일 볼 후보가 있게 하려는 것이다.
 * 조건을 다 갖춘 눌림(pullback_forming)과 부족한 눌림(pullback_weak)을 나누고, 부족한 이유를 적는다.
 */
function firstOrWatch(ctx: Ctx, t: number, leg: Leg, pull: Pull, reason: string | null): Analysis | null {
  const { bars, vol20 } = ctx;
  const x = bars[t];
  if (x.c < leg.waist) return null;

  // 내일 기준이므로 오늘 봉까지 포함해 수렴을 잰다
  const box = consolidation(ctx, t, Math.max(leg.p + 1, pull.lastBelowWaist + 1));
  let trigger: number | null = box ? Math.min(box.top, leg.high) : leg.high;
  const stop = box ? box.low : Math.min(pull.pullLow, x.l);
  if (trigger <= x.c) trigger = leg.high > x.c ? leg.high : null;
  const riskPct = trigger != null ? ((trigger - stop) / trigger) * 100 : null;
  const distancePct = trigger != null ? ((trigger - x.c) / x.c) * 100 : null;

  const lacks: string[] = [];
  if (reason) lacks.push(`신호는 있었지만 보류: ${reason}`);
  if (pull.barsSincePeak < 2) lacks.push("조정이 이제 막 시작됐습니다");
  if (pull.dryUp > P.pullback.maxDryUp) lacks.push("눌리는 동안 거래가 충분히 줄지 않았습니다");
  if (x.v > (vol20[t] ?? 0) * 1.2) lacks.push("오늘 거래가 붙었지만 돌파 신호는 아닙니다");
  if (failedBreakouts(bars, t) > P.risk.maxFailedBreakouts) lacks.push("돌파 실패가 반복돼 박스일 수 있습니다");
  if (trigger == null) lacks.push("가격은 넘었지만 거래량이 부족했습니다");
  if (riskPct != null && riskPct > P.risk.maxRiskPct) lacks.push(`손절 폭이 ${riskPct.toFixed(0)}%로 큽니다`);

  const quality =
    40 * clamp01((P.pullback.maxDryUp - pull.dryUp) / 0.45) +
    30 * clamp01((5 - (distancePct ?? 5)) / 5) +
    30 * clamp01((P.risk.maxRiskPct - (riskPct ?? P.risk.maxRiskPct)) / P.risk.maxRiskPct);

  const healthy = lacks.length === 0;
  const watch: Watch = {
    id: healthy ? "pullback_forming" : "pullback_weak",
    trigger,
    stop,
    riskPct,
    distancePct,
    // 조건을 다 갖춘 눌림이 언제나 부족한 눌림보다 위에 오도록 구간을 나눈다
    score: Math.round(healthy ? 50 + quality * 0.5 : quality * 0.4),
    note: healthy ? "거래가 줄며 눌리는 중입니다. 위 가격을 거래량과 함께 넘으면 신호입니다." : lacks.join(" · "),
    levels: levelsOf(leg, pull.pullLow),
    base: leg.info,
    dryUp: pull.dryUp,
  };
  return { stage: reason ? "risk" : "no_trigger", signal: null, watch, note: watch.note };
}
