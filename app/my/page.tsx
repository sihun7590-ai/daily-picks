import Link from "next/link";
import universe from "@/data/universe.json";
import MyStocks, { type NameItem } from "@/components/MyStocks";
import { PICKS } from "@/lib/data";
import { MAX_HOLDINGS } from "@/lib/holdings";
import type { Universe, UniverseItem } from "@/lib/types";

export const metadata = { title: "내 종목" };

const names = (items: UniverseItem[], exchange: string): NameItem[] => items.map(({ symbol, code, name }) => ({ symbol, code, name, exchange }));

export default function MyPage() {
  const u = universe as Universe;
  return (
    <>
      <h1 className="text-2xl font-bold">내 종목</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        넣은 종목과 매수가는 <b className="text-ink">이 브라우저에만 저장</b>됩니다. 다른 기기에서는 따로 넣어야 합니다.
      </p>
      <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
        <b className="text-ink">참고용입니다. 팔라거나 들고 있으라고 알려 주지 않습니다.</b> 진입·손절 가격은 규칙을 차트에 기계적으로 적용한 값이고, 매수가 기준 값도 입력한 가격에 강의 기준을 계산기처럼 적용할 뿐 자금이나 성향 같은 개인 사정을 보지 않습니다. 이 규칙의 과거 성적은{" "}
        <Link href="/rules" className="underline underline-offset-2">
          시장을 이기지 못했습니다
        </Link>
        .
      </div>
      <MyStocks
        names={[...names(u.kospi, "코스피"), ...names(u.kosdaq, "코스닥"), ...names(u.sp500, "S&P 500")]}
        regimeUp={{ kospi: PICKS.markets.kospi.regimeUp, sp500: PICKS.markets.sp500.regimeUp }}
        max={MAX_HOLDINGS}
      />
      <p className="mt-6 text-xs leading-relaxed text-ink-3">
        손절 참고선 중 수렴 하단·눌림 저점·이탈 저점은 과거 검증에 쓴 값이고, 허리 이탈·전저점은 기준 마디나 신호가 없을 때 강의 기준을 옮긴 값으로 검증을 거치지 않았습니다. 매수가 기준 값도 검증을 거치지 않았고 브라우저 안에서만 계산합니다. 넣은 종목은 저장소에 올라가지 않고 다른 사람에게도 보이지 않습니다. 시세를 받을 때 종목 코드만 서버를 거치고 저장되지는 않으며, 매수가는 브라우저 밖으로 나가지 않습니다. 브라우저 데이터를 지우면 함께 사라집니다.
      </p>
    </>
  );
}
