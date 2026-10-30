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
  stop: number | null;
  riskPct: number | null;
  distancePct: number | null;
  score: number;
  note: string;
  levels: Levels;
  base: BaseInfo;
  dryUp: number | null;
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
