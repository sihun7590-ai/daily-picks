/**
 * 강의 기준으로 되돌린 변형들을 같은 조건에서 비교한다. 사이트와 무관하다.
 *   npx tsx scripts/compare.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LIQUIDITY, liquid, marketIndex, regimeUp, simulate, summarize, type Trade } from "../lib/backtest";
import { EXIT_MODE, P } from "../lib/rules";
import type { Bar, MarketId, Universe } from "../lib/types";

const universe: Universe = JSON.parse(readFileSync("data/universe.json", "utf8"));
const data = Object.fromEntries(
  (["kospi", "sp500"] as const).map((m) => [
    m,
    universe[m].flatMap((it) => {
      const f = join(".cache", "bars5y", `${it.symbol}.json`);
      const bars: Bar[] = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
      return bars.length >= 150 ? [{ symbol: it.symbol, bars }] : [];
    }),
  ]),
) as Record<MarketId, { symbol: string; bars: Bar[] }[]>;
const index = { kospi: marketIndex(data.kospi.map((x) => x.bars)), sp500: marketIndex(data.sp500.map((x) => x.bars)) };
const regime = { kospi: regimeUp(index.kospi), sp500: regimeUp(index.sp500) };

// 거래대금 하한에 걸리는 종목-일 비율
for (const m of ["kospi", "sp500"] as const) {
  let all = 0;
  const below: Record<string, number> = {};
  const lims = m === "sp500" ? [5e7, 2e7, 1e7, 5e6] : [3e9, 1e9, 5e8];
  const syms = new Set<string>();
  for (const { symbol, bars } of data[m])
    for (let t = 130; t < bars.length; t++) {
      all++;
      for (const l of lims) if (!liquid(bars, t, l)) { below[l] = (below[l] ?? 0) + 1; if (l === lims[0]) syms.add(symbol); }
    }
  console.log(`[${m}] 거래대금 미달 종목-일 비율`, Object.fromEntries(lims.map((l) => [l, `${(((below[l] ?? 0) / all) * 100).toFixed(2)}%`])), `현재 하한에 한 번이라도 걸린 종목 ${syms.size}개`);
}

const base = JSON.parse(JSON.stringify({ P, LIQUIDITY }));
function reset() {
  for (const k of Object.keys(base.P)) Object.assign((P as any)[k], base.P[k]);
  Object.assign(LIQUIDITY, base.LIQUIDITY);
}

function run(label: string, setup: () => void) {
  reset();
  setup();
  const out: string[] = [label.padEnd(34)];
  for (const m of ["kospi", "sp500"] as const) {
    const ts: Trade[] = data[m].flatMap(({ symbol, bars }) => simulate(m, symbol, bars, index[m], { exit: EXIT_MODE, regime: regime[m] }));
    for (const [p, f] of [["22-24", (x: Trade) => x.year <= "2024"], ["25-26", (x: Trade) => x.year >= "2025"]] as const) {
      const s = summarize(ts.filter(f));
      out.push(`${m === "kospi" ? "K" : "S"}${p} ${String(s.n).padStart(3)}건 ${s.avgRet.toFixed(2).padStart(6)}% 중앙${s.medianRet.toFixed(1).padStart(5)} 시장대비${s.fwd20Excess.toFixed(1).padStart(5)}±${s.fwd20ExcessSe.toFixed(1)}`);
    }
  }
  console.log(out.join(" | "));
}

const lecture = () => {
  P.trend.lectureMas = true;
  P.trend.useHigh = false;
  P.base.resistance = "line";
  P.leg.maxAge = 240;
  P.trigger.needMaUp = true;
};
const v2 = () => {
  P.trend.lectureMas = false;
  P.trend.useHigh = true;
  P.base.resistance = "high60";
  P.leg.maxAge = 60;
  P.trigger.needMaUp = false;
  LIQUIDITY.sp500 = 5e7;
};
run("2판", v2);
run("3판(강의 기준)", () => {});
run("3판에서 기준봉 거래량 1.5배", () => { P.base.minVolRatio = 1.5; });
run("3판에서 수평선 대신 60일 신고가", () => { P.base.resistance = "high60"; });
run("3판에서 5·20일선 조건 없음", () => { P.trigger.needMaUp = false; });
run("3판에서 1년 고점 85% 되살림", () => { P.trend.useHigh = true; });
