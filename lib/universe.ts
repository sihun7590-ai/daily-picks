import type { UniverseItem } from "./types";

const UA = { "User-Agent": "Mozilla/5.0" };

function text(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function cellsOf(row: string): string[] {
  return [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => text(m[1]));
}

/** KRX 상장법인목록. 회사 단위라 우선주·ETF는 애초에 없다. */
async function fetchKrx(marketType: "stockMkt" | "kosdaqMkt", suffix: "KS" | "KQ"): Promise<UniverseItem[]> {
  const res = await fetch(`https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&marketType=${marketType}`, {
    headers: UA,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`KRX HTTP ${res.status}`);
  const html = new TextDecoder("euc-kr").decode(await res.arrayBuffer());
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => cellsOf(m[1]));
  const header = rows[0] ?? [];
  const iName = header.indexOf("회사명");
  const iCode = header.indexOf("종목코드");
  const iSector = header.indexOf("업종");
  if (iName < 0 || iCode < 0) throw new Error("KRX 목록 형식이 바뀌었습니다");
  return rows
    .slice(1)
    .filter((r) => r[iCode] && !/스팩/.test(r[iName]))
    .map((r) => ({ symbol: `${r[iCode]}.${suffix}`, code: r[iCode], name: r[iName], sector: r[iSector] ?? "" }));
}

export const fetchKospi = () => fetchKrx("stockMkt", "KS");
/** 후보를 고르는 대상은 아니다. 내 종목 화면의 이름 검색에만 쓴다 */
export const fetchKosdaq = () => fetchKrx("kosdaqMkt", "KQ");

export async function fetchSp500(): Promise<UniverseItem[]> {
  const res = await fetch("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", {
    headers: UA,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  const html = await res.text();
  const table = html.match(/id="constituents"[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error("S&P 500 표를 찾지 못했습니다");
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => cellsOf(m[1]));
  return rows
    .slice(1)
    .filter((r) => r.length >= 3 && r[0])
    // Yahoo는 BRK.B를 BRK-B로 쓴다
    .map((r) => ({ symbol: r[0].replace(/\./g, "-"), code: r[0], name: r[1], sector: r[2] }));
}
