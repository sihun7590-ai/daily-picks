# 오늘의 후보

차트프로 초급 40개 + 중급 22개 강의를 숫자 규칙으로 옮겨, 코스피와 S&P 500에서 규칙에 맞는 종목을 평일마다 고르는 사이트. 지인끼리 비밀번호를 공유해 쓴다.

**수익을 보장하는 도구도, 투자 자문도 아니다.** 규칙의 과거 성적은 `/rules` 페이지와 `data/backtest.json`에 있고, 2025~2026년 구간에서 시장 평균을 이기지 못했다.

**이 저장소는 공개다.** `SITE_PASSWORD`는 사이트만 막으므로 코드, 규칙, `data/`의 후보와 시세는 저장소에서 누구나 볼 수 있다. 비밀번호와 토큰은 커밋하지 않는다.

## 구조

```
GitHub Actions (평일 16:30 KST)
  └ scripts/refresh.ts
      ├ KRX·위키백과 → data/universe.json   종목 목록 (실패하면 기존 목록)
      ├ Yahoo Finance → 2년치 일봉
      ├ lib/rules.ts → 종목별 판정
      └ data/picks.json + data/history/<날짜>.json
  └ 커밋 → Vercel 재배포
```

사이트는 DB 없이 `data/*.json`을 빌드 때 읽는다. 비밀번호는 `proxy.ts`가 확인한다.

| 파일 | 역할 |
|---|---|
| `lib/rules.ts` | 규칙 전부. 임계값은 맨 위 `P`. 순수 함수만 |
| `lib/backtest.ts` | 과거 시뮬레이션. 측정 가정은 파일 맨 위 주석 |
| `scripts/refresh.ts` | 매일 도는 작업 |
| `scripts/backtest.ts` | `data/backtest.json` 재생성 |
| `scripts/research.ts`, `study.ts` | 규칙을 고를 때 쓴 비교. 사이트와 무관 |
| `components/MyStocks.tsx`, `lib/holdings.ts` | 내 종목 화면 |

## 내 종목 화면

`/my`에서 각자 보유 종목을 넣어 본다. **종목과 매수가는 브라우저 `localStorage`에만 저장한다.** 저장소가 공개이므로 `data/`나 코드에 넣지 않는다.

- 화면을 열 때 `/api/holdings`가 종목 코드만 받아 Yahoo 시세로 계산해 돌려주고, 아무것도 저장하지 않는다. 매수가는 서버로 보내지 않는다.
- 후보 선정(코스피·S&P 500)과 달리 코스닥, ETF, 다른 미국 주식도 받는다. 이런 종목은 규칙의 과거 검증 범위 밖이고 화면에도 그렇게 표시한다.
- `lib/rules.ts`의 `positionChecks`와 `positionPlan`은 항목의 현재 값과 진입·손절 참고값만 돌려준다. 매수가를 보지 않으며 **보유 종목의 매도·보유 결론을 내지 않는다.** 그런 판단을 넣으려면 먼저 검증해야 한다.
- 손절 참고값 중 허리 이탈·전저점은 신호나 눌림이 없을 때의 대체값으로, 과거 검증을 거치지 않았다. 화면에 "(미검증)"으로 표시한다.

## 명령어

```bash
npm run dev        # 개발 서버
npm test           # 규칙 테스트 (미래 참조 검사 포함)
npm run refresh    # 오늘 후보 다시 계산. 네트워크 사용, 약 2분
npm run backtest   # 5년치 검증. 첫 실행은 시세 수집이 필요, .cache/에 저장
npm run backtest:watch   # 관심 종목을 규칙대로 매매했을 때의 종목별 기록. backtest 뒤에 실행, 사이트와 무관
npm run build
```

## 규칙을 바꿀 때

1. `lib/rules.ts`의 `RULES_VERSION`을 올린다. 지난 기록과 "기준이 달라진 것"을 구분해야 한다.
2. `npm run backtest`로 `data/backtest.json`을 다시 만든다. 사이트의 숫자는 이 파일에서 나온다.
3. **규칙을 고르는 근거로 최근 구간을 쓰지 않는다.** 2025~2026년 성적을 보고 규칙을 고치면 그 구간은 더 이상 검증이 아니다. 앞으로의 진짜 검증은 `data/history/`에 쌓이는 매일의 판정이다.

## 배포

1. GitHub 저장소에 push
2. Vercel에서 저장소 Import
3. Vercel 환경변수 `SITE_PASSWORD` 추가 후 재배포. 없으면 운영 환경은 로그인 화면에서 막힌다
4. GitHub Actions 탭에서 `후보 갱신`을 한 번 수동 실행해 커밋과 재배포가 이어지는지 확인

배포가 조용히 멈추면 사이트는 옛 데이터로 계속 열린다. 4일 이상 지나면 홈 화면에 경고가 뜬다.
