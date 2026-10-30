/** 종목 목록을 갱신한다. 실패하거나 개수가 이상하면 기존 파일을 그대로 둔다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Universe } from "../lib/types";
import { fetchKosdaq, fetchKospi, fetchSp500 } from "../lib/universe";

const FILE = "data/universe.json";
/** 위키백과 표나 KRX 페이지가 바뀌면 조용히 절반만 파싱될 수 있어서 하한을 둔다 */
const MIN = { kospi: 700, kosdaq: 1200, sp500: 490 };

export async function refreshUniverse(): Promise<Universe> {
  const prev: Universe | null = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : null;
  const next: Universe = { updatedAt: prev?.updatedAt ?? "", kospi: prev?.kospi ?? [], kosdaq: prev?.kosdaq ?? [], sp500: prev?.sp500 ?? [] };
  let changed = false;
  for (const [market, fetcher] of [["kospi", fetchKospi], ["kosdaq", fetchKosdaq], ["sp500", fetchSp500]] as const) {
    try {
      const list = await fetcher();
      if (list.length < MIN[market]) throw new Error(`${list.length}개뿐입니다`);
      next[market] = list.sort((a, b) => a.code.localeCompare(b.code));
      changed = true;
    } catch (e) {
      // 목록은 자주 안 바뀌므로 어제 것으로 돌아도 큰 문제가 없다. 시세 수집까지 멈추진 않는다
      console.warn(`${market} 목록 갱신 실패, 기존 목록 사용: ${(e as Error).message}`);
      if (!next[market].length) throw e;
    }
  }
  if (changed) {
    next.updatedAt = new Date().toISOString();
    mkdirSync("data", { recursive: true });
    writeFileSync(FILE, JSON.stringify(next, null, 1));
  }
  return next;
}

if (process.argv[1]?.endsWith("universe.ts")) {
  refreshUniverse().then((u) => console.log(`코스피 ${u.kospi.length} / S&P 500 ${u.sp500.length}`));
}
