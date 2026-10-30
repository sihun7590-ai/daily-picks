import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, MIN_BARS, prepare } from "../lib/rules";
import type { Bar } from "../lib/types";
import { parseChart } from "../lib/yahoo";

let day = 0;
function mk(o: number, h: number, l: number, c: number, v: number): Bar {
  day++;
  const d = new Date(Date.UTC(2020, 0, 1 + day));
  return { t: d.toISOString().slice(0, 10), o, h, l, c, v };
}

/** 완만히 오르는 바닥: 60·120일선이 우상향이 되도록 만든다 */
function rising(n: number, from: number, step: number, vol = 1000): Bar[] {
  const out: Bar[] = [];
  let p = from;
  for (let i = 0; i < n; i++) {
    const next = p + step;
    out.push(mk(p, Math.max(p, next) * 1.004, Math.min(p, next) * 0.996, next, vol));
    p = next;
  }
  return out;
}

/** 바닥 → 기준봉 → 추가 상승 → 거래 감소 눌림. 마지막 종가와 고점을 함께 돌려준다 */
function setup(): { bars: Bar[]; high: number } {
  const bars = rising(150, 100, 0.1);
  const last = bars[bars.length - 1].c;
  bars.push(mk(last, last * 1.09, last * 0.995, last * 1.08, 4000)); // 기준봉
  let p = last * 1.08;
  bars.push(mk(p, p * 1.03, p * 0.995, p * 1.025, 2500));
  p *= 1.025;
  bars.push(mk(p, p * 1.02, p * 0.995, p * 1.015, 2000));
  p *= 1.015;
  const high = p * 1.02 >= bars[bars.length - 1].h ? bars[bars.length - 1].h : p;
  // 내려오다가
  for (let i = 0; i < 3; i++) {
    const n = p * 0.985;
    bars.push(mk(p, p * 1.002, n * 0.998, n, 600));
    p = n;
  }
  // 좁게 수렴한다
  for (let i = 0; i < 4; i++) {
    const n = p * (i % 2 ? 1.002 : 0.998);
    bars.push(mk(p, Math.max(p, n) * 1.002, Math.min(p, n) * 0.998, n, 400));
    p = n;
  }
  return { bars, high };
}

test("거래 줄며 눌린 뒤 거래량 동반 돌파를 눌림 돌파로 잡는다", () => {
  const { bars, high } = setup();
  const p = bars[bars.length - 1].c;
  bars.push(mk(p, p * 1.022, p * 0.999, p * 1.02, 1800));
  const a = analyze(prepare(bars), bars.length - 1);
  assert.equal(a.stage, "pass", a.note ?? "");
  assert.ok(a.signal);
  assert.ok(["pullback_breakout", "high_tight"].includes(a.signal.setup), a.signal.setup);
  assert.equal(a.signal.kind, "확인");
  assert.ok(a.signal.stop < p, "손절선은 수렴 하단");
  assert.equal(a.signal.stopBasis, "수렴 하단");
  assert.ok(a.signal.target >= high * 0.99, "1차 목표는 전고점 이상");
  assert.ok(a.signal.rr >= 1.5);
});

test("눌림 상단을 못 넘은 첫 양봉은 예측 매매로 분류한다", () => {
  const { bars } = setup();
  // 윗꼬리 달린 봉 뒤의 첫 양봉: 위 꼬리를 못 넘었으니 돌파가 아니라 눌림 확인이다
  bars.splice(-4);
  const q = bars[bars.length - 1].c;
  bars.push(mk(q * 0.998, q * 1.01, q * 0.99, q * 0.995, 400));
  bars.push(mk(q * 0.995, q * 1.003, q * 0.994, q * 1.002, 1800));
  const a = analyze(prepare(bars), bars.length - 1);
  assert.equal(a.signal?.setup, "pullback_confirm", a.note ?? "");
  assert.equal(a.signal?.kind, "예측");
});

test("거래량 없는 돌파는 신호가 아니다", () => {
  const { bars } = setup();
  const p = bars[bars.length - 1].c;
  bars.push(mk(p, p * 1.022, p * 0.999, p * 1.02, 300));
  assert.equal(analyze(prepare(bars), bars.length - 1).signal, null);
});

test("1차 기준봉 당일은 후보가 아니라 관찰 대상이다", () => {
  const bars = rising(150, 100, 0.1);
  const last = bars[bars.length - 1].c;
  bars.push(mk(last, last * 1.09, last * 0.995, last * 1.08, 4000));
  const a = analyze(prepare(bars), bars.length - 1);
  assert.equal(a.signal, null);
  assert.equal(a.watch?.id, "first_base");
});

test("눌리는 중이면 돌파 가격과 손절선을 관찰 목록에 준다", () => {
  const { bars } = setup();
  const a = analyze(prepare(bars), bars.length - 1);
  assert.equal(a.signal, null);
  assert.equal(a.watch?.id, "pullback_forming");
  assert.ok(a.watch!.trigger! > bars[bars.length - 1].c);
  assert.ok(a.watch!.stop! < bars[bars.length - 1].c);
});

test("역배열(하락 추세)에서는 어떤 신호도 내지 않는다", () => {
  const bars = rising(200, 300, -0.5);
  const last = bars[bars.length - 1].c;
  bars.push(mk(last, last * 1.09, last * 0.995, last * 1.08, 5000));
  const a = analyze(prepare(bars), bars.length - 1);
  assert.equal(a.stage, "trend");
  assert.equal(a.signal, null);
});

test("데이터가 짧으면 판단하지 않는다", () => {
  const bars = rising(MIN_BARS - 5, 100, 0.1);
  assert.equal(analyze(prepare(bars), bars.length - 1).stage, "history");
});

test("여러 번 지지받은 저점을 깼다가 복귀하면 지지 이탈 복귀로 잡고 주의 문구를 붙인다", () => {
  const bars = rising(150, 100, 0.1);
  const last = bars[bars.length - 1].c;
  bars.push(mk(last, last * 1.09, last * 0.995, last * 1.08, 4000)); // 기준봉
  let p = last * 1.08;
  for (let i = 0; i < 4; i++) {
    bars.push(mk(p, p * 1.03, p * 0.995, p * 1.025, 2000));
    p *= 1.025;
  }
  // 위쪽에서 오래 옆으로 간다. 저점이 같은 가격에 여러 번 닿는다
  const support = p * 0.96;
  for (let i = 0; i < 44; i++) {
    const c = p * (i % 2 ? 0.985 : 0.975);
    bars.push(mk(p * 0.98, p * 0.992, i % 6 === 0 ? support : p * 0.968, c, 500));
  }
  const prev = bars[bars.length - 1].c;
  bars.push(mk(prev, prev * 1.002, support * 0.985, support * 0.99, 700)); // 지지 이탈
  const dip = bars[bars.length - 1].c;
  bars.push(mk(dip, p * 0.998, dip * 0.999, p * 0.996, 1500)); // 복귀. 횡보 상단까지 넘어야 바로 위가 막히지 않는다
  const a = analyze(prepare(bars), bars.length - 1);
  assert.equal(a.signal?.setup, "trap_reclaim", `${a.stage} ${a.note}`);
  assert.equal(a.signal?.stopBasis, "이탈 저점");
  assert.ok(a.signal?.warnings.some((w) => w.includes("기계 판별 성적")));
});

test("미래 참조 없음: t까지만 준 결과와 전체를 준 결과가 같다", () => {
  // 시드 고정 난수로 신호가 나올 만한 다양한 경로를 만든다
  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bars: Bar[] = [];
  let p = 100;
  for (let i = 0; i < 700; i++) {
    const burst = rnd() < 0.02;
    const r = burst ? 0.04 + rnd() * 0.06 : (rnd() - 0.47) * 0.03;
    const n = p * (1 + r);
    const v = (burst ? 4000 : 800) + rnd() * 600;
    bars.push(mk(p, Math.max(p, n) * (1 + rnd() * 0.01), Math.min(p, n) * (1 - rnd() * 0.01), n, v));
    p = n;
  }
  const full = prepare(bars);
  let compared = 0;
  let found = 0;
  for (let t = MIN_BARS; t < bars.length; t += 3) {
    const a = analyze(full, t);
    const b = analyze(prepare(bars.slice(0, t + 1)), t);
    assert.deepEqual(a, b, `t=${t}`);
    compared++;
    if (a.signal || a.watch) found++;
  }
  assert.ok(compared > 100);
  assert.ok(found > 0, "테스트 경로에서 신호가 하나도 없으면 검사가 무의미하다");
});

test("장중 미완성 봉은 버리고, 마감 뒤에는 남긴다", () => {
  const json = {
    chart: {
      error: null,
      result: [
        {
          meta: { gmtoffset: 32400, currentTradingPeriod: { regular: { start: 1793318400, end: 1793340000 } } },
          timestamp: [1793232000, 1793318400],
          indicators: { quote: [{ open: [1, 2], high: [1, 2], low: [1, 2], close: [1, 2], volume: [10, 10] }] },
        },
      ],
    },
  };
  assert.equal(parseChart(json, 1793330000).length, 1, "장중");
  assert.equal(parseChart(json, 1793340001).length, 2, "마감 후");
});
