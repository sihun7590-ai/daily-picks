import Link from "next/link";
import { WATCH_LABEL } from "@/lib/lectures";
import { fmtPct, fmtPrice, type WatchPick } from "@/lib/picks";
import type { MarketId } from "@/lib/types";
import { Change, Chip } from "./Chips";

export default function WatchList({ market, picks }: { market: MarketId; picks: WatchPick[] }) {
  if (!picks.length) {
    return <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-3">오늘은 기준 마디가 살아 있는 종목이 없습니다.</p>;
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {picks.map((p) => {
        const w = p.watch;
        return (
          <li key={p.code}>
            <Link
              href={`/s/${market}/${encodeURIComponent(p.code)}`}
              className="grid gap-x-4 gap-y-1 p-3.5 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  <Chip tone={w.id === "pullback_forming" ? "good" : w.id === "pullback_weak" ? "warn" : "plain"}>{WATCH_LABEL[w.id]}</Chip>
                </div>
                <div className="num mt-0.5 text-xs text-ink-3">
                  {p.code} · {fmtPrice(market, p.close)} <Change pct={p.changePct} />
                </div>
              </div>
              <div className="num text-sm">
                {w.trigger != null ? (
                  <>
                    <span className="text-xs text-ink-3">돌파 가격 </span>
                    <span className="font-medium text-up">{fmtPrice(market, w.trigger)}</span>
                    <span className="text-xs text-ink-3"> ({fmtPct(w.distancePct ?? 0, true)})</span>
                  </>
                ) : (
                  <span className="text-xs text-ink-3">돌파 가격 아직 없음</span>
                )}
              </div>
              <div className="num text-sm">
                {w.stop != null ? (
                  <>
                    <span className="text-xs text-ink-3">손절선 </span>
                    <span className="font-medium text-down">{fmtPrice(market, w.stop)}</span>
                    <span className="text-xs text-ink-3"> (-{fmtPct(w.riskPct ?? 0)})</span>
                  </>
                ) : (
                  <span className="text-xs text-ink-3">허리 {fmtPrice(market, w.levels.waist)}</span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-ink-3 sm:col-span-3">{w.note}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
