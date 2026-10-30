import backtest from "@/data/backtest.json";
import picks from "@/data/picks.json";
import type { Summary } from "./backtest";
import type { PicksFile } from "./picks";
import type { MarketId, SetupId } from "./types";

export const PICKS = picks as unknown as PicksFile;

export type BacktestMarket = {
  all: Summary;
  bySetup: Partial<Record<SetupId, Summary>>;
  byYear: Record<string, Summary>;
  byPeriod: Record<string, Summary>;
};

export const BACKTEST = backtest as unknown as {
  rulesVersion: number;
  generatedAt: string;
  coverage: Record<MarketId, { symbols: number; from: string; to: string }>;
  markets: Record<MarketId, BacktestMarket>;
};

export function findPick(market: MarketId, code: string) {
  const m = PICKS.markets[market];
  const signal = [...m.signals, ...m.held].find((p) => p.code === code);
  const watch = m.watch.find((p) => p.code === code);
  return { market: m, signal, watch };
}
