import assert from "node:assert/strict";
import { test } from "node:test";
import { buyPlan } from "../lib/buy-plan";
import { buildHolding, isWrongSuffix, symbolCandidates } from "../lib/holdings";
import { LECTURES } from "../lib/lectures";
import { analyze, positionChecks, positionPlan, prepare } from "../lib/rules";
import type { Bar, RulePlan } from "../lib/types";

function path(n: number, seed = 7): Bar[] {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const bars: Bar[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    const burst = rnd() < 0.02;
    const c = p * (1 + (burst ? 0.04 + rnd() * 0.06 : (rnd() - 0.47) * 0.03));
    const t = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
    bars.push({ t, o: p, h: Math.max(p, c) * (1 + rnd() * 0.01), l: Math.min(p, c) * (1 - rnd() * 0.01), c, v: (burst ? 4000 : 800) + rnd() * 600 });
    p = c;
  }
  return bars;
}

test("입력을 Yahoo 심볼 후보로 바꾼다", () => {
  assert.deepEqual(symbolCandidates(" 005930 "), ["005930.KS", "005930.KQ"]);
  assert.deepEqual(symbolCandidates("0001a0"), ["0001A0.KS", "0001A0.KQ"]);
  assert.deepEqual(symbolCandidates("247540.kq"), ["247540.KS", "247540.KQ"], "저장된 접미사도 다시 확인한다");
  assert.deepEqual(symbolCandidates("aapl"), ["AAPL"]);
  assert.deepEqual(symbolCandidates("BRK.B"), ["BRK-B"]);
});

test("코스닥 종목에 잘못 붙은 .KS는 쓰지 않는다", () => {
  assert.equal(isWrongSuffix("247540.KS", { exchange: "KOE" }), true);
  assert.equal(isWrongSuffix("005930.KS", { exchange: "KSC" }), false);
  assert.equal(isWrongSuffix("247540.KQ", { exchange: "KOE" }), false);
  assert.equal(isWrongSuffix("AAPL", { exchange: "NMS" }), false);
});

test("코드 형식이 아니면 외부 요청을 만들지 않는다", () => {
  for (const bad of ["", "삼성전자", "../../etc/passwd", "AAPL?range=1d", "A/B", "005930.T", "AAAAAAAAAAAA"]) {
    assert.deepEqual(symbolCandidates(bad), [], bad);
  }
});

test("미래 참조 없음: 확인 항목도 t까지만 본다", () => {
  const bars = path(500);
  const full = prepare(bars);
  let withLeg = 0;
  for (let t = 1; t < bars.length; t += 7) {
    const a = positionChecks(full, t);
    assert.deepEqual(a, positionChecks(prepare(bars.slice(0, t + 1)), t), `t=${t}`);
    if (a.levels) withLeg++;
  }
  assert.ok(withLeg > 0, "기준 마디가 하나도 없으면 검사가 무의미하다");
});

test("진입·손절 참고값: 미래 참조가 없고, 손절은 언제나 종가 아래다", () => {
  const bars = path(600, 11);
  const full = prepare(bars);
  const seen = new Set<string>();
  let withEntry = 0;
  for (let t = 3; t < bars.length; t++) {
    const plan = positionPlan(full, t, analyze(full, t));
    if (t % 7 === 0) {
      const cut = prepare(bars.slice(0, t + 1));
      assert.deepEqual(plan, positionPlan(cut, t, analyze(cut, t)), `t=${t}`);
    }
    if (plan.stop != null) {
      assert.ok(plan.stop <= bars[t].c, `t=${t} 손절 ${plan.stop} > 종가 ${bars[t].c}`);
      assert.ok(plan.stopBasis, "손절선에는 근거가 붙는다");
      seen.add(plan.stopBasis!);
    }
    if (plan.entry != null) {
      assert.ok(plan.entryBasis, "진입가에는 근거가 붙는다");
      withEntry++;
    }
  }
  assert.ok(withEntry > 0, "진입가가 한 번도 없으면 검사가 무의미하다");
  assert.ok(seen.has("전저점") && seen.has("허리 이탈"), [...seen].join(","));
});

test("모든 참고값에 읽을 수 있는 이유와 실제 강의 링크가 붙는다", () => {
  const bars = path(600, 23);
  const full = prepare(bars);
  const seen = new Set<string>();
  for (let t = 3; t < bars.length; t++) {
    const plan = positionPlan(full, t, analyze(full, t));
    for (const text of [plan.entryWhy, plan.stopWhy]) {
      assert.ok(text.length > 10, `t=${t} 이유가 비어 있다`);
      assert.doesNotMatch(text, /undefined|NaN|null/, `t=${t} ${text}`);
    }
    for (const k of [...plan.entryRefs, ...plan.stopRefs]) assert.ok(LECTURES[k], `없는 강의 ${k}`);
    if (plan.entry != null) seen.add(plan.entryBasis ?? "");
    for (let i = 1; i < plan.supports.length; i++) assert.ok(plan.supports[i - 1].price >= plan.supports[i].price, "지지 가격은 높은 순이다");
  }
  assert.ok(seen.size > 0);
  assert.ok(![...seen].includes(""), "진입가에는 근거가 붙는다");
});

const planFor = (over: Partial<RulePlan>): RulePlan => ({
  entry: null,
  entryBasis: null,
  entryWhy: "x",
  entryRefs: [],
  stop: null,
  stopBasis: null,
  stopTested: false,
  stopWhy: "x",
  stopRefs: [],
  supports: [],
  maxRiskPct: 12,
  ...over,
});
const supports = [
  { price: 110, basis: "전저점", date: "2026-09-01" },
  { price: 95, basis: "허리", date: "2026-08-01" },
  { price: 80, basis: "전저점", date: "2026-07-01" },
];

test("매수가 기준 손절: 매수가 아래 가장 가까운 기준가를 고른다", () => {
  const { stop } = buyPlan(planFor({ supports }), 105, 100, "sp500");
  assert.equal(stop.price, 95);
  assert.equal(stop.basis, "허리");
  assert.equal(stop.flag, null);
  assert.ok(stop.why.includes("2026-08-01"));
});

test("매수가 기준 손절: 종가가 이미 내려왔으면 이탈로 표시하고 다음 기준가를 알려 준다", () => {
  const { stop } = buyPlan(planFor({ supports }), 90, 100, "kospi");
  assert.equal(stop.price, 95);
  assert.equal(stop.flag, "이미 이탈");
  assert.ok(stop.why.includes("80원"), stop.why);
});

test("매수가 기준 손절: 가격이 올라 규칙 손절선이 매수가 위면 그대로 쓴다", () => {
  const { stop } = buyPlan(planFor({ supports, stop: 110, stopBasis: "전저점" }), 130, 100, "sp500");
  assert.equal(stop.price, 110);
  assert.equal(stop.flag, null);
  assert.ok(stop.why.includes("+10.0%"), stop.why);
});

test("매수가 기준 손절: 기준가가 없으면 손절 폭 상한으로, 폭이 크면 표시한다", () => {
  const none = buyPlan(planFor({}), 100, 100, "kospi").stop;
  assert.equal(none.price, 88);
  assert.equal(none.flag, null);
  assert.equal(buyPlan(planFor({}), 80, 100, "kospi").stop.flag, "이미 이탈");
  const wide = buyPlan(planFor({ supports: [{ price: 80, basis: "전저점", date: "2026-07-01" }] }), 90, 100, "sp500").stop;
  assert.equal(wide.price, 80);
  assert.equal(wide.flag, "손절 폭 과다");
});

test("매수가 기준 진입: 위는 불타기, 아래는 물타기로 표시하고 자리가 없으면 지어내지 않는다", () => {
  const above = buyPlan(planFor({ entry: 110, entryBasis: "전고점", stop: 104.5 }), 100, 100, "sp500").entry;
  assert.equal(above.price, 110);
  assert.equal(above.flag, null);
  assert.ok(above.why.includes("불타기") && above.why.includes("5.0%"), above.why);
  const below = buyPlan(planFor({ entry: 90, entryBasis: "수렴 상단" }), 85, 100, "sp500").entry;
  assert.equal(below.flag, "물타기 자리");
  assert.equal(buyPlan(planFor({}), 100, 100, "sp500").entry.price, null);
});

test("규칙이 자리를 정하지 않으면 진입 참고가를 지어내지 않는다", () => {
  const bars = path(10);
  const plan = positionPlan(prepare(bars), bars.length - 1, { stage: "history", signal: null, watch: null, note: null });
  assert.equal(plan.entry, null);
  assert.equal(plan.entryBasis, null);
  assert.equal(plan.stopTested, false);
});

test("데이터가 짧으면 알 수 없다고 답한다", () => {
  const bars = path(10);
  const { checks, levels } = positionChecks(prepare(bars), bars.length - 1);
  assert.equal(checks.find((c) => c.key === "ma60")?.ok, null);
  assert.equal(checks.find((c) => c.key === "align")?.ok, null);
  assert.equal(levels, null);
});

test("통화로 시장을 정하고 원화·달러 외에는 받지 않는다", () => {
  const bars = path(200);
  const krw = buildHolding("005930.KS", { bars, currency: "KRW", exchange: "KSC", name: "Samsung" });
  assert.ok(krw && krw !== "unsupported");
  assert.equal(krw.market, "kospi");
  assert.equal(krw.code, "005930");
  assert.equal(krw.close, Math.round(bars[bars.length - 1].c));

  const usd = buildHolding("AAPL", { bars, currency: "USD", exchange: "NMS", name: null });
  assert.ok(usd && usd !== "unsupported");
  assert.equal(usd.market, "sp500");
  assert.equal(usd.name, "AAPL");

  assert.equal(buildHolding("7203.T", { bars, currency: "JPY", exchange: "JPX", name: "Toyota" }), "unsupported");
  assert.equal(buildHolding("X", { bars: bars.slice(0, 1), currency: "USD", exchange: "NMS", name: null }), null);
});
