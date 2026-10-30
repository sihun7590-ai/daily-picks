/**
 * 규칙을 과거에 그대로 돌려 보는 시뮬레이터.
 *
 * 왜 이렇게 재는가:
 * - 신호는 그날 종가로 판단하므로 진입은 다음 날 시가다. 그날 종가로 샀다고 치면 부풀려진다.
 * - 같은 봉에서 손절과 목표를 둘 다 건드리면 손절로 친다. 일봉으론 순서를 모르니 불리한 쪽을 택한다.
 * - 목록이 "지금의" S&P 500·코스피라서 망하거나 빠진 종목이 없다(생존 편향). 절대 수익률은 부풀려진다.
 *   그래서 같은 기간 같은 시장 전체 평균과의 차이(초과 수익)를 함께 본다.
 */
import { analyze, prepare } from "./rules";
import type { Bar, MarketId, SetupId } from "./types";

/** 왕복 거래비용 가정. 코스피는 증권거래세가 있어 더 크다. */
export const COST: Record<MarketId, number> = { kospi: 0.003, sp500: 0.001 };
/** 20일 평균 거래대금 하한. 체결이 안 되는 종목은 후보로 의미가 없다. */
export const LIQUIDITY: Record<MarketId, number> = { kospi: 3e9, sp500: 5e7 };

export type ExitMode =
  /** 목표에서 전량 익절, 손절선 고정, 40봉 시간 청산 */
  | "fixed"
  /** 목표에서 절반 익절 후 손절선을 본전으로 올리고, 나머지는 20일선 이탈 때 청산 (초급 29·37화) */
  | "half_trail";

export type Trade = {
  market: MarketId;
  symbol: string;
  setup: SetupId;
  date: string;
  year: string;
  score: number;
  r: number;
  ret: number;
  outcome: "target" | "stop" | "time" | "trail";
  held: number;
  /** 보유 기간 동안 시장 평균 대비 초과 수익 (%) */
  excess: number | null;
  fwd20: number | null;
  fwd20Excess: number | null;
};

export function liquid(bars: Bar[], t: number, min: number): boolean {
  let sum = 0;
  for (let i = t - 19; i <= t; i++) sum += bars[i].c * bars[i].v;
  return sum / 20 >= min;
}

/** 날짜별 시장 평균 지수. 그날 거래된 종목의 일간 수익률을 단순 평균해 누적한다. */
export function marketIndex(all: Bar[][]): Map<string, number> {
  const daily = new Map<string, { sum: number; n: number }>();
  for (const bars of all) {
    for (let i = 1; i < bars.length; i++) {
      const r = bars[i].c / bars[i - 1].c - 1;
      // 분할 조정 오류 등 튀는 값이 평균을 망치지 않게 자른다
      if (Math.abs(r) > 0.5) continue;
      const d = daily.get(bars[i].t) ?? { sum: 0, n: 0 };
      d.sum += r;
      d.n++;
      daily.set(bars[i].t, d);
    }
  }
  const out = new Map<string, number>();
  let level = 1;
  for (const t of [...daily.keys()].sort()) {
    const d = daily.get(t)!;
    level *= 1 + d.sum / d.n;
    out.set(t, level);
  }
  return out;
}

/** 시장 평균이 60일 평균 위에 있는 날들. 강의의 "매매 구간"을 시장 전체에 적용한 것. */
export function regimeUp(index: Map<string, number>, n = 60): Set<string> {
  const dates = [...index.keys()];
  const values = dates.map((d) => index.get(d)!);
  const out = new Set<string>();
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1 && values[i] > sum / n) out.add(dates[i]);
  }
  return out;
}

type SimOpts = { exit: ExitMode; regime?: Set<string>; maxHold?: number };

export function simulate(market: MarketId, symbol: string, bars: Bar[], index: Map<string, number>, opts: SimOpts): Trade[] {
  const ctx = prepare(bars);
  const trades: Trade[] = [];
  const maxHold = opts.maxHold ?? (opts.exit === "fixed" ? 40 : 120);
  let t = 130;
  while (t < bars.length - 2) {
    if (!liquid(bars, t, LIQUIDITY[market]) || (opts.regime && !opts.regime.has(bars[t].t))) {
      t++;
      continue;
    }
    const a = analyze(ctx, t);
    if (!a.signal) {
      t++;
      continue;
    }
    const s = a.signal;
    const entryBar = t + 1;
    const entry = bars[entryBar].o;
    // 다음 날 시가가 이미 목표 위거나 손절 아래면 계획이 깨진 것이니 들어가지 않는다
    if (entry >= s.target || entry <= s.stop) {
      t++;
      continue;
    }

    let last = Math.min(entryBar + maxHold, bars.length - 1);
    let outcome: Trade["outcome"] = "time";
    let exitValue = 0; // 진입가 1 대비 최종 회수액
    let stop = s.stop;
    let half = false;
    let banked = 0;
    let closed = false;
    for (let i = entryBar; i <= last; i++) {
      const b = bars[i];
      const size = half ? 0.5 : 1;
      if (b.l <= stop) {
        // 갭으로 손절선 아래서 시작했다면 그 시가에 나간다
        const px = i > entryBar ? Math.min(stop, b.o) : stop;
        exitValue = banked + (size * px) / entry;
        outcome = half ? "trail" : "stop";
        last = i;
        closed = true;
        break;
      }
      if (!half && b.h >= s.target) {
        const px = Math.max(s.target, i > entryBar ? b.o : s.target);
        if (opts.exit === "fixed") {
          exitValue = px / entry;
          outcome = "target";
          last = i;
          closed = true;
          break;
        }
        banked = (0.5 * px) / entry;
        half = true;
        stop = Math.max(stop, entry);
        continue;
      }
      if (half) {
        const ma20 = ctx.ma20[i];
        if (ma20 != null && b.c < ma20) {
          exitValue = banked + (0.5 * b.c) / entry;
          outcome = "trail";
          last = i;
          closed = true;
          break;
        }
      }
    }
    if (!closed) {
      const size = half ? 0.5 : 1;
      exitValue = banked + (size * bars[last].c) / entry;
    }

    const ret = exitValue - 1 - COST[market];
    const r = ret / ((entry - s.stop) / entry);
    const mStart = index.get(bars[entryBar].t);
    const mEnd = index.get(bars[last].t);
    const excess = mStart && mEnd ? (ret - (mEnd / mStart - 1)) * 100 : null;

    const f20 = entryBar + 20;
    let fwd20: number | null = null;
    let fwd20Excess: number | null = null;
    if (f20 < bars.length) {
      fwd20 = (bars[f20].c / entry - 1) * 100;
      const m20 = index.get(bars[f20].t);
      if (mStart && m20) fwd20Excess = fwd20 - (m20 / mStart - 1) * 100;
    }

    trades.push({
      market,
      symbol,
      setup: s.setup,
      date: bars[t].t,
      year: bars[t].t.slice(0, 4),
      score: s.score,
      r,
      ret: ret * 100,
      outcome,
      held: last - entryBar + 1,
      excess,
      fwd20,
      fwd20Excess,
    });
    t = last + 1;
  }
  return trades;
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export type Summary = {
  n: number;
  /** 첫 목표 도달 비율 */
  targetRate: number;
  /** 첫 목표 전에 손절된 비율 */
  stopRate: number;
  /** 수익으로 끝난 비율 */
  winRate: number;
  avgRet: number;
  medianRet: number;
  avgR: number;
  avgHeld: number;
  avgExcess: number;
  fwd20: number;
  fwd20Excess: number;
  /** fwd20Excess 평균의 표준오차. 평균이 이 값의 2배 안쪽이면 우연과 구분되지 않는다 */
  fwd20ExcessSe: number;
};

export function summarize(ts: Trade[]): Summary {
  const num = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);
  const ex = num(ts.map((x) => x.fwd20Excess));
  const exAvg = avg(ex);
  const sd = ex.length > 1 ? Math.sqrt(ex.reduce((a, b) => a + (b - exAvg) ** 2, 0) / (ex.length - 1)) : 0;
  return {
    n: ts.length,
    targetRate: ts.length ? (ts.filter((x) => x.outcome === "target" || x.outcome === "trail").length / ts.length) * 100 : 0,
    stopRate: ts.length ? (ts.filter((x) => x.outcome === "stop").length / ts.length) * 100 : 0,
    winRate: ts.length ? (ts.filter((x) => x.ret > 0).length / ts.length) * 100 : 0,
    avgRet: avg(ts.map((x) => x.ret)),
    medianRet: median(ts.map((x) => x.ret)),
    avgR: avg(ts.map((x) => x.r)),
    avgHeld: avg(ts.map((x) => x.held)),
    avgExcess: avg(num(ts.map((x) => x.excess))),
    fwd20: avg(num(ts.map((x) => x.fwd20))),
    fwd20Excess: exAvg,
    fwd20ExcessSe: ex.length > 1 ? sd / Math.sqrt(ex.length) : 0,
  };
}

export function groupBy<T>(xs: T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of xs) (out[key(x)] ??= []).push(x);
  return out;
}
