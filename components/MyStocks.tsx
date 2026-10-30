"use client";

import { useEffect, useMemo, useState } from "react";
import type { Holding, HoldingResult } from "@/lib/holdings";
import { SETUP_LABEL, WATCH_LABEL } from "@/lib/lectures";
import { fmtPct, fmtPrice } from "@/lib/picks";
import type { MarketId, Stage } from "@/lib/types";
import { Change, Chip, Stat } from "./Chips";
import PriceChart, { type Marker, type PriceLine } from "./PriceChart";

export type NameItem = { symbol: string; code: string; name: string; exchange: string };

type Saved = { symbol: string; buyPrice: number | null };

/** 저장소가 공개라 사용자가 넣은 종목은 이 브라우저 밖에 저장하지 않는다. 매수가는 서버로 보내지도 않는다 */
const KEY = "dp_my_stocks_v1";

function readSaved(): Saved[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x) => typeof x?.symbol === "string")
      .map((x) => ({ symbol: x.symbol, buyPrice: typeof x.buyPrice === "number" ? x.buyPrice : null }));
  } catch {
    return [];
  }
}

function writeSaved(list: Saved[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

async function fetchHoldings(symbols: string[]): Promise<HoldingResult[]> {
  const res = await fetch("/api/holdings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbols }) });
  // 로그인이 풀리면 proxy가 로그인 화면으로 돌려보낸다
  if (res.redirected || !res.headers.get("content-type")?.includes("json")) throw new Error("로그인이 풀렸습니다. 새로고침해 다시 로그인하세요.");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "시세를 받지 못했습니다.");
  return data.results;
}

function parsePrice(text: string): number | null {
  const n = Number(text.replaceAll(",", "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function searchNames(names: NameItem[], query: string): NameItem[] {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return [];
  const rank = (n: NameItem) => {
    const name = n.name.toLowerCase().replace(/\s+/g, "");
    const code = n.code.toLowerCase();
    if (code === q || name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (code.startsWith(q)) return 2;
    return name.includes(q) ? 3 : 4;
  };
  return names
    .map((n) => ({ n, r: rank(n) }))
    .filter((x) => x.r < 4)
    .sort((a, b) => a.r - b.r)
    .slice(0, 8)
    .map((x) => x.n);
}

const STAGE_LABEL: Record<Stage, string> = {
  history: "데이터 부족",
  trend: "추세 조건 탈락",
  no_leg: "기준봉 없음",
  leg_broken: "기준 마디 훼손",
  no_trigger: "오늘 신호 없음",
  risk: "신호 보류",
  pass: "신호",
};

function AddForm({ names, busy, onAdd }: { names: NameItem[]; busy: boolean; onAdd: (input: string, buyPrice: number | null) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<NameItem | null>(null);
  const [buy, setBuy] = useState("");
  const matches = useMemo(() => (picked ? [] : searchNames(names, query)), [names, query, picked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // 입력이 이름 일부와 겹쳐도 멋대로 첫 결과를 고르지 않는다. "ARM"이 Pharma로 들어가면 안 된다
    const exact = matches.find((n) => n.code.toUpperCase() === q.toUpperCase() || n.name === q);
    const target = picked?.symbol ?? exact?.symbol ?? (matches.length === 1 ? matches[0].symbol : q);
    if (await onAdd(target, parsePrice(buy))) {
      setQuery("");
      setPicked(null);
      setBuy("");
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <div className="relative">
          <label htmlFor="my-query" className="mb-1 block text-xs text-ink-3">
            종목 이름 또는 코드
          </label>
          <input
            id="my-query"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
            }}
            autoComplete="off"
            placeholder="삼성전자, 005930, AAPL"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-base outline-none focus:border-ink-3"
          />
          {matches.length ? (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface shadow-lg">
              {matches.map((n) => (
                <li key={n.symbol}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(n);
                      setQuery(n.name);
                    }}
                    className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0 truncate">{n.name}</span>
                    <span className="num shrink-0 text-xs text-ink-3">
                      {n.code} · {n.exchange}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <label htmlFor="my-buy" className="mb-1 block text-xs text-ink-3">
            매수가 (선택)
          </label>
          <input
            id="my-buy"
            value={buy}
            onChange={(e) => setBuy(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            className="num w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-base outline-none focus:border-ink-3"
          />
        </div>
        <button type="submit" disabled={busy} className="self-end rounded-lg bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-50">
          {busy ? "확인 중" : "추가"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">목록에 없는 ETF, 우선주, 미국 주식은 코드를 그대로 입력하고 추가를 누르세요.</p>
    </form>
  );
}

function HoldingBody({
  h,
  saved,
  item,
  regimeUp,
  onBuyPrice,
}: {
  h: Holding;
  saved: Saved;
  item: NameItem | undefined;
  regimeUp: Record<MarketId, boolean>;
  onBuyPrice: (price: number | null) => void;
}) {
  const [showChart, setShowChart] = useState(false);
  const { buyPrice } = saved;
  const pnl = buyPrice ? (h.close / buyPrice - 1) * 100 : null;
  const a = h.analysis;
  const { entry, stop } = h.plan;
  const lines = useMemo<PriceLine[]>(
    () => [
      ...(buyPrice ? [{ price: buyPrice, title: "매수가", color: "ink" as const }] : []),
      ...(entry != null ? [{ price: entry, title: "진입 참고", color: "up" as const }] : []),
      ...(stop != null ? [{ price: stop, title: "손절 참고", color: "down" as const }] : []),
    ],
    [buyPrice, entry, stop],
  );
  const markers = useMemo<Marker[]>(() => (h.baseDate ? [{ date: h.baseDate, text: "기준봉" }] : []), [h.baseDate]);

  const listed = item?.exchange === "코스피" || item?.exchange === "S&P 500";
  const scope = !listed
    ? "코스피·S&P 500 밖의 종목이라 오늘의 후보에 오르지 않고, 규칙의 과거 검증 범위에도 없습니다."
    : !h.liquid
      ? "거래대금이 후보 기준에 못 미쳐 오늘의 후보에는 오르지 않습니다."
      : a.setup && !regimeUp[h.market]
        ? "시장 평균이 60일선 아래라 오늘의 후보에서는 보류되는 신호입니다."
        : null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <div className="font-semibold">{item?.name ?? h.name}</div>
          <div className="num mt-0.5 text-xs text-ink-3">
            {h.code} · {item?.exchange ?? "직접 입력"} · {h.asOf.slice(5).replace("-", "/")} 종가 기준
          </div>
        </div>
        <div className="num text-right">
          <div className="font-semibold">{fmtPrice(h.market, h.close)}</div>
          <div className="text-xs">
            <Change pct={h.changePct} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <label className="flex items-center gap-2 text-xs text-ink-3">
          매수가
          <input
            defaultValue={buyPrice ?? ""}
            onBlur={(e) => {
              const price = parsePrice(e.target.value);
              // 숫자가 아니면 지워서 저장되지 않았다는 걸 보여 준다
              e.target.value = price == null ? "" : String(price);
              onBuyPrice(price);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            inputMode="decimal"
            autoComplete="off"
            className="num w-28 rounded-md border border-line bg-bg px-2 py-1 text-base text-ink outline-none focus:border-ink-3 sm:text-sm"
          />
        </label>
        {pnl != null ? (
          <span className="num text-xs text-ink-3">
            매수가 대비 <b className={`font-semibold ${pnl > 0 ? "text-up" : pnl < 0 ? "text-down" : "text-ink-2"}`}>{fmtPct(pnl, true)}</b>
          </span>
        ) : null}
      </div>

      <div className="mt-3 rounded-lg bg-surface-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-3">새로 산다면, 오늘 규칙 판정</span>
          <Chip tone={a.setup ? "solid" : a.watch === "pullback_forming" ? "good" : "plain"}>
            {a.setup ? `신호: ${SETUP_LABEL[a.setup]}` : a.watch ? WATCH_LABEL[a.watch] : STAGE_LABEL[a.stage]}
          </Chip>
        </div>
        {a.note ? <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{a.note}</p> : null}
        {scope ? <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{scope}</p> : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-b border-line pb-3">
        <Stat
          label="진입 참고가"
          value={entry != null ? fmtPrice(h.market, entry) : "규칙상 자리 없음"}
          valueClass={entry != null ? "text-up" : "text-ink-3 text-sm"}
          sub={entry != null ? `${h.plan.entryBasis} (종가 대비 ${fmtPct((entry / h.close - 1) * 100, true)})` : undefined}
        />
        <Stat
          label="손절 참고선"
          value={stop != null ? fmtPrice(h.market, stop) : "규칙으로 정할 수 없음"}
          valueClass={stop != null ? "text-down" : "text-ink-3 text-sm"}
          sub={stop != null ? `${h.plan.stopBasis}${h.plan.stopTested ? "" : "(미검증)"} (종가 대비 ${fmtPct((stop / h.close - 1) * 100, true)})` : undefined}
        />
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {h.checks.map((c) => (
          <div key={c.key} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-xs text-ink-3">{c.label}</dt>
            <dd className={`num text-right text-xs ${c.ok === false ? "font-medium text-warn-ink" : c.ok ? "text-ink-2" : "text-ink-3"}`}>{c.detail}</dd>
          </div>
        ))}
      </dl>

      <button type="button" onClick={() => setShowChart((x) => !x)} aria-expanded={showChart} className="mt-3 text-xs text-ink-2 underline underline-offset-2">
        {showChart ? "차트 닫기" : "차트 보기"}
      </button>
      {showChart ? (
        <div className="mt-3">
          <PriceChart market={h.market} chart={h.chart} lines={lines} markers={markers} />
        </div>
      ) : null}
    </>
  );
}

export default function MyStocks({ names, regimeUp, max }: { names: NameItem[]; regimeUp: Record<MarketId, boolean>; max: number }) {
  // null이면 아직 브라우저 저장소를 읽기 전이다. 서버 화면에는 저장소가 없다
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [results, setResults] = useState<Record<string, Holding | string>>({});
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const nameOf = useMemo(() => new Map(names.map((n) => [n.symbol, n])), [names]);

  useEffect(() => {
    const list = readSaved();
    setSaved(list);
    if (!list.length) return;
    fetchHoldings(list.map((s) => s.symbol))
      .then((rs) => setResults(Object.fromEntries(rs.map((r) => [r.input, "holding" in r ? r.holding : r.error]))))
      .catch((e: Error) => {
        setResults(Object.fromEntries(list.map((s) => [s.symbol, "시세를 받지 못했습니다"])));
        setMessage(e.message);
      });
  }, []);

  function persist(next: Saved[]) {
    setSaved(next);
    if (!writeSaved(next)) setMessage("이 브라우저에 저장하지 못했습니다. 새로고침하면 사라집니다.");
  }

  async function add(input: string, buyPrice: number | null): Promise<boolean> {
    const list = saved ?? [];
    if (list.length >= max) {
      setMessage(`종목은 ${max}개까지 넣을 수 있습니다.`);
      return false;
    }
    setAdding(true);
    setMessage(null);
    try {
      const [r] = await fetchHoldings([input]);
      if ("error" in r) {
        setMessage(`${input}: ${r.error}`);
        return false;
      }
      const { symbol } = r.holding;
      if (list.some((s) => s.symbol === symbol)) {
        setMessage(`${nameOf.get(symbol)?.name ?? r.holding.name}은(는) 이미 넣은 종목입니다.`);
        return false;
      }
      setResults((prev) => ({ ...prev, [symbol]: r.holding }));
      persist([...list, { symbol, buyPrice }]);
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <AddForm names={names} busy={adding} onAdd={add} />
      {message ? (
        <p role="alert" className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          {message}
        </p>
      ) : null}

      {saved?.length === 0 ? <p className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-ink-3">아직 넣은 종목이 없습니다.</p> : null}

      <ul className="mt-4 grid gap-3">
        {saved?.map((s) => {
          const r = results[s.symbol];
          return (
            <li key={s.symbol} className="rounded-xl border border-line bg-surface p-4">
              {r == null ? (
                <p className="text-sm text-ink-3">{nameOf.get(s.symbol)?.name ?? s.symbol} 불러오는 중</p>
              ) : typeof r === "string" ? (
                <p className="text-sm text-ink-2">
                  {nameOf.get(s.symbol)?.name ?? s.symbol}: {r}
                </p>
              ) : (
                <HoldingBody h={r} saved={s} item={nameOf.get(s.symbol)} regimeUp={regimeUp} onBuyPrice={(price) => persist(saved.map((x) => (x.symbol === s.symbol ? { ...x, buyPrice: price } : x)))} />
              )}
              <div className="mt-3 border-t border-line pt-2 text-right">
                <button
                  type="button"
                  onClick={() => persist(saved.filter((x) => x.symbol !== s.symbol))}
                  className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink"
                >
                  목록에서 빼기
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
