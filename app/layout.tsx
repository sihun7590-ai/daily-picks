import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "오늘의 후보",
  description: "강의 규칙에 맞는 코스피·S&P 500 종목을 매일 고르는 도구",
  // 지인끼리 쓰는 사이트다. 검색에 걸릴 이유가 없다
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="sticky top-0 z-10 border-b border-line bg-surface">
          <nav className="mx-auto flex max-w-5xl items-center gap-5 px-4 py-3 text-[15px]">
            <Link href="/" className="font-bold">
              오늘의 후보
            </Link>
            <Link href="/my" className="text-ink-2 hover:text-ink">
              내 종목
            </Link>
            <Link href="/rules" className="text-ink-2 hover:text-ink">
              선정 기준과 검증
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs leading-relaxed text-ink-3">
          강의 규칙을 기계적으로 적용한 개인 참고용 목록입니다. 투자 자문이나 매수 권유가 아니고, 시세는 Yahoo Finance 기준이라 오류나 지연이 있을 수 있습니다.
        </footer>
      </body>
    </html>
  );
}
