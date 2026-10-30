/**
 * 관심 종목을 규칙대로 매매했다면 어땠는지 잰다. 사이트 화면과 무관한 보고용이다.
 *
 *   npm run backtest:watch    .cache/bars5y(npm run backtest가 만든 시세)로 .cache/watch-backtest.json을 쓴다
 *
 * 두 가지를 따로 잰다. 섞으면 안 된다:
 * 1) 과거 매일의 관심 종목: 그날 화면과 같은 방식으로 시장별 상위 12개를 뽑고, 오른 뒤 20거래일 안에 신호가 나오면 매매한다.
 *    그날까지의 정보만 쓰므로 실제로 이 목록을 따랐을 때에 가깝다.
 * 2) 오늘의 관심 종목: 오늘 목록에 오른 종목의 5년 기록이다. 오늘 강한 종목을 고른 뒤 과거를 보는 것이라 결과가 좋게 나온다.
 *    종목별 성격을 보는 용도이지 규칙의 성적이 아니다.
 *
 * 진입·청산·비용 가정은 lib/backtest.ts와 같다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COST, groupBy, LIQUIDITY, liquid, marketIndex, regimeUp, simulate, summarize, type Summary, type Trade } from "../lib/backtest";
import type { PicksFile } from "../lib/picks";
import { analyze, EXIT_MODE, MIN_BARS, prepare, RULES_VERSION, USE_REGIME } from "../lib/rules";
import type { Bar, MarketId, Universe, WatchId } from "../lib/types";

const CACHE = join(process.cwd(), ".cache", "bars5y");
/** 관심 종목에 오른 뒤 신호를 기다리는 기간(거래일). 약 한 달 */
const WAIT_DAYS = 20;
/** 화면과 같은 값 (scripts/refresh.ts) */
const WATCH_LIMIT = 12;

const period = (date: string) => (date < "2025" ? "2022-2024" : "2025-2026");

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function se(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) / Math.sqrt(xs.length);
}

type StockRow = {
  symbol: string;
  code: string;
  name: string;
  market: MarketId;
  n: number;
  wins: number;
  avgRet: number;
  /** 매번 전액을 넣어 이어서 굴렸을 때의 누적 수익률 */
  cumRet: number;
  avgHeld: number;
  maxHeld: number;
  best: number;
  worst: number;
  stops: number;
  stillOpen: number;
  firstEntry: string | null;
  lastEntry: string | null;
};

function stockRow(item: { symbol: string; code: string; name: string }, market: MarketId, ts: Trade[]): StockRow {
  const rets = ts.map((x) => x.ret);
  return {
    symbol: item.symbol,
    code: item.code,
    name: item.name,
    market,
    n: ts.length,
    wins: ts.filter((x) => x.ret > 0).length,
    avgRet: mean(rets),
    cumRet: (rets.reduce((a, r) => a * (1 + r / 100), 1) - 1) * 100,
    avgHeld: mean(ts.map((x) => x.held)),
    maxHeld: ts.length ? Math.max(...ts.map((x) => x.held)) : 0,
    best: ts.length ? Math.max(...rets) : 0,
    worst: ts.length ? Math.min(...rets) : 0,
    stops: ts.filter((x) => x.outcome === "stop").length,
    stillOpen: ts.filter((x) => x.open).length,
    firstEntry: ts[0]?.entryDate ?? null,
    lastEntry: ts[ts.length - 1]?.entryDate ?? null,
  };
}

type Loaded = { item: Universe["kospi"][number]; bars: Bar[] };

function loadMarket(items: Universe["kospi"]): Loaded[] {
  const out: Loaded[] = [];
  for (const item of items) {
    const file = join(CACHE, `${item.symbol}.json`);
    if (!existsSync(file)) continue;
    const bars: Bar[] = JSON.parse(readFileSync(file, "utf8"));
    if (bars.length >= 150) out.push({ item, bars });
  }
  return out;
}

/** 날짜별로 그날 화면에 나왔을 관심 종목. refresh.ts의 고르는 방식과 같다 */
function dailyWatchlists(market: MarketId, loaded: Loaded[]): Map<string, string[]> {
  const byDate = new Map<string, { symbol: string; id: WatchId; score: number }[]>();
  for (const { item, bars } of loaded) {
    const ctx = prepare(bars);
    for (let t = MIN_BARS; t < bars.length; t++) {
      if (!liquid(bars, t, LIQUIDITY[market])) continue;
      const w = analyze(ctx, t).watch;
      if (!w || (w.id === "pullback_weak" && w.score < 10)) continue;
      const day = byDate.get(bars[t].t) ?? [];
      day.push({ symbol: item.symbol, id: w.id, score: w.score });
      byDate.set(bars[t].t, day);
    }
  }
  return new Map([...byDate].map(([d, xs]) => [d, xs.sort((a, b) => b.score - a.score).slice(0, WATCH_LIMIT).map((x) => x.symbol)]));
}

type Episode = { symbol: string; first: string; last: string; days: number; traded: boolean; fwd20: number | null; fwd20Excess: number | null };

function main() {
  const universe: Universe = JSON.parse(readFileSync("data/universe.json", "utf8"));
  const picks: PicksFile = JSON.parse(readFileSync("data/picks.json", "utf8"));
  const report: Record<string, unknown> = { rulesVersion: RULES_VERSION, generatedAt: new Date().toISOString(), waitDays: WAIT_DAYS, assumptions: { exit: EXIT_MODE, regime: USE_REGIME, cost: COST, liquidity: LIQUIDITY } };
  const markets: Record<string, unknown> = {};

  for (const market of ["kospi", "sp500"] as const) {
    const loaded = loadMarket(universe[market]);
    const index = marketIndex(loaded.map((x) => x.bars));
    const regime = USE_REGIME ? regimeUp(index) : undefined;
    const calendar = [...index.keys()];
    const position = new Map(calendar.map((d, i) => [d, i]));
    const lists = dailyWatchlists(market, loaded);

    // 종목별로 관심 목록에 오른 날짜를 모은다
    const watchDays = new Map<string, number[]>();
    for (const [d, syms] of lists) {
      for (const s of syms) {
        const arr = watchDays.get(s) ?? [];
        arr.push(position.get(d)!);
        watchDays.set(s, arr);
      }
    }

    const followed: Trade[] = [];
    const rows: StockRow[] = [];
    const episodes: Episode[] = [];
    for (const { item, bars } of loaded) {
      const days = (watchDays.get(item.symbol) ?? []).sort((a, b) => a - b);
      if (!days.length) continue;
      const eligible = (date: string) => {
        const p = position.get(date);
        if (p == null) return false;
        return days.some((w) => w < p && p - w <= WAIT_DAYS);
      };
      const ts = simulate(market, item.symbol, bars, index, { exit: EXIT_MODE, regime, eligible });
      followed.push(...ts);
      rows.push(stockRow(item, market, ts));

      // 신호 없이 끝난 경우까지 포함해 목록 자체의 힘을 잰다. 오른 날 종가에 샀다고 치고 20거래일 뒤를 본다
      const barIndex = new Map(bars.map((b, i) => [b.t, i]));
      let start = 0;
      for (let i = 1; i <= days.length; i++) {
        if (i < days.length && days[i] - days[i - 1] <= WAIT_DAYS) continue;
        const first = calendar[days[start]];
        const last = calendar[days[i - 1]];
        const until = days[i - 1] + WAIT_DAYS;
        const b0 = barIndex.get(first);
        let fwd20: number | null = null;
        let fwd20Excess: number | null = null;
        if (b0 != null && b0 + 20 < bars.length) {
          fwd20 = (bars[b0 + 20].c / bars[b0].c - 1) * 100;
          const m0 = index.get(bars[b0].t);
          const m1 = index.get(bars[b0 + 20].t);
          if (m0 && m1) fwd20Excess = fwd20 - (m1 / m0 - 1) * 100;
        }
        const traded = ts.some((x) => {
          const p = position.get(x.date)!;
          return p > days[start] && p <= until;
        });
        episodes.push({ symbol: item.symbol, first, last, days: i - start, traded, fwd20, fwd20Excess });
        start = i;
      }
    }

    // 비교 기준: 관심 목록과 상관없이 나온 모든 신호
    const allSignals = loaded.flatMap(({ item, bars }) => simulate(market, item.symbol, bars, index, { exit: EXIT_MODE, regime }));
    const nameOf = new Map(loaded.map((x) => [x.item.symbol, x.item.name]));
    const sumBy = (ts: Trade[], key: (x: Trade) => string) => Object.fromEntries(Object.entries(groupBy(ts, key)).map(([k, v]) => [k, summarize(v)])) as Record<string, Summary>;

    // 오늘의 관심 종목 5년 기록
    const m = picks.markets[market];
    const today = [...m.signals.map((p) => ({ p, state: "신호" })), ...m.held.map((p) => ({ p, state: "보류" })), ...m.watch.map((p) => ({ p, state: p.watch.id }))].flatMap(({ p, state }) => {
      const found = loaded.find((x) => x.item.symbol === p.symbol);
      if (!found) return [];
      const { bars } = found;
      const ts = simulate(market, p.symbol, bars, index, { exit: EXIT_MODE, regime });
      const days = watchDays.get(p.symbol) ?? [];
      const hold = (bars[bars.length - 1].c / bars[MIN_BARS].c - 1) * 100;
      return [{ ...stockRow(found.item, market, ts), state, watchDays: days.length, buyHold: hold, from: bars[MIN_BARS].t, to: bars[bars.length - 1].t, trades: ts }];
    });

    const withFwd = episodes.filter((e) => e.fwd20Excess != null);
    markets[market] = {
      symbols: loaded.length,
      from: calendar[0],
      to: calendar[calendar.length - 1],
      listDays: lists.size,
      followed: {
        all: summarize(followed),
        byPeriod: sumBy(followed, (x) => period(x.date)),
        bySetup: sumBy(followed, (x) => x.setup),
        byYear: sumBy(followed, (x) => x.year),
      },
      allSignals: { all: summarize(allSignals), byPeriod: sumBy(allSignals, (x) => period(x.date)), bySetup: sumBy(allSignals, (x) => x.setup) },
      episodes: {
        n: episodes.length,
        traded: episodes.filter((e) => e.traded).length,
        fwd20: mean(withFwd.map((e) => e.fwd20!)),
        fwd20Excess: mean(withFwd.map((e) => e.fwd20Excess!)),
        fwd20ExcessSe: se(withFwd.map((e) => e.fwd20Excess!)),
        byPeriod: Object.fromEntries(
          Object.entries(groupBy(withFwd, (e) => period(e.first))).map(([k, v]) => [k, { n: v.length, fwd20: mean(v.map((e) => e.fwd20!)), fwd20Excess: mean(v.map((e) => e.fwd20Excess!)), fwd20ExcessSe: se(v.map((e) => e.fwd20Excess!)) }]),
        ),
      },
      stocks: rows.filter((r) => r.n > 0).sort((a, b) => b.cumRet - a.cumRet),
      stocksWithoutTrade: rows.filter((r) => r.n === 0).length,
      trades: followed.map((t) => ({ ...t, name: nameOf.get(t.symbol) })).sort((a, b) => a.date.localeCompare(b.date)),
      today,
    };

    const f = summarize(followed);
    const a = summarize(allSignals);
    console.log(`\n[${market}] ${loaded.length}종목 ${calendar[0]}~${calendar[calendar.length - 1]}, 목록 ${lists.size}일`);
    console.log(`  관심 목록 → 신호 매매: ${f.n}건 승률 ${f.winRate.toFixed(0)}% 평균 ${f.avgRet.toFixed(2)}% 중앙 ${f.medianRet.toFixed(2)}% 보유 ${f.avgHeld.toFixed(1)}일 손절 ${f.stopRate.toFixed(0)}% 20일 시장대비 ${f.fwd20Excess.toFixed(2)}±${f.fwd20ExcessSe.toFixed(2)}`);
    for (const [k, s] of Object.entries(sumBy(followed, (x) => period(x.date)))) console.log(`    ${k}: ${s.n}건 승률 ${s.winRate.toFixed(0)}% 평균 ${s.avgRet.toFixed(2)}% 보유 ${s.avgHeld.toFixed(1)}일 20일 시장대비 ${s.fwd20Excess.toFixed(2)}±${s.fwd20ExcessSe.toFixed(2)}`);
    for (const [k, s] of Object.entries(sumBy(followed, (x) => x.setup))) console.log(`    ${k}: ${s.n}건 승률 ${s.winRate.toFixed(0)}% 평균 ${s.avgRet.toFixed(2)}% 보유 ${s.avgHeld.toFixed(1)}일`);
    console.log(`  모든 신호(비교): ${a.n}건 승률 ${a.winRate.toFixed(0)}% 평균 ${a.avgRet.toFixed(2)}% 보유 ${a.avgHeld.toFixed(1)}일 20일 시장대비 ${a.fwd20Excess.toFixed(2)}±${a.fwd20ExcessSe.toFixed(2)}`);
    console.log(`  목록에 오른 횟수 ${episodes.length}, 그중 신호 매매로 이어짐 ${episodes.filter((e) => e.traded).length}, 오른 날 기준 20일 시장대비 ${mean(withFwd.map((e) => e.fwd20Excess!)).toFixed(2)}±${se(withFwd.map((e) => e.fwd20Excess!)).toFixed(2)}`);
    console.log(`  오늘의 관심 종목:`);
    for (const r of today) console.log(`    ${r.name} ${r.state}: ${r.n}건 승 ${r.wins} 평균 ${r.avgRet.toFixed(1)}% 누적 ${r.cumRet.toFixed(1)}% 평균보유 ${r.avgHeld.toFixed(0)}일 최대 ${r.maxHeld}일 (보유만 ${r.buyHold.toFixed(0)}%) 목록 ${r.watchDays}일 미청산 ${r.stillOpen}`);
  }

  report.markets = markets;
  writeFileSync(".cache/watch-backtest.json", JSON.stringify(report));
  console.log("\n.cache/watch-backtest.json 저장");
}

main();
