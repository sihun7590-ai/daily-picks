import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHolding, isWrongSuffix, symbolCandidates } from "../lib/holdings";
import { analyze, positionChecks, positionPlan, prepare } from "../lib/rules";
import type { Bar } from "../lib/types";

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
