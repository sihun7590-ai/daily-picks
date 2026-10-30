"use client";

import { useEffect, useState } from "react";

/**
 * 자동 갱신이 멈춰도 사이트는 멀쩡히 열린다. 멈춘 줄 모르고 옛 후보를 보는 게 가장 나쁘다.
 * 빌드 시점이 아니라 보는 시점에 재야 하므로 클라이언트에서 계산한다.
 */
export default function StaleBanner({ generatedAt }: { generatedAt: string }) {
  const [days, setDays] = useState(0);
  useEffect(() => {
    setDays(Math.floor((Date.now() - new Date(generatedAt).getTime()) / 86_400_000));
  }, [generatedAt]);
  // 금요일 갱신 뒤 월요일 갱신 전까지 3일이 정상이다
  if (days < 4) return null;
  return (
    <p className="mb-4 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn-ink">
      데이터가 {days}일 전 것입니다. 자동 갱신이 멈췄을 수 있으니 GitHub Actions 실행 기록을 확인하세요.
    </p>
  );
}
