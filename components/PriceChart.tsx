"use client";

import type { AutoscaleInfo } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { ChartData } from "@/lib/picks";
import type { MarketId } from "@/lib/types";

export type PriceLine = { price: number; title: string; color: "up" | "down" | "ink" };
export type Marker = { date: string; text: string };

// 5일선은 다크 모드에서도 보이도록 글자색을 따라간다
const MA_COLORS = { ma5: "var(--ink-2)", ma20: "#e5484d", ma60: "#2fa84f", ma120: "#8e4ec6", ma240: "#e58a00" } as const;
const MA_LABEL = { ma5: "5", ma20: "20", ma60: "60", ma120: "120", ma240: "240" } as const;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 차트 라이브러리는 canvas에 그려서 var(--x)를 해석하지 못한다 */
function resolveColor(color: string): string {
  const m = color.match(/^var\((--[\w-]+)\)$/);
  return m ? cssVar(m[1]) : color;
}

export default function PriceChart({ market, chart, lines, markers }: { market: MarketId; chart: ChartData; lines: PriceLine[]; markers: Marker[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    // 차트 라이브러리는 window를 읽으므로 브라우저에서만 불러온다
    import("lightweight-charts").then(({ createChart, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers, LineStyle }) => {
      if (disposed) return;
      const up = cssVar("--up");
      const down = cssVar("--down");
      const c = createChart(el, {
        autoSize: true,
        layout: { background: { color: "transparent" }, textColor: cssVar("--ink-3"), attributionLogo: false },
        grid: { vertLines: { visible: false }, horzLines: { color: cssVar("--line") } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, rightOffset: 6 },
        localization: { locale: "ko-KR" },
      });

      const candles = c.addSeries(CandlestickSeries, {
        upColor: up,
        downColor: down,
        borderVisible: false,
        wickUpColor: up,
        wickDownColor: down,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: market === "kospi" ? { type: "price", precision: 0, minMove: 1 } : { type: "price", precision: 2, minMove: 0.01 },
        // 가격선은 축 범위를 넓히지 않는다. 그냥 두면 멀리 있는 목표가가 화면 밖으로 사라진다
        autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
          const r = original();
          if (!r?.priceRange) return r;
          const prices = lines.map((l) => l.price);
          return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...prices), maxValue: Math.max(r.priceRange.maxValue, ...prices) } };
        },
      });
      candles.setData(chart.bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));

      const volume = c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      candles.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.22 } });
      volume.setData(chart.bars.map((b) => ({ time: b.t, value: b.v, color: `${b.c >= b.o ? up : down}66` })));

      for (const key of ["ma5", "ma20", "ma60", "ma120", "ma240"] as const) {
        const s = c.addSeries(LineSeries, {
          color: resolveColor(MA_COLORS[key]),
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        s.setData(chart.bars.flatMap((b, i) => (chart[key][i] == null ? [] : [{ time: b.t, value: chart[key][i] as number }])));
      }

      const ink = cssVar("--ink-2");
      for (const l of lines) {
        candles.createPriceLine({
          price: l.price,
          title: l.title,
          color: l.color === "up" ? up : l.color === "down" ? down : ink,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
        });
      }
      createSeriesMarkers(
        candles,
        markers.map((m) => ({ time: m.date, position: "belowBar" as const, color: ink, shape: "arrowUp" as const, text: m.text })),
      );
      c.timeScale().fitContent();
      cleanup = () => c.remove();
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [market, chart, lines, markers]);

  return (
    <div>
      <div ref={ref} className="h-[340px] w-full sm:h-[420px]" />
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-3">
        {(Object.keys(MA_COLORS) as (keyof typeof MA_COLORS)[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-3" style={{ background: MA_COLORS[k] }} />
            {MA_LABEL[k]}일선
          </span>
        ))}
      </div>
    </div>
  );
}
