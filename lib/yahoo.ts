import type { Bar } from "./types";

const UA = { "User-Agent": "Mozilla/5.0" };

type ChartResponse = {
  chart: {
    result:
      | {
          meta: {
            gmtoffset: number;
            currency?: string;
            exchangeName?: string;
            shortName?: string;
            longName?: string;
            currentTradingPeriod?: { regular?: { start: number; end: number } };
          };
          timestamp?: number[];
          indicators: {
            quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[];
          };
        }[]
      | null;
    error: unknown;
  };
};

function localDate(ts: number, offset: number): string {
  return new Date((ts + offset) * 1000).toISOString().slice(0, 10);
}

/** 응답을 봉 배열로. 진행 중인 봉을 버리는 판단이 여기 있어서 테스트를 위해 분리했다. */
export function parseChart(json: ChartResponse, nowSec: number): Bar[] {
  const r = json.chart.result?.[0];
  if (!r?.timestamp) return [];
  const q = r.indicators.quote[0];
  const offset = r.meta.gmtoffset;
  const byDate = new Map<string, Bar>();
  r.timestamp.forEach((ts, i) => {
    const [o, h, l, c, v] = [q.open[i], q.high[i], q.low[i], q.close[i], q.volume[i]];
    // 거래정지일은 시세가 비거나 거래량 0으로 온다. 평균 거래량을 왜곡하므로 뺀다
    if (o == null || h == null || l == null || c == null || !v) return;
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) return;
    const t = localDate(ts, offset);
    byDate.set(t, { t, o, h, l, c, v });
  });
  const bars = [...byDate.values()].sort((a, b) => a.t.localeCompare(b.t));

  // 장중에 돌면 오늘 봉은 아직 미완성이다. 거래량이 작게 잡혀 신호를 망친다
  const period = r.meta.currentTradingPeriod?.regular;
  if (period && nowSec < period.end && bars.length) {
    const sessionDay = localDate(period.start, offset);
    if (bars[bars.length - 1].t === sessionDay) bars.pop();
  }
  return bars;
}

/** 없는 종목이면 null */
async function requestChart(symbol: string, range: string, attempts: number, timeoutMs: number): Promise<ChartResponse | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 404) return null;
      if (res.ok) return (await res.json()) as ChartResponse;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw lastError;
}

export async function fetchBars(symbol: string, range: string, nowSec = Math.floor(Date.now() / 1000)): Promise<Bar[]> {
  const json = await requestChart(symbol, range, 4, 20_000);
  return json ? parseChart(json, nowSec) : [];
}

export type ChartInfo = { bars: Bar[]; currency: string | null; exchange: string | null; name: string | null };

/** 사람이 화면에서 기다리는 요청이라 재시도를 줄이고 일찍 포기한다 */
export async function fetchChartInfo(symbol: string, range: string, nowSec = Math.floor(Date.now() / 1000)): Promise<ChartInfo | null> {
  const json = await requestChart(symbol, range, 2, 8_000);
  if (!json) return null;
  const meta = json.chart.result?.[0]?.meta;
  return { bars: parseChart(json, nowSec), currency: meta?.currency ?? null, exchange: meta?.exchangeName ?? null, name: meta?.longName ?? meta?.shortName ?? null };
}

/** 동시 요청 수를 제한해 순서대로 처리한다. Yahoo는 몰아서 치면 429를 준다. */
export async function mapPool<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
