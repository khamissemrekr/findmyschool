import { NextRequest, NextResponse } from "next/server";
import { findSchool } from "@/lib/schools";
import { enrichSchoolDetails } from "@/lib/enrich-school";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const school = findSchool(decodeURIComponent(code));
  if (!school) {
    return NextResponse.json({ error: "학교를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const enriched = await enrichSchoolDetails(school);
    return NextResponse.json({ school: enriched });
  } catch {
    return NextResponse.json({ school });
  }
}
