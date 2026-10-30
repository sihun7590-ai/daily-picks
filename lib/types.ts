import type { LectureKey } from "./lectures";

export type Bar = {
  /** 거래소 현지 기준 날짜 YYYY-MM-DD */
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type MarketId = "kospi" | "sp500";

export type UniverseItem = {
  /** Yahoo 심볼 (005930.KS, BRK-B) */
  symbol: string;
  /** 화면에 보이는 코드 (005930, BRK.B) */
  code: string;
  name: string;
  sector: string;
};

export type Universe = {
  updatedAt: string;
  kospi: UniverseItem[];
  /** 내 종목 화면의 이름 검색에만 쓴다. 후보를 고르는 대상이 아니다 */
  kosdaq: UniverseItem[];
  sp500: UniverseItem[];
};

export type SetupId =
  | "second_base" // 2차 기준봉(전고 돌파)
  | "af" // AF 돌파
  | "high_tight" // 고가놀이 돌파
  | "pullback_breakout" // 눌림 돌파
  | "pullback_confirm" // 눌림 확인(거래 감소 후 첫 양봉)
  | "trap_reclaim"; // 지지 이탈 후 복귀

export type WatchId =
  | "first_base" // 1차 기준봉 출현
  | "pullback_forming" // 거래 줄며 눌리는 중: 돌파 대기
  | "pullback_weak" // 눌리는 중이지만 조건이 부족하다
  | "rising"; // 조정 없이 상승 중: 추격 금지

export type ScoreItem = {
  key: string;
  label: string;
  score: number;
  max: number;
  detail: string;
};

/** 차트에 표시할 수준들. 전부 가격이다. */
export type Levels = {
  legLow: number;
  legHigh: number;
  waist: number;
  pullLow: number | null;
};

export type BaseInfo = {
  date: string;
  volRatio: number;
  gainPct: number;
};

export type Signal = {
  setup: SetupId;
  /** 강의의 분류: 확인 매매 / 예측 매매 */
  kind: "확인" | "예측";
  entry: number;
  stop: number;
  stopBasis: string;
  target: number;
  targetBasis: string;
  rr: number;
  riskPct: number;
  score: number;
  breakdown: ScoreItem[];
  warnings: string[];
  levels: Levels;
  base: BaseInfo;
  volRatio: number;
  dryUp: number | null;
  depth: number | null;
  barsSincePeak: number | null;
};

export type Watch = {
  id: WatchId;
  /** 이 가격을 거래량과 함께 넘으면 신호가 된다. 1차 기준봉은 아직 트리거가 없다. */
  trigger: number | null;
  triggerBasis: string | null;
  /** 수렴 구간의 봉 수. 수렴이 없으면 null */
  boxBars: number | null;
  stop: number | null;
  stopBasis: string | null;
  riskPct: number | null;
  distancePct: number | null;
  score: number;
  note: string;
  levels: Levels;
  base: BaseInfo;
  dryUp: number | null;
};

/** 규칙이 보는 항목의 현재 값. ok가 null이면 데이터가 없어 판단할 수 없다 */
export type Check = {
  key: string;
  label: string;
  ok: boolean | null;
  detail: string;
};

/** 차트에서 찾은 지지 가격. 매수가 기준 계산의 재료다 */
export type PlanLevel = { price: number; basis: string; date: string | null };

/** 규칙을 차트에 기계적으로 적용한 진입·손절 참고값. 규칙이 정한 자리가 없으면 null */
export type RulePlan = {
  entry: number | null;
  entryBasis: string | null;
  /** 이 가격인 이유, 또는 가격이 없는 이유 */
  entryWhy: string;
  entryRefs: LectureKey[];
  stop: number | null;
  stopBasis: string | null;
  /** 과거 검증에 쓴 손절선인가. false면 강의 기준을 옮긴 대체값이다 */
  stopTested: boolean;
  stopWhy: string;
  stopRefs: LectureKey[];
  /** 높은 가격부터 */
  supports: PlanLevel[];
  maxRiskPct: number;
};

/** 깔때기 어느 단계에서 탈락했는지. 기준이 너무 빡빡한지 판단하는 근거로 쓴다. */
export type Stage =
  | "history" // 데이터 부족
  | "trend" // 추세 조건 탈락
  | "no_leg" // 유효한 기준 마디 없음
  | "leg_broken" // 마디가 있었지만 망가짐
  | "no_trigger" // 마디는 유효, 오늘 진입 신호 없음
  | "risk" // 신호는 떴지만 손절 폭/손익비 탈락
  | "pass"; // 후보

export type Analysis = {
  stage: Stage;
  signal: Signal | null;
  watch: Watch | null;
  /** 탈락 사유 한 줄. 디버깅과 화면 표시용 */
  note: string | null;
};
