import { Stat } from "@/components/Chips";
import type { Summary } from "@/lib/backtest";
import { BACKTEST, PICKS } from "@/lib/data";
import { LECTURES, lectureUrl, SETUP_LABEL, type Lecture } from "@/lib/lectures";
import { fmtPct, MARKET_LABEL } from "@/lib/picks";
import { P } from "@/lib/rules";
import type { MarketId, SetupId } from "@/lib/types";

export const metadata = { title: "선정 기준과 검증" };

function Ref({ l }: { l: Lecture }) {
  return (
    <a href={lectureUrl(l)} target="_blank" rel="noreferrer" className="whitespace-nowrap text-xs text-ink-3 underline underline-offset-2 hover:text-ink">
      {l.label}
    </a>
  );
}

function Rule({ title, children, refs }: { title: string; children: React.ReactNode; refs: Lecture[] }) {
  return (
    <li className="grid gap-1 px-4 py-3 sm:grid-cols-[9.5rem_1fr]">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-sm leading-relaxed text-ink-2">
        {children}{" "}
        <span className="inline-flex flex-wrap gap-x-2">
          {refs.map((r) => (
            <Ref key={r.id} l={r} />
          ))}
        </span>
      </div>
    </li>
  );
}

function pctCls(x: number) {
  return x > 0 ? "text-up" : x < 0 ? "text-down" : "";
}

function Row({ label, s, note }: { label: string; s: Summary; note?: string }) {
  return (
    <tr className="border-t border-line">
      <td className="whitespace-nowrap py-2 pr-3 text-left font-medium">
        {label}
        {note ? <span className="ml-1.5 text-xs font-normal text-ink-3">{note}</span> : null}
      </td>
      <td className="px-2 py-2">{s.n}</td>
      <td className="px-2 py-2">{s.winRate.toFixed(0)}%</td>
      <td className={`px-2 py-2 font-medium ${pctCls(s.avgRet)}`}>{fmtPct(s.avgRet, true)}</td>
      <td className="px-2 py-2">{fmtPct(s.medianRet, true)}</td>
      <td className="px-2 py-2">{s.avgHeld.toFixed(0)}일</td>
      <td className={`whitespace-nowrap px-2 py-2 ${pctCls(s.fwd20Excess)}`}>
        {fmtPct(s.fwd20Excess, true)} <span className="text-xs text-ink-3">±{s.fwd20ExcessSe.toFixed(1)}</span>
      </td>
    </tr>
  );
}

function ResultTable({ market }: { market: MarketId }) {
  const b = BACKTEST.markets[market];
  const setups = Object.keys(b.bySetup) as SetupId[];
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface p-4">
      <h3 className="font-semibold">{MARKET_LABEL[market]}</h3>
      <table className="num mt-2 w-full min-w-[560px] text-right text-sm">
        <thead className="text-xs text-ink-3">
          <tr>
            <th className="pb-2 pr-3 text-left font-normal">구분</th>
            <th className="px-2 pb-2 font-normal">건수</th>
            <th className="px-2 pb-2 font-normal">수익 비율</th>
            <th className="px-2 pb-2 font-normal">평균 수익률</th>
            <th className="px-2 pb-2 font-normal">중앙값</th>
            <th className="px-2 pb-2 font-normal">보유</th>
            <th className="px-2 pb-2 font-normal">20일 뒤 시장 대비</th>
          </tr>
        </thead>
        <tbody>
          <Row label="2022~2024" note="규칙을 고른 구간" s={b.byPeriod["2022-2024"]} />
          <Row label="2025~2026" note="검증 구간" s={b.byPeriod["2025-2026"]} />
          {setups.map((k) => (
            <Row key={k} label={SETUP_LABEL[k]} s={b.bySetup[k]!} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RulesPage() {
  const k = BACKTEST.markets.kospi.byPeriod["2025-2026"];
  const s = BACKTEST.markets.sp500.byPeriod["2025-2026"];
  const c = BACKTEST.coverage;
  return (
    <>
      <h1 className="text-2xl font-bold">선정 기준과 검증</h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-3">강사는 숫자 기준을 일부러 주지 않습니다. 아래 숫자는 강의를 읽고 Claude가 판단해 정한 값이고, 규칙 {PICKS.rulesVersion}판입니다.</p>

      <h2 className="mb-2 mt-8 text-lg font-bold">결론부터</h2>
      <div className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
        <p>
          <b className="text-ink">이 규칙이 시장을 이긴다는 증거는 없습니다.</b> 2022~2024년 데이터로 규칙을 고른 뒤 2025~2026년에 돌려 봤더니 코스피는 평균 <b className={`num ${pctCls(k.avgRet)}`}>{fmtPct(k.avgRet, true)}</b>, S&P 500은 평균{" "}
          <b className={`num ${pctCls(s.avgRet)}`}>{fmtPct(s.avgRet, true)}</b>였습니다. 20일 뒤 시장 평균과의 차이도 오차 범위 안이라 우연과 구분되지 않습니다.
        </p>
        <p className="mt-2">그래서 이 사이트의 쓸모는 수익 보장이 아니라, 1,300여 종목 중 강의 기준에 맞는 차트만 추려 공부하고 판단할 시간을 줄이는 데 있습니다. 앞으로의 판정은 매일 기록해 두므로 실제 성적을 나중에 따로 잴 수 있습니다.</p>
      </div>

      <h2 className="mb-2 mt-8 text-lg font-bold">1단계: 볼 만한 종목인가</h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        <Rule title="거래대금" refs={[LECTURES.b5]}>
          20일 평균 거래대금 코스피 30억 원, S&P 500 5천만 달러 이상.
        </Rule>
        <Rule title="시장 상태" refs={[LECTURES.b36]}>
          시장 전체 평균이 60일 평균 위일 때만 새 신호를 냅니다. 강의의 "매매 구간"을 시장 전체에 적용한 판단으로, 강의에 직접 나오는 규칙은 아닙니다. 2022~2024년 코스피에서 손실을 크게 줄였습니다.
        </Rule>
        <Rule title="추세" refs={[LECTURES.m13]}>
          60일선이 120일선 위, 120일선 우상향, 종가가 60일선 위.
        </Rule>
        <Rule title="위쪽 매물" refs={[LECTURES.b7, LECTURES.m19]}>
          종가가 1년 고점의 {Math.round(P.trend.minVsHigh * 100)}% 이상. 물린 매물이 많은 자리는 피합니다.
        </Rule>
      </ul>

      <h2 className="mb-2 mt-8 text-lg font-bold">2단계: 기준 마디가 살아 있는가</h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        <Rule title="기준봉" refs={[LECTURES.b11]}>
          최근 {P.leg.maxAge}봉 안에 다음을 모두 갖춘 캔들: 평소 변동폭의 {P.base.gainVsRange}배와 {P.base.minGain * 100}% 중 큰 값 이상 상승(갭 포함), 거래량 20일 평균의 {P.base.minVolRatio}배 이상, 종가가 캔들 위쪽 {P.base.minClosePos * 100}% 이상, {P.base.highLookback}일 종가 신고가, 20·60일선이 꺾이지 않음, 직전까지 이평선이 벌어지지 않음.
        </Rule>
        <Rule title="허리" refs={[LECTURES.b12, LECTURES.b23]}>
          상승 시작점부터 고점까지의 마디에서 {P.leg.waistZone[0] * 100}~{P.leg.waistZone[1] * 100}% 구간 중 시·종·고·저가 가장 많이 닿은 가격. 3번 미만이면 중간값.
        </Rule>
        <Rule title="망가지면 제외" refs={[LECTURES.m7, LECTURES.b38]}>
          마디의 {P.leg.maxDepth * 100}%보다 깊게 눌림, 허리 두 번 이탈, 종가가 허리 아래, 조정 중 거래 폭발, 음봉 {P.pullback.maxDownRun}일 연속.
        </Rule>
      </ul>

      <h2 className="mb-2 mt-8 text-lg font-bold">3단계: 오늘 신호가 나왔는가</h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        <Rule title={SETUP_LABEL.second_base} refs={[LECTURES.m4, LECTURES.m6]}>
          고점 뒤 {P.pullback.minBarsForPeakBreak}봉 이상 쉬고, 종가로 전고점 돌파, 거래량 평균의 {P.trigger.peakBreakoutVol}배 이상.
        </Rule>
        <Rule title="눌림 돌파 계열" refs={[LECTURES.b17, LECTURES.m5, LECTURES.b26]}>
          좁게 수렴한 구간의 상단을 종가로 돌파, 거래량 평균의 {P.trigger.breakoutVol}배 이상이면서 눌림 구간의 {P.trigger.volVsPullback}배 이상. 얕게 눌렸으면 고가놀이 돌파, 허리를 깼다 복귀했으면 AF 돌파로 표시합니다.
        </Rule>
        <Rule title={SETUP_LABEL.pullback_confirm} refs={[LECTURES.b39]}>
          전날 거래량이 평균의 {P.trigger.confirmPrevVol * 100}% 아래로 마르고, 허리나 20일선 근처에서 평균 이상 거래량의 양봉이 전날 몸통을 넘음. 예측 매매라 손익비 {P.risk.minRrPredictive} 이상만 받습니다.
        </Rule>
        <Rule title="공통 탈락" refs={[LECTURES.b10, LECTURES.m6, LECTURES.m20]}>
          최근 5일 고점 대량거래(평균 {P.climax.volRatio}배 이상 + 긴 윗꼬리), 돌파 실패 2회 이상(박스), 20일선과 {Math.round((P.risk.maxVsMa20 - 1) * 100)}% 이상 벌어짐, 손절 폭 {P.risk.maxRiskPct}% 초과, 손익비 {P.risk.minRr} 미만, 바로 위에 여러 번 막힌 저항.
        </Rule>
      </ul>

      <h2 className="mb-2 mt-8 text-lg font-bold">손절과 익절</h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        <Rule title="손절선" refs={[LECTURES.m19, LECTURES.m20]}>
          수렴 후 돌파는 수렴 하단, 그 외에는 눌림 저점. 고정 퍼센트를 쓰지 않습니다.
        </Rule>
        <Rule title="1차 목표" refs={[LECTURES.b37]}>
          위쪽 스윙 고점, 전고점, N자·E자 목표 중 손익비를 만족하는 가장 가까운 가격.
        </Rule>
        <Rule title="이후" refs={[LECTURES.b37, LECTURES.m21]}>
          1차 목표에서 절반 정리, 손절선을 본전으로 올림, 나머지는 20일선 종가 이탈 때 청산.
        </Rule>
      </ul>

      <h2 className="mb-2 mt-8 text-lg font-bold">과거 검증</h2>
      <p className="text-sm leading-relaxed text-ink-2">
        코스피 {c.kospi.symbols}종목, S&P 500 {c.sp500.symbols}종목의 {c.kospi.from}~{c.kospi.to} 일봉에 규칙을 그대로 돌렸습니다.
      </p>
      <ResultTable market="kospi" />
      <ResultTable market="sp500" />
      <div className="mt-3 rounded-xl border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">이 숫자를 읽을 때</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          <li>신호 다음 날 시가에 사고, 왕복 비용 코스피 0.3%, S&P 500 0.1%를 뺐습니다. 같은 날 손절과 목표를 모두 건드리면 손절로 쳤습니다.</li>
          <li>지금 상장된 종목만 봤습니다. 상장폐지되거나 지수에서 빠진 종목이 없어 실제보다 좋게 나옵니다.</li>
          <li>"±"는 표준오차입니다. 평균이 ±의 2배 안쪽이면 우연과 구분되지 않습니다.</li>
          <li>규칙을 고르는 근거로는 2022~2024년만 썼고, 규칙을 확정한 뒤 2025~2026년 결과를 보고 다시 고치지 않았습니다. 다만 초기 버전을 돌릴 때 그 구간 숫자가 함께 출력된 적이 있어 완전히 보지 않은 데이터는 아닙니다.</li>
        </ul>
      </div>

      <h2 className="mb-2 mt-8 text-lg font-bold">강의에 있지만 넣지 않은 것</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <Stat label="지지 이탈 복귀" value="꺼 둠" />
          <p className="mt-1 text-sm leading-relaxed text-ink-2">강사가 가장 좋은 자리로 꼽지만, 기계 판별로는 2022~2024년에 코스피 -2.6%, S&P 500 -5.1%로 나빴습니다. 사람이 맥락을 보고 골라야 하는 자리로 판단했습니다.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <Stat label="사람의 판단 영역" value="자동화 안 함" />
          <p className="mt-1 text-sm leading-relaxed text-ink-2">세력 의도 읽기, 종목별 움직임 습관, 분봉으로 좁힌 기준가, 시황과 재료는 넣지 않았습니다. 일봉 기준으로만 보니 상세 화면에서 직접 확인하세요.</p>
        </div>
      </div>
    </>
  );
}
