/**
 * 매일 한 번 돈다: 시세 수집 → 규칙 판정 → data/picks.json + data/history/<날짜>.json.
 * GitHub Actions가 결과를 커밋하면 Vercel이 다시 배포한다.
 *
 *   npm run refresh
 *
 * 나쁜 실행은 안 도는 것보다 나쁘다. 수집 실패가 많으면 파일을 건드리지 않고 실패로 끝낸다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { LIQUIDITY, liquid, marketIndex, regimeUp } from "../lib/backtest";
import { MARKET_LABEL, roundPrice, type ChartData, type MarketPicks, type PicksFile, type SignalPick, type WatchPick } from "../lib/picks";
import { analyze, prepare, RULES_VERSION, USE_REGIME, type Ctx } from "../lib/rules";
import type { Bar, Levels, MarketId, UniverseItem } from "../lib/types";
import { fetchBars, mapPool } from "../lib/yahoo";
import { refreshUniverse } from "./universe";

/** 시장별 수집 실패 허용 비율. 넘으면 소스가 죽었거나 막힌 것이다 */
const MAX_FAILURE_RATE = 0.1;
const CHART_BARS = 140;
const WATCH_LIMIT = 12;

function chartOf(market: MarketId, ctx: Ctx): ChartData {
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

function roundLevels(market: MarketId, l: Levels): Levels {
  return {
    legLow: roundPrice(market, l.legLow),
    legHigh: roundPrice(market, l.legHigh),
    waist: roundPrice(market, l.waist),
    pullLow: l.pullLow == null ? null : roundPrice(market, l.pullLow),
  };
}

/** 가장 많은 종목이 가진 마지막 날짜. 거래정지 종목의 옛 날짜에 끌려가지 않는다 */
function latestDate(all: Bar[][]): string {
  const counts = new Map<string, number>();
  for (const bars of all) {
    if (!bars.length) continue;
    const t = bars[bars.length - 1].t;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? "";
}

async function runMarket(market: MarketId, items: UniverseItem[]): Promise<MarketPicks> {
  let failed = 0;
  const fetched = await mapPool(items, 8, async (item) => {
    try {
      return { item, bars: await fetchBars(item.symbol, "2y") };
    } catch {
      failed++;
      return { item, bars: [] as Bar[] };
    }
  });
  const empty = fetched.filter((x) => !x.bars.length).length;
  const rate = empty / items.length;
  console.log(`${MARKET_LABEL[market]}: ${items.length}종목, 시세 없음 ${empty} (오류 ${failed})`);
  if (rate > MAX_FAILURE_RATE) {
    throw new Error(`${MARKET_LABEL[market]} 수집 실패 ${(rate * 100).toFixed(0)}% — 파일을 쓰지 않습니다`);
  }

  const usable = fetched.filter((x) => x.bars.length > 1);
  const asOf = latestDate(usable.map((x) => x.bars));
  const index = marketIndex(usable.map((x) => x.bars));
  const up = regimeUp(index).has(asOf);

  const funnel: MarketPicks["funnel"] = {};
  const bump = (k: keyof MarketPicks["funnel"]) => (funnel[k] = (funnel[k] ?? 0) + 1);
  const signals: SignalPick[] = [];
  const watch: WatchPick[] = [];

  for (const { item, bars } of usable) {
    const t = bars.length - 1;
    // 그날 거래가 없던 종목에 어제 신호를 오늘 신호처럼 내보내면 안 된다
    if (bars[t].t !== asOf) {
      bump("stale");
      continue;
    }
    if (t >= 20 && !liquid(bars, t, LIQUIDITY[market])) {
      bump("illiquid");
      continue;
    }
    const ctx = prepare(bars);
    const a = analyze(ctx, t);
    bump(a.stage);
    if (!a.signal && !a.watch) continue;
    const meta = {
      code: item.code,
      symbol: item.symbol,
      name: item.name,
      sector: item.sector,
      close: roundPrice(market, bars[t].c),
      changePct: (bars[t].c / bars[t - 1].c - 1) * 100,
      chart: chartOf(market, ctx),
    };
    if (a.signal) {
      const s = a.signal;
      signals.push({
        ...meta,
        signal: {
          ...s,
          entry: roundPrice(market, s.entry),
          stop: roundPrice(market, s.stop),
          target: roundPrice(market, s.target),
          levels: roundLevels(market, s.levels),
        },
      });
    } else if (a.watch) {
      const w = a.watch;
      watch.push({
        ...meta,
        watch: {
          ...w,
          trigger: w.trigger == null ? null : roundPrice(market, w.trigger),
          stop: w.stop == null ? null : roundPrice(market, w.stop),
          levels: roundLevels(market, w.levels),
        },
      });
    }
  }

  signals.sort((a, b) => b.signal.score - a.signal.score);
  // 부족한 게 많은 눌림은 관심 목록에 올려도 볼 이유가 없다
  const worthWatching = watch.filter((p) => p.watch.id !== "pullback_weak" || p.watch.score >= 10);
  worthWatching.sort((a, b) => b.watch.score - a.watch.score);
  const hold = USE_REGIME && !up;
  return {
    id: market,
    asOf,
    regimeUp: up,
    universe: items.length,
    scanned: usable.length,
    failed: empty,
    funnel,
    signals: hold ? [] : signals,
    held: hold ? signals : [],
    watch: worthWatching.slice(0, WATCH_LIMIT),
  };
}

async function main() {
  const universe = await refreshUniverse();
  const markets = {
    kospi: await runMarket("kospi", universe.kospi),
    sp500: await runMarket("sp500", universe.sp500),
  };
  const out: PicksFile = { generatedAt: new Date().toISOString(), rulesVersion: RULES_VERSION, markets };
  writeFileSync("data/picks.json", JSON.stringify(out));

  // 앞으로의 실제 성적을 나중에 잴 수 있게 그날의 판정을 남긴다. 차트는 빼고 판단만.
  const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const brief = (m: MarketPicks) => ({
    asOf: m.asOf,
    regimeUp: m.regimeUp,
    funnel: m.funnel,
    signals: [...m.signals, ...m.held].map((p) => ({
      code: p.code,
      name: p.name,
      setup: p.signal.setup,
      entry: p.signal.entry,
      stop: p.signal.stop,
      target: p.signal.target,
      score: p.signal.score,
      held: m.held.includes(p),
    })),
    watch: m.watch.map((p) => ({ code: p.code, name: p.name, id: p.watch.id, trigger: p.watch.trigger, stop: p.watch.stop })),
  });
  mkdirSync("data/history", { recursive: true });
  writeFileSync(
    `data/history/${day}.json`,
    JSON.stringify({ rulesVersion: RULES_VERSION, generatedAt: out.generatedAt, kospi: brief(markets.kospi), sp500: brief(markets.sp500) }, null, 1),
  );

  for (const m of Object.values(markets)) {
    console.log(`${MARKET_LABEL[m.id]} ${m.asOf} 시장 ${m.regimeUp ? "상승" : "조정"} / 신호 ${m.signals.length} 보류 ${m.held.length} 대기 ${m.watch.length}`, m.funnel);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
