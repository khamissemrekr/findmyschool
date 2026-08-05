import { NextRequest, NextResponse } from "next/server";
import { getCutoffsFile, getRegionCutoffs, resolveOffice } from "@/lib/cutoffs";

export async function GET(req: NextRequest) {
  const office = req.nextUrl.searchParams.get("office");
  const file = getCutoffsFile();

  if (!office) {
    return NextResponse.json({ years: file.years, regions: file.regions });
  }

  const resolved = resolveOffice(office);
  const entries = resolved ? getRegionCutoffs(resolved) ?? [] : [];
  return NextResponse.json({
    years: file.years,
    entries,
    office: resolved ?? office,
  });
}
