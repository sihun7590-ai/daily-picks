/**
 * 입력한 매수가에 강의 기준을 계산기처럼 적용한다. 매수가를 서버로 보내지 않으므로 브라우저에서만 돈다.
 * 가격과 그 이유만 돌려주고 팔라거나 들고 있으라는 결론은 내지 않는다. 자금이나 성향도 보지 않는다.
 * 규칙의 과거 검증은 신호 진입을 잰 것이라 이 값들은 검증을 거치지 않았다.
 */
import type { LectureKey } from "./lectures";
import { fmtPct, fmtPrice, roundPrice } from "./picks";
import type { MarketId, RulePlan } from "./types";

export type BuyLevel = {
  price: number | null;
  basis: string | null;
  /** 화면에 눈에 띄게 표시할 상태 */
  flag: string | null;
  why: string;
  refs: LectureKey[];
};

function buyStop(plan: RulePlan, close: number, buy: number, market: MarketId): BuyLevel {
  const fromBuy = (p: number) => fmtPct((p / buy - 1) * 100, true);
  // 가격이 올랐으면 이미 매수가 위에 컷이 있다 (중급 3화, 21화)
  if (close >= buy && plan.stop != null && plan.stop >= buy) {
    return {
      price: plan.stop,
      basis: plan.stopBasis,
      flag: null,
      why: `매수가보다 위에 있는 규칙 손절선입니다. 강의는 가격이 오르면 컷을 올린다고 하며, 여기를 깨도 매수가 대비 ${fromBuy(plan.stop)}입니다.`,
      refs: ["m3", "m21"],
    };
  }
  const level = plan.supports.find((l) => l.price < buy);
  if (!level) {
    const price = roundPrice(market, buy * (1 - plan.maxRiskPct / 100));
    return {
      price,
      basis: `손절 폭 상한 ${plan.maxRiskPct}%`,
      flag: close < price ? "이미 이탈" : null,
      why: "최근 1년 안에 매수가 아래로 기준이 될 저점이 없습니다. 강의는 기준가가 애매할 때 퍼센트 마지노선을 쓴다고 하므로 규칙의 손절 폭 상한을 적용했습니다.",
      refs: ["b37"],
    };
  }
  const name = level.date ? `${level.date} ${level.basis}` : level.basis;
  if (level.price > close) {
    const next = plan.supports.find((l) => l.price < close);
    return {
      price: level.price,
      basis: level.basis,
      flag: "이미 이탈",
      why: `매수가 아래에서 가장 가까운 기준가(${name})를 종가가 이미 내려왔습니다. ${next ? `종가 아래 다음 기준가는 ${next.basis} ${fmtPrice(market, next.price)}입니다.` : "최근 1년 안에 종가 아래로 기준이 될 저점은 없습니다."}`,
      refs: ["b37", "m3"],
    };
  }
  const riskPct = (1 - level.price / buy) * 100;
  const over = riskPct > plan.maxRiskPct;
  return {
    price: level.price,
    basis: level.basis,
    flag: over ? "손절 폭 과다" : null,
    why: `매수가 아래에서 가장 가까운 기준가(${name})입니다. 강의의 손절 기준은 고정 퍼센트가 아니라 기준가 이탈입니다.${over ? ` 손절 폭 ${riskPct.toFixed(1)}%는 규칙의 상한 ${plan.maxRiskPct}%를 넘어, 규칙이라면 이 자리에서 사지 않습니다.` : ""}`,
    refs: over ? ["b37", "m3", "m20"] : ["b37", "m3"],
  };
}

function buyEntry(plan: RulePlan, buy: number): BuyLevel {
  const { entry, entryBasis, stop } = plan;
  if (entry == null) return { price: null, basis: null, flag: null, why: "규칙이 정한 진입 자리가 없어 매수가와 비교할 값이 없습니다.", refs: [] };
  const gap = Math.abs((entry / buy - 1) * 100).toFixed(1);
  if (entry < buy) {
    return { price: entry, basis: entryBasis, flag: "물타기 자리", why: `규칙 진입가가 매수가보다 ${gap}% 아래입니다. 이 가격에 더 사면 물타기인데, 강의는 물타기를 금지합니다.`, refs: ["m2"] };
  }
  const added = stop != null && stop < entry ? ` 이 가격에 더 산다면 추가분의 손절 폭은 규칙 손절선까지 ${((1 - stop / entry) * 100).toFixed(1)}%이고, 강의는 매수분별로 손절을 따로 관리합니다.` : "";
  return { price: entry, basis: entryBasis, flag: null, why: `규칙 진입가가 매수가보다 ${gap}% 위입니다. 강의에서 추가 매수는 이렇게 매수가 위에서 사는 불타기만 허용합니다.${added}`, refs: ["m2", "m22"] };
}

export function buyPlan(plan: RulePlan, close: number, buy: number, market: MarketId): { entry: BuyLevel; stop: BuyLevel } {
  return { entry: buyEntry(plan, buy), stop: buyStop(plan, close, buy, market) };
}
