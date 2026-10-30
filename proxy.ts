import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

/**
 * 지인 몇 명이 쓰는 사이트라 공용 비밀번호 하나로 막는다. 회원 기능을 만들 이유가 없다.
 * 사이트만 막는다. 저장소가 공개라 코드와 data/*.json은 누구나 볼 수 있다.
 * 개발 환경에서 비밀번호가 없으면 열어 두고, 운영에서 없으면 닫는다 — 설정을 빠뜨렸을 때 공개되면 안 된다.
 */
export async function proxy(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password && process.env.NODE_ENV !== "production") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  if (password && req.cookies.get(AUTH_COOKIE)?.value === (await sessionToken(password))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
