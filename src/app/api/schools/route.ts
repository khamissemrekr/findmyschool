import { NextRequest, NextResponse } from "next/server";
import { filterSchools } from "@/lib/schools";
import { haversineMeters } from "@/lib/geo";
import { enrichSchoolsForCity } from "@/lib/enrich-school";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? undefined;
  const zone = req.nextUrl.searchParams.get("zone") ?? undefined;
  const olat = req.nextUrl.searchParams.get("lat");
  const olng = req.nextUrl.searchParams.get("lng");

  let schools = filterSchools({ city, zone });

  // 시·군이 지정되면 학교알리미로 학급수·학생수 일괄 보강
  if (city) {
    schools = await enrichSchoolsForCity(schools);
  }

  if (olat && olng) {
    const lat = Number(olat);
    const lng = Number(olng);
    schools = schools
      .map((s) => ({
        ...s,
        straightDistanceMeters:
          s.lat != null && s.lng != null
            ? haversineMeters(lat, lng, s.lat, s.lng)
            : null,
      }))
      .sort((a, b) => {
        const da = a.straightDistanceMeters ?? Number.POSITIVE_INFINITY;
        const db = b.straightDistanceMeters ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
  } else {
    schools = [...schools].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  return NextResponse.json({ schools });
}
