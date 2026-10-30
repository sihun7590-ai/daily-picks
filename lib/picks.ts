import type { Bar, MarketId, Signal, Stage, Watch } from "./types";

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
