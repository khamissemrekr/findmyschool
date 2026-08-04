import { NextRequest, NextResponse } from "next/server";
import { findSchool } from "@/lib/schools";
import { getRoute } from "@/lib/kakao";
import type { RouteMode, RouteResult } from "@/types/school";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      origin?: { lat: number; lng: number };
      schoolIds?: string[];
      modes?: RouteMode[];
      includeGeometry?: boolean;
    };

    if (!body.origin?.lat || !body.origin?.lng) {
      return NextResponse.json(
        { error: "origin(lat,lng)이 필요합니다." },
        { status: 400 },
      );
    }
    const schoolIds = body.schoolIds ?? [];
    if (schoolIds.length === 0) {
      return NextResponse.json({ error: "schoolIds가 필요합니다." }, { status: 400 });
    }
    if (schoolIds.length > 20) {
      return NextResponse.json(
        { error: "한 번에 최대 20개 학교까지 조회할 수 있습니다." },
        { status: 400 },
      );
    }

    const modes: RouteMode[] = body.modes?.length
      ? body.modes
      : ["car", "transit"];

    if (!process.env.KAKAO_REST_KEY) {
      return NextResponse.json(
        {
          error:
            "KAKAO_REST_KEY가 없습니다. .env.local에 카카오 REST API 키를 설정하세요.",
          routes: [] as RouteResult[],
        },
        { status: 503 },
      );
    }

    const routes: RouteResult[] = [];
    for (const id of schoolIds) {
      const school = findSchool(id);
      if (!school?.lat || !school?.lng) {
        for (const mode of modes) {
          routes.push({
            schoolId: id,
            mode,
            distanceMeters: null,
            durationMs: null,
            error: "학교 좌표가 없습니다.",
          });
        }
        continue;
      }
      for (const mode of modes) {
        const results = await getRoute({
          origin: body.origin,
          dest: { lat: school.lat, lng: school.lng },
          schoolId: id,
          mode,
          includeGeometry: Boolean(body.includeGeometry),
        });
        routes.push(...results);
      }
    }

    return NextResponse.json({ routes });
  } catch (e) {
    const message = e instanceof Error ? e.message : "경로 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
