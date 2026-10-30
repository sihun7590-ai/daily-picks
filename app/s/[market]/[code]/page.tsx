import Link from "next/link";
import { notFound } from "next/navigation";
import { Change, Chip, Stat } from "@/components/Chips";
import PriceChart, { type Marker, type PriceLine } from "@/components/PriceChart";
import { BACKTEST, findPick, PICKS } from "@/lib/data";
import { lecturesFor, lectureUrl, SETUP_DESC, SETUP_LABEL, WATCH_LABEL, WATCH_LECTURES, type Lecture } from "@/lib/lectures";
import { fmtPct, fmtPrice, MARKET_LABEL } from "@/lib/picks";
import type { MarketId } from "@/lib/types";

export function generateStaticParams() {
  return (["kospi", "sp500"] as const).flatMap((market) => {
    const m = PICKS.markets[market];
    return [...m.signals, ...m.held, ...m.watch].map((p) => ({ market, code: p.code }));
  });
}

export const dynamicParams = false;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Lectures({ list }: { list: Lecture[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {list.map((l) => (
        <li key={l.id}>
          <a href={lectureUrl(l)} target="_blank" rel="noreferrer" className="inline-block rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2 hover:text-ink">
            {l.label} · {l.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function StockPage({ params }: { params: Promise<{ market: string; code: string }> }) {
  const { market: rawMarket, code: rawCode } = await params;
  if (rawMarket !== "kospi" && rawMarket !== "sp500") notFound();
  const market = rawMarket as MarketId;
  const code = decodeURIComponent(rawCode);
  const { market: m, signal, watch } = findPick(market, code);
  const pick = signal ?? watch;
  if (!pick) notFound();
  const p = (x: number) => fmtPrice(market, x);

  const s = signal?.signal;
  const w = watch?.watch;
  const levels = s?.levels ?? w!.levels;
  const base = s?.base ?? w!.base;
  const held = signal ? m.held.includes(signal) : false;

  const lines: PriceLine[] = s
    ? [
        { price: s.target, title: "1차 목표", color: "up" },
        { price: s.stop, title: "손절", color: "down" },
        { price: levels.waist, title: "허리", color: "ink" },
      ]
    : [
        ...(w?.trigger != null ? [{ price: w.trigger, title: "돌파", color: "up" as const }] : []),
        ...(w?.stop != null ? [{ price: w.stop, title: "손절", color: "down" as const }] : []),
        { price: levels.waist, title: "허리", color: "ink" },
      ];
  const inRange = pick.chart.bars.some((b) => b.t === base.date);
  const markers: Marker[] = inRange ? [{ date: base.date, text: "기준봉" }] : [];
  const past = s ? BACKTEST.markets[market].bySetup[s.setup] : null;
  const lectures = s ? lecturesFor(s.setup) : WATCH_LECTURES[w!.id];

  return (
    <>
      <Link href="/" className="text-sm text-ink-3 hover:text-ink">
        ← 오늘의 후보
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{pick.name}</h1>
        {s ? <Chip tone="solid">{SETUP_LABEL[s.setup]}</Chip> : <Chip tone={w!.id === "pullback_forming" ? "good" : "plain"}>{WATCH_LABEL[w!.id]}</Chip>}
        {s ? <Chip>{s.kind} 매매</Chip> : null}
        {held ? <Chip tone="warn">시장 조정으로 보류</Chip> : null}
      </div>
      <p className="num mt-1 text-sm text-ink-3">
        {MARKET_LABEL[market]} {pick.code}
        {pick.sector ? ` · ${pick.sector}` : ""} · {m.asOf} 종가 {p(pick.close)} <Change pct={pick.changePct} />
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-4">
        {s ? (
          <>
            <Stat label="기준 가격(오늘 종가)" value={p(s.entry)} />
            <Stat label={`손절선 · ${s.stopBasis}`} value={p(s.stop)} sub={`-${fmtPct(s.riskPct)}`} valueClass="text-down" />
            <Stat label={`1차 목표 · ${s.targetBasis}`} value={p(s.target)} sub={`+${fmtPct(((s.target - s.entry) / s.entry) * 100)}`} valueClass="text-up" />
            <Stat label="손익비 · 점수" value={`1 : ${s.rr.toFixed(1)}`} sub={`${s.score}점`} />
          </>
        ) : (
          <>
            <Stat label="돌파 가격" value={w!.trigger != null ? p(w!.trigger) : "아직 없음"} sub={w!.distancePct != null ? `현재가에서 ${fmtPct(w!.distancePct, true)}` : undefined} valueClass="text-up" />
            <Stat label="돌파 시 손절선" value={w!.stop != null ? p(w!.stop) : "아직 없음"} sub={w!.riskPct != null ? `-${fmtPct(w!.riskPct)}` : undefined} valueClass="text-down" />
            <Stat label="허리" value={p(levels.waist)} />
            <Stat label="기준 마디 고점" value={p(levels.legHigh)} />
          </>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-3 sm:p-4">
        <PriceChart market={market} chart={pick.chart} lines={lines} markers={markers} />
      </div>

      <Section title={s ? "왜 올라왔나" : "지금 상태"}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          {s ? <li>{SETUP_DESC[s.setup]}</li> : <li>{w!.note}</li>}
          <li>
            {base.date}에 평균 거래량의 <b className="num">{base.volRatio.toFixed(1)}배</b>, <b className="num">{fmtPct(base.gainPct, true)}</b> 장대양봉으로 60일 고점을 돌파한 기준봉이 나왔습니다.
          </li>
          <li>
            기준 마디는 {p(levels.legLow)}에서 {p(levels.legHigh)}까지이고, 허리는 {p(levels.waist)}입니다. 종가가 허리 위에 있습니다.
          </li>
          {s ? (
            <li>
              오늘 거래량은 평균의 <b className="num">{s.volRatio.toFixed(1)}배</b>
              {s.dryUp != null ? (
                <>
                  이고, 눌리는 동안 거래량은 상승 구간의 <b className="num">{Math.round(s.dryUp * 100)}%</b>로 줄었습니다
                </>
              ) : null}
              .
            </li>
          ) : w!.dryUp != null ? (
            <li>
              눌리는 동안 거래량은 상승 구간의 <b className="num">{Math.round(w!.dryUp * 100)}%</b>입니다.
            </li>
          ) : null}
        </ul>
        {s?.warnings.length ? <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-ink">{s.warnings.join(" · ")}</p> : null}
      </Section>

      {s ? (
        <Section title="진입 전에 정해 두는 시나리오">
          <dl className="grid gap-3 text-sm leading-relaxed sm:grid-cols-3">
            <div>
              <dt className="font-medium text-down">내려가면</dt>
              <dd className="mt-0.5 text-ink-2">
                {p(s.stop)}을 종가로 이탈하면 손절합니다. 거래가 터지며 빠지면 기다리지 않습니다. 손절 폭이 부담되면 손절선을 올리지 말고 매수 자리를 낮춰 기다립니다.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">옆으로 가면</dt>
              <dd className="mt-0.5 text-ink-2">돌파 뒤 힘없이 늘어지면 판단이 틀린 것으로 봅니다. 반등에서 나오고, 다시 돌파할 때 다시 봅니다.</dd>
            </div>
            <div>
              <dt className="font-medium text-up">올라가면</dt>
              <dd className="mt-0.5 text-ink-2">{p(s.target)}에서 절반을 정리하고 손절선을 본전으로 올립니다. 나머지는 20일선을 종가로 이탈할 때까지 둡니다.</dd>
            </div>
          </dl>
        </Section>
      ) : w?.trigger != null ? (
        <Section title="신호가 되는 조건">
          <p className="text-sm leading-relaxed text-ink-2">
            종가가 {p(w.trigger)}을 넘고, 거래량이 20일 평균의 1.2배 이상(전고점 돌파는 1.5배)이며, 종가가 캔들 위쪽 60% 이상에 있어야 합니다. 그날 시장 평균이 60일선 위여야 하고, 손절 폭 12% 이내와 손익비 1.5 이상도 만족해야 합니다.
          </p>
        </Section>
      ) : null}

      {s ? (
        <Section title="점수 내역">
          <ul className="space-y-2.5">
            {s.breakdown.map((b) => (
              <li key={b.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{b.label}</span>
                  <span className="num text-ink-3">
                    {b.score} / {b.max}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-ink-2" style={{ width: `${(b.score / b.max) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-3">{b.detail}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {past ? (
        <Section title={`${SETUP_LABEL[s!.setup]}의 과거 성적 (${MARKET_LABEL[market]}, 5년)`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="건수" value={`${past.n}건`} />
            <Stat label="수익으로 끝난 비율" value={`${past.winRate.toFixed(0)}%`} />
            <Stat label="한 건 평균 수익률" value={fmtPct(past.avgRet, true)} valueClass={past.avgRet >= 0 ? "text-up" : "text-down"} />
            <Stat label="20일 뒤 시장 대비" value={fmtPct(past.fwd20Excess, true)} sub={`오차 ±${past.fwd20ExcessSe.toFixed(1)}`} />
          </div>
          {past.n < 30 ? <p className="mt-2 text-xs text-warn-ink">건수가 적어 우연일 수 있습니다.</p> : null}
        </Section>
      ) : null}

      <Section title="근거 강의">
        <Lectures list={lectures} />
      </Section>
    </>
  );
}
