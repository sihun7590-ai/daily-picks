/**
 * 규칙 변형 비교용. 사이트와 무관하고, 임계값을 정할 때만 쓴다.
 *
 *   npx tsx scripts/research.ts
 *
 * 2022~2024(고르는 구간)와 2025~2026(확인 구간)을 나눠 출력한다.
 * 고르는 구간으로만 판단한다. 확인 구간을 보고 규칙을 또 고치면 그 구간도 오염된다.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { marketIndex, regimeUp, simulate, summarize, type ExitMode, type Trade } from "../lib/backtest";
import { P } from "../lib/rules";
import type { Bar, MarketId, Universe } from "../lib/types";

const universe: Universe = JSON.parse(readFileSync("data/universe.json", "utf8"));

function load(market: MarketId) {
  return universe[market]
    .map((it) => {
      const file = join(".cache", "bars5y", `${it.symbol}.json`);
      return { symbol: it.symbol, bars: existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Bar[]) : [] };
    })
    .filter((x) => x.bars.length >= 150);
}
const data = { kospi: load("kospi"), sp500: load("sp500") };
const idx = { kospi: marketIndex(data.kospi.map((x) => x.bars)), sp500: marketIndex(data.sp500.map((x) => x.bars)) };
const reg = { kospi: regimeUp(idx.kospi), sp500: regimeUp(idx.sp500) };

type Variant = {
  name: string;
  exit?: ExitMode;
  regime?: boolean;
  /** 이 유형은 결과에서 뺀다 */
  drop?: string[];
  apply?: () => void;
};

const baseline = JSON.parse(JSON.stringify(P));
function reset() {
  for (const k of Object.keys(baseline)) Object.assign((P as Record<string, object>)[k], baseline[k]);
}

function run(v: Variant) {
  reset();
  v.apply?.();
  const rows: string[] = [];
  for (const m of ["kospi", "sp500"] as const) {
    let trades: Trade[] = [];
    for (const { symbol, bars } of data[m]) {
      trades.push(...simulate(m, symbol, bars, idx[m], { exit: v.exit ?? "fixed", regime: v.regime ? reg[m] : undefined }));
    }
    if (v.drop) trades = trades.filter((t) => !v.drop!.includes(t.setup));
    const pick = summarize(trades.filter((t) => t.year <= "2024"));
    const hold = summarize(trades.filter((t) => t.year >= "2025"));
    const f = (s: ReturnType<typeof summarize>) =>
      `${String(s.n).padStart(4)}건 승률${s.winRate.toFixed(0).padStart(3)}% 평균${s.avgRet.toFixed(2).padStart(6)}% R${s.avgR.toFixed(2).padStart(6)} 보유${s.avgHeld.toFixed(0).padStart(3)} 20일초과${s.fwd20Excess.toFixed(2).padStart(6)}±${s.fwd20ExcessSe.toFixed(2)}`;
    rows.push(`  ${m.padEnd(6)} 선택 ${f(pick)}`);
    // 2025~는 최종 규칙을 정한 뒤 npm run backtest로 한 번만 본다
    void hold;
  }
  console.log(`\n■ ${v.name}\n${rows.join("\n")}`);
}

const J = { regime: true, exit: "half_trail" as const };
const set = (fn: (p: typeof P) => void) => () => fn(P);
const all: Variant[] = [
  { name: "H. 1년고점 85%+ · 복귀 신호 제외" },
  { name: "I. H + 시장 60일선 위", regime: true },
  { name: "J. I + 절반 익절·20일선 추적", ...J },
  { name: "K. J + 눌림 확인 제외", ...J, drop: ["pullback_confirm"] },
  { name: "L. J + 1년고점 90%+", ...J, apply: set((p) => void (p.trend.minVsHigh = 0.9)) },
  { name: "M. J + 눌림 확인에 거래량 평균 이상 요구", ...J, apply: set((p) => void (p.trigger.confirmMinVol = 1)) },
  {
    name: "N. J + 돌파 조건 완화(수렴폭 2.5배, 돌파 거래량 1배, 눌림 거래감소 1.0)",
    ...J,
    apply: set((p) => {
      p.pullback.boxMaxWidthVsRange = 2.5;
      p.trigger.breakoutVol = 1;
      p.pullback.maxDryUp = 1;
    }),
  },
  {
    name: "O. M + N",
    ...J,
    apply: set((p) => {
      p.trigger.confirmMinVol = 1;
      p.pullback.boxMaxWidthVsRange = 2.5;
      p.trigger.breakoutVol = 1;
      p.pullback.maxDryUp = 1;
    }),
  },
];
for (const v of all) run(v);
