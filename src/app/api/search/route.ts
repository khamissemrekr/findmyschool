import { NextRequest, NextResponse } from "next/server";
import { kakaoAddressSearch, kakaoKeywordSearch } from "@/lib/kakao";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }
  if (!process.env.KAKAO_REST_KEY) {
    return NextResponse.json(
      {
        error: "KAKAO_REST_KEY가 없습니다.",
        results: [],
      },
      { status: 503 },
    );
  }

  try {
    const [addr, keyword] = await Promise.all([
      kakaoAddressSearch(q).catch(() => []),
      kakaoKeywordSearch(q).catch(() => []),
    ]);
    const merged = [...addr, ...keyword].slice(0, 10);
    return NextResponse.json({ results: merged });
  } catch (e) {
    const message = e instanceof Error ? e.message : "검색 실패";
    return NextResponse.json({ error: message, results: [] }, { status: 500 });
  }
}
