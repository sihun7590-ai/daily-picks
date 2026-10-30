import type { SetupId, WatchId } from "./types";

export type Lecture = { label: string; title: string; id: string };

const L = (label: string, title: string, id: string): Lecture => ({ label, title, id });

export const LECTURES = {
  b5: L("초급 5화", "거래량의 비밀", "0tgkq8_dI4M"),
  b7: L("초급 7화", "지지와 저항", "8WFO0qa8dkE"),
  b10: L("초급 10화", "고점 대량거래", "aX37l8vLwns"),
  b11: L("초급 11화", "기준봉", "A4fhqVhlV1Q"),
  b12: L("초급 12화", "기준 마디", "dTGsswbakyU"),
  b17: L("초급 17화", "눌림목 매매의 정석", "_gMl9wQx_aI"),
  b18: L("초급 18화", "돌파 매매의 정석", "Y-smtMLJ33E"),
  b23: L("초급 23화", "허리 찾기", "Yyb85UrGF4c"),
  b26: L("초급 26화", "AF 패턴", "kHMp_Qu09MY"),
  b28: L("초급 28화", "상방·하방 판단 4가지", "_53WWGWTKlo"),
  b36: L("초급 36화", "매수 원칙", "ZXKeUgHjElI"),
  b37: L("초급 37화", "매도 원칙", "-4B0YjzIKxM"),
  b38: L("초급 38화", "거래량과 심리", "cr1Imugb2gg"),
  b39: L("초급 39화", "거래량 타이밍", "INJHrq759bQ"),
  m4: L("중급 4화", "돌파 매매 3형제", "kDKJVo38U7g"),
  m5: L("중급 5화", "눌림목 매매 정리", "PqWOU4JCIlw"),
  m6: L("중급 6화", "돌파를 하면 안 될 때", "rv2AcFglaVU"),
  m7: L("중급 7화", "눌림을 하면 안 될 때", "SdsquzXiRcY"),
  m10: L("중급 10화", "알파벳 패턴 심화", "4coUOxzrf6o"),
  m13: L("중급 13화", "이동평균선 매매 핵심", "ZYlZB_36XI0"),
  m16: L("중급 16화", "매수 원칙 총정리", "KXZ9neIF0Rw"),
  m19: L("중급 19화", "손절선 정하기", "dmMSaI7RgN0"),
  m20: L("중급 20화", "손절이 어려운 이유", "8cO5s54qy1Q"),
  m21: L("중급 21화", "손절선 옮기기", "OuZOe-SdZa4"),
} as const;

export const SETUP_LABEL: Record<SetupId, string> = {
  second_base: "2차 기준봉",
  af: "AF 돌파",
  high_tight: "고가놀이 돌파",
  pullback_breakout: "눌림 돌파",
  pullback_confirm: "눌림 첫 양봉",
  trap_reclaim: "지지 이탈 복귀",
};

export const SETUP_DESC: Record<SetupId, string> = {
  second_base: "시간 조정을 거친 뒤 전고점을 거래량과 함께 넘었습니다.",
  af: "허리를 잠깐 깼다가 복귀한 뒤, 작은 봉으로 수렴하다 위로 돌파했습니다.",
  high_tight: "가격을 거의 내주지 않고 옆으로 쉬다가 거래량과 함께 위로 돌파했습니다.",
  pullback_breakout: "거래가 줄며 눌린 뒤 수렴 상단을 거래량과 함께 돌파했습니다.",
  pullback_confirm: "거래가 마른 뒤 지지 근처에서 평균 이상의 거래량으로 첫 양봉이 나왔습니다.",
  trap_reclaim: "지지선을 깼다가 곧바로 다시 올라왔습니다.",
};

export const WATCH_LABEL: Record<WatchId, string> = {
  first_base: "1차 기준봉",
  pullback_forming: "돌파 대기",
  pullback_weak: "조건 부족",
  rising: "상승 중",
};

const SETUP_LECTURES: Record<SetupId, Lecture[]> = {
  second_base: [LECTURES.b11, LECTURES.b18, LECTURES.m4, LECTURES.m6],
  af: [LECTURES.b26, LECTURES.m10, LECTURES.m6],
  high_tight: [LECTURES.b17, LECTURES.b39, LECTURES.m6],
  pullback_breakout: [LECTURES.b17, LECTURES.m5, LECTURES.m7],
  pullback_confirm: [LECTURES.b39, LECTURES.m5, LECTURES.m7],
  trap_reclaim: [LECTURES.m7, LECTURES.m16],
};

export function lecturesFor(setup: SetupId): Lecture[] {
  return [...SETUP_LECTURES[setup], LECTURES.b12, LECTURES.b23, LECTURES.m19, LECTURES.b37];
}

export const WATCH_LECTURES: Record<WatchId, Lecture[]> = {
  first_base: [LECTURES.b11, LECTURES.b12, LECTURES.b39],
  pullback_forming: [LECTURES.b17, LECTURES.b23, LECTURES.m7, LECTURES.m19],
  pullback_weak: [LECTURES.b17, LECTURES.m7, LECTURES.m20],
  rising: [LECTURES.m6, LECTURES.b17],
};

export function lectureUrl(l: Lecture): string {
  return `https://www.youtube.com/watch?v=${l.id}`;
}
