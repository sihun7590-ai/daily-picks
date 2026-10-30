import { NextResponse } from "next/server";
import { loadHolding, MAX_HOLDINGS } from "@/lib/holdings";
import { mapPool } from "@/lib/yahoo";

// Yahoo가 느리면 종목 수만큼 기다린다
export const maxDuration = 60;

/** 주소에 종목이 남지 않도록 POST로 받는다 */
export async function POST(req: Request) {
  const body: { symbols?: unknown } | null = await req.json().catch(() => null);
  const symbols = body?.symbols;
  if (!Array.isArray(symbols) || symbols.length > MAX_HOLDINGS || !symbols.every((s) => typeof s === "string")) {
    return NextResponse.json({ error: "요청 형식이 맞지 않습니다" }, { status: 400 });
  }
  const results = await mapPool(symbols as string[], 4, loadHolding);
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
