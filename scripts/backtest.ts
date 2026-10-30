/**
 * 사이트에 보여 주는 과거 검증 숫자를 만든다. 측정 방식은 lib/backtest.ts 주석을 보라.
 *
 *   npm run backtest            캐시가 없으면 5년치를 받고 data/backtest.json을 쓴다
 *   npm run backtest -- --fresh 캐시를 무시하고 다시 받는다
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COST, groupBy, LIQUIDITY, marketIndex, regimeUp, simulate, summarize, type Trade } from "../lib/backtest";
import { EXIT_MODE, RULES_VERSION, USE_REGIME } from "../lib/rules";
import type { Bar, Universe } from "../lib/types";
import { fetchBars, mapPool } from "../lib/yahoo";

const CACHE = join(process.cwd(), ".cache", "bars5y");

async function loadBars(symbol: string, fresh: boolean): Promise<Bar[]> {
  const file = join(CACHE, `${symbol}.json`);
  if (!fresh && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const bars = await fetchBars(symbol, "5y");
  writeFileSync(file, JSON.stringify(bars));
  return bars;
}

function table(title: string, groups: Record<string, Trade[]>) {
  console.log(`\n${title}`);
  console.log("구분".padEnd(22), "건수".padStart(6), "목표%".padStart(7), "손절%".padStart(7), "승률%".padStart(7), "평균%".padStart(7), "중앙%".padStart(7), "평균R".padStart(7), "보유".padStart(6), "20일%".padStart(7), "20일초과".padStart(8), "±".padStart(6));
  for (const [k, ts] of Object.entries(groups).sort()) {
    const s = summarize(ts);
    console.log(
      k.padEnd(22),
      String(s.n).padStart(6),
      s.targetRate.toFixed(1).padStart(7),
      s.stopRate.toFixed(1).padStart(7),
      s.winRate.toFixed(1).padStart(7),
      s.avgRet.toFixed(2).padStart(7),
      s.medianRet.toFixed(2).padStart(7),
      s.avgR.toFixed(2).padStart(7),
      s.avgHeld.toFixed(1).padStart(6),
      s.fwd20.toFixed(2).padStart(7),
      s.fwd20Excess.toFixed(2).padStart(8),
      s.fwd20ExcessSe.toFixed(2).padStart(6),
    );
  }
}

const period = (x: Trade) => (x.year <= "2024" ? "2022-2024" : "2025-2026");

async function main() {
  const fresh = process.argv.includes("--fresh");
  mkdirSync(CACHE, { recursive: true });
  const universe: Universe = JSON.parse(readFileSync("data/universe.json", "utf8"));
  const trades: Trade[] = [];
  const coverage: Record<string, { symbols: number; from: string; to: string }> = {};

  for (const market of ["kospi", "sp500"] as const) {
    const items = universe[market];
    let failed = 0;
    let done = 0;
    const loaded = await mapPool(items, 8, async (it) => {
      try {
        const bars = await loadBars(it.symbol, fresh);
        if (++done % 200 === 0) console.log(`${market}: ${done}/${items.length}`);
        return { symbol: it.symbol, bars };
      } catch {
        failed++;
        return { symbol: it.symbol, bars: [] as Bar[] };
      }
    });
    const usable = loaded.filter((x) => x.bars.length >= 150);
    console.log(`${market}: 사용 ${usable.length} / 실패 ${failed}`);
    const index = marketIndex(usable.map((x) => x.bars));
    const regime = USE_REGIME ? regimeUp(index) : undefined;
    const dates = [...index.keys()];
    coverage[market] = { symbols: usable.length, from: dates[0], to: dates[dates.length - 1] };
    for (const { symbol, bars } of usable) trades.push(...simulate(market, symbol, bars, index, { exit: EXIT_MODE, regime }));
  }

  for (const market of ["kospi", "sp500"] as const) {
    const ts = trades.filter((x) => x.market === market);
    table(`[${market}] 신호 유형별`, groupBy(ts, (x) => x.setup));
    table(`[${market}] 연도별`, groupBy(ts, (x) => x.year));
    table(`[${market}] 기간별`, groupBy(ts, period));
    table(`[${market}] 전체`, { 전체: ts });
  }

  const out = {
    rulesVersion: RULES_VERSION,
    generatedAt: new Date().toISOString(),
    assumptions: { exit: EXIT_MODE, regime: USE_REGIME, cost: COST, liquidity: LIQUIDITY },
    coverage,
    markets: Object.fromEntries(
      (["kospi", "sp500"] as const).map((m) => {
        const ts = trades.filter((x) => x.market === m);
        const sum = (g: Record<string, Trade[]>) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, summarize(v)]));
        return [m, { all: summarize(ts), bySetup: sum(groupBy(ts, (x) => x.setup)), byYear: sum(groupBy(ts, (x) => x.year)), byPeriod: sum(groupBy(ts, period)) }];
      }),
    ),
  };
  writeFileSync("data/backtest.json", JSON.stringify(out, null, 1));
  console.log("\ndata/backtest.json 저장");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
