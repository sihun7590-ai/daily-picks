import Link from "next/link";
import { BACKTEST } from "@/lib/data";
import { SETUP_DESC, SETUP_LABEL } from "@/lib/lectures";
import { fmtPct, fmtPrice, type SignalPick } from "@/lib/picks";
import type { MarketId } from "@/lib/types";
import { Change, Chip, Stat } from "./Chips";

export default function SignalCard({ market, pick, held }: { market: MarketId; pick: SignalPick; held?: boolean }) {
  const s = pick.signal;
  const past = BACKTEST.markets[market].bySetup[s.setup];
  return (
    <Link
      href={`/s/${market}/${encodeURIComponent(pick.code)}`}
      className={`block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-ink-3 ${held ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="text-[17px] font-bold leading-snug">{pick.name}</div>
          <div className="num mt-0.5 text-xs text-ink-3">
            {pick.code} · {fmtPrice(market, pick.close)} <Change pct={pick.changePct} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Chip tone="solid">{SETUP_LABEL[s.setup]}</Chip>
          <Chip>{s.kind} 매매</Chip>
          <span className="num ml-1 text-lg font-bold">{s.score}</span>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{SETUP_DESC[s.setup]}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
        <Stat label="기준 가격(오늘 종가)" value={fmtPrice(market, s.entry)} />
        <Stat label={`손절선 · ${s.stopBasis}`} value={fmtPrice(market, s.stop)} sub={`-${fmtPct(s.riskPct)}`} valueClass="text-down" />
        <Stat label={`1차 목표 · ${s.targetBasis}`} value={fmtPrice(market, s.target)} sub={`+${fmtPct(((s.target - s.entry) / s.entry) * 100)}`} valueClass="text-up" />
        <Stat label="손익비" value={`1 : ${s.rr.toFixed(1)}`} />
      </div>
      {past ? (
        <p className="num mt-3 text-xs text-ink-3">
          이 유형의 과거 5년 성적: {past.n}건, 수익으로 끝난 비율 {past.winRate.toFixed(0)}%, 평균 {fmtPct(past.avgRet, true)}
        </p>
      ) : null}
      {s.warnings.length ? <p className="mt-1 text-xs text-warn-ink">주의: {s.warnings.join(" · ")}</p> : null}
    </Link>
  );
}
