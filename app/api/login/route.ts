import { NextResponse } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = process.env.SITE_PASSWORD;
  const home = new URL("/", req.url);
  const retry = new URL("/login?error=1", req.url);
  if (!password || form.get("password") !== password) return NextResponse.redirect(retry, 303);

  const res = NextResponse.redirect(home, 303);
  res.cookies.set(AUTH_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
