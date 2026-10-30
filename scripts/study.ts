/**
 * 어떤 상태가 이후 수익과 관계 있는지 보는 탐색. 2022~2024만 본다(2025~는 검증용으로 남겨 둔다).
 * 사이트와 무관하다.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LIQUIDITY, liquid, marketIndex } from "../lib/backtest";
import { analyze, prepare } from "../lib/rules";
import type { Bar, MarketId, Universe } from "../lib/types";

const universe: Universe = JSON.parse(readFileSync("data/universe.json", "utf8"));
const END = "2024-12-31";

function load(market: MarketId) {
  return universe[market]
    .map((it) => {
      const file = join(".cache", "bars5y", `${it.symbol}.json`);
      return { symbol: it.symbol, bars: existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Bar[]) : [] };
    })
    .filter((x) => x.bars.length >= 150);
}

type Row = { group: string; ex: number };

function stats(rows: number[]) {
  const n = rows.length;
  const m = rows.reduce((a, b) => a + b, 0) / (n || 1);
  const sd = Math.sqrt(rows.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(n - 1, 1));
  const win = rows.filter((x) => x > 0).length / (n || 1);
  return { n, m, se: sd / Math.sqrt(n || 1), win };
}

for (const m of ["kospi", "sp500"] as const) {
  const data = load(m);
  const idx = marketIndex(data.map((x) => x.bars));

  // 날짜별 60일 수익률 순위 (상대강도). 그 날까지의 데이터만 쓴다
  const byDate = new Map<string, { sym: string; r: number }[]>();
  for (const { symbol, bars } of data) {
    for (let i = 60; i < bars.length; i++) {
      const a = byDate.get(bars[i].t) ?? [];
      a.push({ sym: symbol, r: bars[i].c / bars[i - 60].c - 1 });
      byDate.set(bars[i].t, a);
    }
  }
  const rank = new Map<string, number>();
  for (const [d, a] of byDate) {
    a.sort((x, y) => x.r - y.r);
    a.forEach((x, i) => rank.set(`${d}|${x.sym}`, i / a.length));
  }

  const rows: Row[] = [];
  const add = (g: string, ex: number) => rows.push({ group: g, ex });
  for (const { symbol, bars } of data) {
    const ctx = prepare(bars);
    for (let t = 130; t < bars.length - 21; t++) {
      if (bars[t].t > END) break;
      if (!liquid(bars, t, LIQUIDITY[m])) continue;
      const entry = bars[t + 1].o;
      const m0 = idx.get(bars[t + 1].t);
      const m1 = idx.get(bars[t + 21].t);
      if (!m0 || !m1 || entry <= 0) continue;
      const ex = (bars[t + 21].c / entry - 1 - (m1 / m0 - 1)) * 100;
      if (Math.abs(ex) > 150) continue;

      const a = analyze(ctx, t);
      const rs = rank.get(`${bars[t].t}|${symbol}`) ?? 0;
      let hi = -Infinity;
      for (let k = Math.max(0, t - 239); k <= t; k++) hi = Math.max(hi, bars[k].h);
      const near = bars[t].c / hi;

      add("00 전체", ex);
      add(`10 단계:${a.stage}`, ex);
      if (a.watch) add(`20 관찰:${a.watch.id}`, ex);
      if (a.signal) add(`30 신호:${a.signal.setup}`, ex);
      if (a.stage !== "trend" && a.stage !== "history") {
        add(`40 추세통과 RS:${rs >= 0.8 ? "상위20%" : rs >= 0.5 ? "중간" : "하위50%"}`, ex);
        add(`41 추세통과 고가대비:${near >= 0.95 ? "95%+" : near >= 0.85 ? "85-95%" : "<85%"}`, ex);
      }
      if (a.watch?.id === "pullback_forming") {
        add(`50 눌림진행 RS:${rs >= 0.8 ? "상위20%" : rs >= 0.5 ? "중간" : "하위50%"}`, ex);
        add(`51 눌림진행 고가대비:${near >= 0.95 ? "95%+" : near >= 0.85 ? "85-95%" : "<85%"}`, ex);
      }
      if (a.signal) {
        add(`60 신호 RS:${rs >= 0.8 ? "상위20%" : rs >= 0.5 ? "중간" : "하위50%"}`, ex);
        add(`61 신호 고가대비:${near >= 0.95 ? "95%+" : near >= 0.85 ? "85-95%" : "<85%"}`, ex);
      }
    }
  }
  const groups = new Map<string, number[]>();
  for (const r of rows) (groups.get(r.group) ?? groups.set(r.group, []).get(r.group)!).push(r.ex);
  console.log(`\n=== ${m} (2022~2024, 다음날 시가 진입 → 20봉 뒤 종가, 시장 평균 대비 초과수익 %) ===`);
  for (const g of [...groups.keys()].sort()) {
    const s = stats(groups.get(g)!);
    console.log(g.padEnd(34), String(s.n).padStart(8), s.m.toFixed(2).padStart(7), `±${s.se.toFixed(2)}`.padStart(7), `승률${(s.win * 100).toFixed(0)}%`.padStart(7));
  }
}
