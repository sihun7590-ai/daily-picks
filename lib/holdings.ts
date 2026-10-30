/**
 * 내 종목 화면의 서버 쪽. 종목을 저장하지 않는다 — 요청마다 받은 코드로 시세만 받아 계산해 돌려준다.
 * 저장소가 공개이므로 사용자가 넣은 종목이 파일이나 data/에 남으면 안 된다. 저장은 브라우저에서만 한다.
 */
import { LIQUIDITY, liquid } from "./backtest";
import { chartOf, roundLevels, roundPrice, type ChartData } from "./picks";
import { analyze, positionChecks, positionPlan, prepare } from "./rules";
import type { Check, Levels, MarketId, RulePlan, SetupId, Stage, WatchId } from "./types";
import { fetchChartInfo, type ChartInfo } from "./yahoo";

export const MAX_HOLDINGS = 30;

export type Holding = {
  symbol: string;
  code: string;
  /** Yahoo가 주는 이름. 목록에 있는 종목은 화면에서 한글 이름으로 바꾼다 */
  name: string;
  /** 가격 표기와 시장 국면을 고르는 데 쓴다. 원화면 kospi, 달러면 sp500 */
  market: MarketId;
  asOf: string;
  close: number;
  changePct: number;
  /** 후보 선정의 거래대금 기준을 넘는가 */
  liquid: boolean;
  analysis: { stage: Stage; setup: SetupId | null; watch: WatchId | null; note: string | null };
  plan: RulePlan;
  checks: Check[];
  levels: Levels | null;
  baseDate: string | null;
  chart: ChartData;
};

export type HoldingResult = { input: string; holding: Holding } | { input: string; error: string };

const MARKET_BY_CURRENCY: Record<string, MarketId> = { KRW: "kospi", USD: "sp500" };

/** 입력을 Yahoo 심볼 후보로. 형식이 아니면 빈 배열 — 이 값이 그대로 외부 요청 주소에 들어간다 */
export function symbolCandidates(input: string): string[] {
  const s = input.trim().toUpperCase();
  // 한국 코드는 숫자로 시작하는 6자리다. 저장된 접미사도 믿지 않고 매번 확인한다 — 코스닥에서 코스피로 옮기는 종목이 있다
  const kr = s.match(/^([0-9][0-9A-Z]{5})(\.K[SQ])?$/);
  if (kr) return [`${kr[1]}.KS`, `${kr[1]}.KQ`];
  // Yahoo는 BRK.B를 BRK-B로 쓴다
  if (/^[A-Z][A-Z0-9]{0,5}([.-][A-Z0-9]{1,2})?$/.test(s)) return [s.replace(".", "-")];
  return [];
}

/**
 * Yahoo는 다른 시장의 접미사를 붙여도 200을 주는데, 이때 현재가 정보가 오래돼 있다 (005935.KQ가 174,100원 대신 66,300원).
 * 코스닥 종목에 .KS를 붙이면 거래소가 KOE로 와서 걸러낼 수 있다. .KQ는 항상 KOE로 와서 구분이 안 되므로 .KS를 먼저 물어야 한다.
 */
export function isWrongSuffix(symbol: string, info: Pick<ChartInfo, "exchange">): boolean {
  return symbol.endsWith(".KS") && info.exchange === "KOE";
}

/** 시세가 부족하면 null. 원화·달러가 아니면 가격 표기를 맞출 수 없어 받지 않는다 */
export function buildHolding(symbol: string, info: ChartInfo): Holding | "unsupported" | null {
  const { bars } = info;
  if (bars.length < 2) return null;
  const market = MARKET_BY_CURRENCY[info.currency ?? ""];
  if (!market) return "unsupported";

  const t = bars.length - 1;
  const ctx = prepare(bars);
  const a = analyze(ctx, t);
  const { checks, levels, baseDate } = positionChecks(ctx, t);
  const plan = positionPlan(ctx, t, a);
  const code = symbol.replace(/\.K[SQ]$/, "");
  return {
    symbol,
    code,
    name: info.name ?? code,
    market,
    asOf: bars[t].t,
    close: roundPrice(market, bars[t].c),
    changePct: (bars[t].c / bars[t - 1].c - 1) * 100,
    liquid: t >= 19 && liquid(bars, t, LIQUIDITY[market]),
    analysis: { stage: a.stage, setup: a.signal?.setup ?? null, watch: a.watch?.id ?? null, note: a.note },
    plan: {
      ...plan,
      entry: plan.entry == null ? null : roundPrice(market, plan.entry),
      stop: plan.stop == null ? null : roundPrice(market, plan.stop),
    },
    checks,
    levels: levels ? roundLevels(market, levels) : null,
    baseDate,
    chart: chartOf(market, ctx),
  };
}

export async function loadHolding(input: string): Promise<HoldingResult> {
  const candidates = symbolCandidates(input);
  if (!candidates.length) return { input, error: "목록에서 고르거나 종목 코드를 입력하세요" };
  try {
    for (const symbol of candidates) {
      const info = await fetchChartInfo(symbol, "2y");
      if (!info || isWrongSuffix(symbol, info)) continue;
      const holding = buildHolding(symbol, info);
      if (holding === "unsupported") return { input, error: "원화와 달러 종목만 볼 수 있습니다" };
      if (holding) return { input, holding };
    }
    return { input, error: "찾지 못했습니다" };
  } catch {
    return { input, error: "시세를 받지 못했습니다. 잠시 뒤 다시 시도하세요" };
  }
}
