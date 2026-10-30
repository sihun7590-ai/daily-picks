import Link from "next/link";
import { Chip } from "@/components/Chips";
import SignalCard from "@/components/SignalCard";
import StaleBanner from "@/components/StaleBanner";
import WatchList from "@/components/WatchList";
import { BACKTEST, PICKS } from "@/lib/data";
import { fmtPct, MARKET_LABEL, type MarketPicks } from "@/lib/picks";

function koDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${y}년 ${m}월 ${day}일`;
}

function kstTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Funnel({ m }: { m: MarketPicks }) {
  const f = m.funnel;
  const tradable = m.scanned - (f.illiquid ?? 0) - (f.stale ?? 0) - (f.history ?? 0);
  const trend = tradable - (f.trend ?? 0);
  const leg = trend - (f.no_leg ?? 0) - (f.leg_broken ?? 0);
  const step = (label: string, n: number) => (
    <span className="whitespace-nowrap">
      {label} <b className="num font-semibold text-ink-2">{n}</b>
    </span>
  );
  return (
    <p className="mt-1 flex flex-wrap gap-x-1.5 text-xs text-ink-3">
      {step("전체", m.universe)} <span>→</span> {step("거래대금 충분", tradable)} <span>→</span> {step("추세·고점 조건", trend)} <span>→</span> {step("기준 마디 유효", leg)} <span>→</span>{" "}
      {step("오늘 신호", m.signals.length + m.held.length)}
    </p>
  );
}

function MarketSection({ m }: { m: MarketPicks }) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">{MARKET_LABEL[m.id]}</h2>
        <span className="num text-sm text-ink-3">{koDate(m.asOf)} 종가 기준</span>
        {m.regimeUp ? <Chip tone="good">시장 상승 구간</Chip> : <Chip tone="warn">시장 조정 구간</Chip>}
      </div>
      <Funnel m={m} />

      <h3 className="mb-2 mt-5 text-[15px] font-semibold">오늘 신호 {m.signals.length}건</h3>
      {m.signals.length ? (
        <div className="grid gap-3">
          {m.signals.map((p) => (
            <SignalCard key={p.code} market={m.id} pick={p} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
          {m.regimeUp
            ? "오늘 규칙을 모두 통과한 종목이 없습니다. 자주 있는 일입니다. 과거 5년 기준으로 신호는 시장별로 1~2주에 한 번꼴로 나왔습니다."
            : "시장 평균이 60일선 아래라 새 신호를 내지 않습니다. 2022~2024년 검증에서 이런 구간의 신호가 특히 나빴습니다."}
        </p>
      )}

      {m.held.length ? (
        <>
          <h3 className="mb-2 mt-5 text-[15px] font-semibold text-ink-2">시장 조정으로 보류한 신호 {m.held.length}건</h3>
          <div className="grid gap-3">
            {m.held.map((p) => (
              <SignalCard key={p.code} market={m.id} pick={p} held />
            ))}
          </div>
        </>
      ) : null}

      <h3 className="mb-1 mt-6 text-[15px] font-semibold">관심 종목 {m.watch.length}개</h3>
      <p className="mb-2 text-xs text-ink-3">아직 신호는 아니고, 기준 마디가 살아 있어 지켜볼 만한 종목입니다. 돌파 가격을 거래량과 함께 넘어야 신호가 됩니다.</p>
      <WatchList market={m.id} picks={m.watch} />
    </section>
  );
}

export default function Home() {
  const recent = (id: "kospi" | "sp500") => BACKTEST.markets[id].byPeriod["2025-2026"];
  return (
    <>
      <StaleBanner generatedAt={PICKS.generatedAt} />
      <h1 className="text-2xl font-bold">오늘의 후보</h1>
      <p className="num mt-1 text-sm text-ink-3">{kstTime(PICKS.generatedAt)} 갱신. 코스피는 다음 장, S&P 500은 오늘 밤 장을 보는 목록입니다.</p>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
        <b className="text-ink">그대로 따라 사는 목록이 아닙니다.</b> 강의 규칙을 기계적으로 적용해 볼 종목을 좁혀 줄 뿐이고, 규칙대로 샀다면 최근 구간(2025~2026) 성적은 코스피 평균{" "}
        <b className="num text-down">{fmtPct(recent("kospi").avgRet, true)}</b>, S&P 500 평균 <b className="num text-down">{fmtPct(recent("sp500").avgRet, true)}</b>였습니다.{" "}
        <Link href="/rules" className="underline underline-offset-2">
          검증 결과 보기
        </Link>
      </div>

      <MarketSection m={PICKS.markets.kospi} />
      <MarketSection m={PICKS.markets.sp500} />
    </>
  );
}
