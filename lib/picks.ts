import type { Ctx } from "./rules";
import type { Bar, Levels, MarketId, Signal, Stage, Watch } from "./types";

export type ChartData = {
  bars: Bar[];
  ma5: (number | null)[];
  ma20: (number | null)[];
  ma60: (number | null)[];
  ma120: (number | null)[];
  ma240: (number | null)[];
};

type Meta = {
  code: string;
  symbol: string;
  name: string;
  sector: string;
  close: number;
  changePct: number;
  chart: ChartData;
};

export type SignalPick = Meta & { signal: Signal };
export type WatchPick = Meta & { watch: Watch };

export type MarketPicks = {
  id: MarketId;
  asOf: string;
  /** 시장 평균이 60일 평균 위인가. false면 신규 신호를 보류한다 */
  regimeUp: boolean;
  universe: number;
  scanned: number;
  failed: number;
  funnel: Partial<Record<Stage | "illiquid" | "stale", number>>;
  signals: SignalPick[];
  /** 규칙은 통과했지만 시장 조정 구간이라 보류한 신호 */
  held: SignalPick[];
  watch: WatchPick[];
};

export type PicksFile = {
  generatedAt: string;
  rulesVersion: number;
  markets: Record<MarketId, MarketPicks>;
};

export const MARKET_LABEL: Record<MarketId, string> = { kospi: "코스피", sp500: "S&P 500" };

export function fmtPrice(market: MarketId, p: number): string {
  return market === "kospi"
    ? `${Math.round(p).toLocaleString("ko-KR")}원`
    : `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(p: number, sign = false): string {
  return `${sign && p > 0 ? "+" : ""}${p.toFixed(1)}%`;
}

/** 원화는 정수, 달러는 센트까지. 소수점 긴 가격이 화면과 파일을 지저분하게 만든다 */
export function roundPrice(market: MarketId, p: number): number {
  return market === "kospi" ? Math.round(p) : Math.round(p * 100) / 100;
}

const CHART_BARS = 140;

export function chartOf(market: MarketId, ctx: Ctx): ChartData {
  const from = Math.max(0, ctx.bars.length - CHART_BARS);
  const r = (x: number | null) => (x == null ? null : roundPrice(market, x));
  return {
    bars: ctx.bars.slice(from).map((b) => ({
      t: b.t,
      o: roundPrice(market, b.o),
      h: roundPrice(market, b.h),
      l: roundPrice(market, b.l),
      c: roundPrice(market, b.c),
      v: b.v,
    })),
    ma5: ctx.ma5.slice(from).map(r),
    ma20: ctx.ma20.slice(from).map(r),
    ma60: ctx.ma60.slice(from).map(r),
    ma120: ctx.ma120.slice(from).map(r),
    ma240: ctx.ma240.slice(from).map(r),
  };
}

export function roundLevels(market: MarketId, l: Levels): Levels {
  return {
    legLow: roundPrice(market, l.legLow),
    legHigh: roundPrice(market, l.legHigh),
    waist: roundPrice(market, l.waist),
    pullLow: l.pullLow == null ? null : roundPrice(market, l.pullLow),
  };
}
