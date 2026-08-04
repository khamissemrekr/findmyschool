import { cacheGet, cacheSet } from "@/lib/cache";
import type {
  CarRoadSegment,
  LatLngPoint,
  RouteMode,
  RouteResult,
  TransitPreference,
  TransitStep,
} from "@/types/school";
import { haversineMeters } from "@/lib/geo";

const ROUTE_TTL = 1000 * 60 * 30; // 30 min

function restKey(): string {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) throw new Error("KAKAO_REST_KEY가 설정되지 않았습니다.");
  return key;
}

export async function kakaoAddressSearch(query: string): Promise<
  { lat: number; lng: number; label: string }[]
> {
  const key = restKey();
  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`주소 검색 실패 (${res.status})`);
  const data = (await res.json()) as {
    documents: { address_name: string; y: string; x: string }[];
  };
  return data.documents.map((d) => ({
    lat: Number(d.y),
    lng: Number(d.x),
    label: d.address_name,
  }));
}

export async function kakaoKeywordSearch(query: string): Promise<
  { lat: number; lng: number; label: string }[]
> {
  const key = restKey();
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "10");
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`장소 검색 실패 (${res.status})`);
  const data = (await res.json()) as {
    documents: {
      place_name: string;
      address_name: string;
      y: string;
      x: string;
    }[];
  };
  return data.documents.map((d) => ({
    lat: Number(d.y),
    lng: Number(d.x),
    label: `${d.place_name} (${d.address_name})`,
  }));
}

/** Kakao Mobility vertexes: [lng, lat, lng, lat, ...] */
function pathFromVertexes(vertexes: number[]): LatLngPoint[] {
  const path: LatLngPoint[] = [];
  for (let i = 0; i + 1 < vertexes.length; i += 2) {
    path.push({ lng: vertexes[i], lat: vertexes[i + 1] });
  }
  return path;
}

/** Kakao Map points: [[lng, lat], ...] */
function pathFromPoints(points: number[][]): LatLngPoint[] {
  return points.map(([lng, lat]) => ({ lng, lat }));
}

/** 연속 동일 도로명 병합 후, 이름 있는 주요 구간만 남김 */
function mergeCarRoads(
  roads: { name?: string; distance?: number; duration?: number }[],
): CarRoadSegment[] {
  const merged: CarRoadSegment[] = [];
  for (const road of roads) {
    const name = (road.name ?? "").trim();
    const distanceMeters = road.distance ?? 0;
    const durationMs = (road.duration ?? 0) * 1000;
    if (!name) continue;
    const last = merged[merged.length - 1];
    if (last && last.name === name) {
      last.distanceMeters += distanceMeters;
      last.durationMs += durationMs;
    } else {
      merged.push({ name, distanceMeters, durationMs });
    }
  }
  // 짧은 이면도로(300m 미만)는 목록에서 생략 — 주요 도로 위주
  return merged.filter((r) => r.distanceMeters >= 300);
}

async function carRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  schoolId: string,
  includeGeometry: boolean,
): Promise<RouteResult> {
  const key = restKey();
  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.searchParams.set("origin", `${origin.lng},${origin.lat}`);
  url.searchParams.set("destination", `${dest.lng},${dest.lat}`);
  // summary=false 일 때 sections/roads/vertexes 포함
  url.searchParams.set("summary", includeGeometry ? "false" : "true");
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${key}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      schoolId,
      mode: "car",
      distanceMeters: null,
      durationMs: null,
      error: `자동차 경로 오류 (${res.status}): ${text.slice(0, 120)}`,
    };
  }
  const data = (await res.json()) as {
    routes?: {
      result_code?: number;
      summary?: { distance: number; duration: number };
      sections?: {
        roads?: {
          name?: string;
          distance?: number;
          duration?: number;
          vertexes?: number[];
        }[];
      }[];
    }[];
  };
  const route = data.routes?.[0];
  if (!route?.summary) {
    return {
      schoolId,
      mode: "car",
      distanceMeters: null,
      durationMs: null,
      error: "자동차 경로를 찾지 못했습니다.",
    };
  }

  let path: LatLngPoint[] | undefined;
  let roads: CarRoadSegment[] | undefined;
  if (includeGeometry && route.sections) {
    const all: LatLngPoint[] = [];
    const rawRoads: {
      name?: string;
      distance?: number;
      duration?: number;
    }[] = [];
    for (const section of route.sections) {
      for (const road of section.roads ?? []) {
        rawRoads.push(road);
        if (road.vertexes?.length) {
          all.push(...pathFromVertexes(road.vertexes));
        }
      }
    }
    if (all.length) path = all;
    const merged = mergeCarRoads(rawRoads);
    if (merged.length) roads = merged;
  }

  return {
    schoolId,
    mode: "car",
    distanceMeters: route.summary.distance,
    durationMs: route.summary.duration * 1000,
    path,
    roads,
  };
}

type KakaoTransitRaw = {
  distance?: number;
  duration?: number;
  properties?: {
    totalDistance?: number;
    totalTime?: number;
    transfers?: number;
    fare?: { value?: number };
    type?: string;
  };
  steps?: {
    properties?: {
      guidance?: string;
      type?: string;
      distance?: number;
      time?: number;
      stops?: { name?: string }[];
      vehicles?: { name?: string; type?: string }[];
    };
    path?: { points?: number[][] };
  }[];
};

function routeHasSubway(route: KakaoTransitRaw): boolean {
  const t = route.properties?.type ?? "";
  if (t === "SUBWAY" || t === "BUS_AND_SUBWAY") return true;
  return (route.steps ?? []).some(
    (s) => (s.properties?.type ?? "").toUpperCase() === "SUBWAY",
  );
}

function routeDurationSec(route: KakaoTransitRaw): number {
  return (
    route.properties?.totalTime ??
    route.duration ??
    Number.POSITIVE_INFINITY
  );
}

function normalizeTransitType(type: string | undefined): string {
  const t = (type ?? "WALK").toUpperCase();
  if (t === "WALKING") return "WALK";
  return t;
}

/** 출발지↔정류장 도보 경로 (OSRM foot, 실패 시 직선) */
async function fetchFootPath(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<{
  path: LatLngPoint[];
  distanceMeters: number;
  durationMs: number;
} | null> {
  const straight = haversineMeters(from.lat, from.lng, to.lat, to.lng);
  if (straight < 35) return null;

  const cacheKey = `foot:${from.lat.toFixed(5)},${from.lng.toFixed(5)}:${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  const cached = cacheGet<{
    path: LatLngPoint[];
    distanceMeters: number;
    durationMs: number;
  }>(cacheKey);
  if (cached) return cached;

  const straightFallback = {
    path: [
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng },
    ],
    distanceMeters: Math.round(straight),
    // 보행 4km/h ≈ 1.11 m/s
    durationMs: Math.round((straight / 1.11) * 1000),
  };

  try {
    const url =
      `https://router.project-osrm.org/route/v1/foot/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      cacheSet(cacheKey, straightFallback, ROUTE_TTL);
      return straightFallback;
    }
    const data = (await res.json()) as {
      code?: string;
      routes?: {
        distance: number;
        duration: number;
        geometry?: { coordinates?: number[][] };
      }[];
    };
    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (data.code !== "Ok" || !route || !coords?.length) {
      cacheSet(cacheKey, straightFallback, ROUTE_TTL);
      return straightFallback;
    }
    // OSRM이 과도하게 우회하면 직선으로 대체
    if (route.distance > straight * 3.5 && straight < 900) {
      cacheSet(cacheKey, straightFallback, ROUTE_TTL);
      return straightFallback;
    }
    const path: LatLngPoint[] = coords.map(([lng, lat]) => ({ lat, lng }));
    const result = {
      path,
      distanceMeters: Math.round(route.distance),
      durationMs: Math.round(route.duration * 1000),
    };
    cacheSet(cacheKey, result, ROUTE_TTL);
    return result;
  } catch {
    cacheSet(cacheKey, straightFallback, ROUTE_TTL);
    return straightFallback;
  }
}

async function enrichFirstLastWalks(
  result: RouteResult,
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<RouteResult> {
  if (!result.steps?.length) return result;

  const steps = [...result.steps];
  const firstVehicle = steps.find((s) => s.type !== "WALK" && s.path?.length);
  const lastVehicle = [...steps]
    .reverse()
    .find((s) => s.type !== "WALK" && s.path?.length);

  const board = firstVehicle?.path?.[0];
  const alight = lastVehicle?.path?.[lastVehicle.path.length - 1];
  const boardName = firstVehicle?.stops?.[0];
  const alightName =
    lastVehicle?.stops && lastVehicle.stops.length > 0
      ? lastVehicle.stops[lastVehicle.stops.length - 1]
      : undefined;

  // 이미 첫 구간이 도보면 출발지 연결은 생략
  if (board && steps[0]?.type !== "WALK") {
    const foot = await fetchFootPath(origin, board);
    if (foot) {
      steps.unshift({
        type: "WALK",
        guidance: boardName
          ? `${boardName} 정류장까지 도보`
          : "정류장까지 도보",
        distanceMeters: foot.distanceMeters,
        durationMs: foot.durationMs,
        path: foot.path,
      });
    }
  }

  if (alight && steps[steps.length - 1]?.type !== "WALK") {
    const foot = await fetchFootPath(alight, dest);
    if (foot) {
      steps.push({
        type: "WALK",
        guidance: "학교까지 도보",
        distanceMeters: foot.distanceMeters,
        durationMs: foot.durationMs,
        path: foot.path,
      });
    }
  }

  const allPath = steps.flatMap((s) => s.path ?? []);
  return {
    ...result,
    steps,
    path: allPath.length ? allPath : result.path,
  };
}

function parseTransitRoute(
  route: KakaoTransitRaw,
  schoolId: string,
  preference: TransitPreference,
  includeGeometry: boolean,
): RouteResult {
  const distance =
    route.properties?.totalDistance ?? route.distance ?? null;
  const durationSec =
    route.properties?.totalTime ?? route.duration ?? null;

  let path: LatLngPoint[] | undefined;
  let steps: TransitStep[] | undefined;

  if (includeGeometry && route.steps?.length) {
    const allPath: LatLngPoint[] = [];
    steps = route.steps.map((step) => {
      const props = step.properties ?? {};
      const stepPath = step.path?.points?.length
        ? pathFromPoints(step.path.points)
        : undefined;
      if (stepPath?.length) {
        allPath.push(...stepPath);
      }
      return {
        type: normalizeTransitType(props.type),
        guidance: props.guidance ?? "",
        distanceMeters: props.distance ?? null,
        durationMs: props.time != null ? props.time * 1000 : null,
        vehicleNames: props.vehicles
          ?.map((v) =>
            `${v.type ? `${v.type} ` : ""}${v.name ?? ""}`.trim(),
          )
          .filter(Boolean) as string[] | undefined,
        stops: props.stops
          ?.map((s) => s.name)
          .filter((n): n is string => Boolean(n)),
        path: stepPath,
      };
    });
    if (allPath.length) path = allPath;
  }

  return {
    schoolId,
    mode: "transit",
    transitPreference: preference,
    distanceMeters: distance,
    durationMs: durationSec != null ? durationSec * 1000 : null,
    path,
    steps,
    fare: route.properties?.fare?.value ?? null,
    transfers: route.properties?.transfers ?? null,
  };
}

function pickFastest(routes: KakaoTransitRaw[]): KakaoTransitRaw | undefined {
  if (!routes.length) return undefined;
  return routes.reduce((best, cur) =>
    routeDurationSec(cur) < routeDurationSec(best) ? cur : best,
  );
}

async function transitRoutes(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  schoolId: string,
  includeGeometry: boolean,
): Promise<RouteResult[]> {
  const key = restKey();
  const url = new URL("https://dapi.kakao.com/v2/routing/publictraffic");
  url.searchParams.set("start_x", String(origin.lng));
  url.searchParams.set("start_y", String(origin.lat));
  url.searchParams.set("end_x", String(dest.lng));
  url.searchParams.set("end_y", String(dest.lat));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) {
    const text = await res.text();
    return [
      {
        schoolId,
        mode: "transit",
        transitPreference: "bus",
        distanceMeters: null,
        durationMs: null,
        error: `대중교통 경로 오류 (${res.status}): ${text.slice(0, 120)}`,
      },
    ];
  }
  const data = (await res.json()) as {
    status?: string;
    message?: string;
    routes?: KakaoTransitRaw[];
  };
  if (data.status && data.status !== "OK") {
    return [
      {
        schoolId,
        mode: "transit",
        transitPreference: "bus",
        distanceMeters: null,
        durationMs: null,
        error: data.message ?? `대중교통 경로 상태: ${data.status}`,
      },
    ];
  }
  const all = data.routes ?? [];
  if (!all.length) {
    return [
      {
        schoolId,
        mode: "transit",
        transitPreference: "bus",
        distanceMeters: null,
        durationMs: null,
        error: "대중교통 경로를 찾지 못했습니다.",
      },
    ];
  }

  const withSubway = all.filter(routeHasSubway);
  const busOnly = all.filter((r) => !routeHasSubway(r));

  // 버스 위주: 버스만 있는 경로 중 최단, 없으면 전체 최단
  const busRaw = pickFastest(busOnly) ?? pickFastest(all);
  // 지하철 우선: 지하철 포함 경로 중 최단
  const subwayRaw = pickFastest(withSubway);

  const results: RouteResult[] = [];
  if (busRaw) {
    results.push(
      parseTransitRoute(busRaw, schoolId, "bus", includeGeometry),
    );
  }
  if (subwayRaw) {
    results.push(
      parseTransitRoute(subwayRaw, schoolId, "subway", includeGeometry),
    );
  }

  if (!includeGeometry) return results;

  // 카카오 응답에 없는 출발지→정류장 / 하차→학교 도보 구간 보완
  return Promise.all(
    results.map((r) => enrichFirstLastWalks(r, origin, dest)),
  );
}

export async function getRoute(opts: {
  origin: { lat: number; lng: number };
  dest: { lat: number; lng: number };
  schoolId: string;
  mode: RouteMode;
  includeGeometry?: boolean;
}): Promise<RouteResult[]> {
  const includeGeometry = Boolean(opts.includeGeometry);
  const key = [
    opts.mode,
    includeGeometry ? "geo-v4" : "sum-v3",
    opts.origin.lat.toFixed(5),
    opts.origin.lng.toFixed(5),
    opts.dest.lat.toFixed(5),
    opts.dest.lng.toFixed(5),
  ].join(":");
  const cached = cacheGet<RouteResult[]>(key);
  if (cached) {
    return cached.map((r) => ({ ...r, schoolId: opts.schoolId }));
  }

  const results =
    opts.mode === "car"
      ? [
          await carRoute(
            opts.origin,
            opts.dest,
            opts.schoolId,
            includeGeometry,
          ),
        ]
      : await transitRoutes(
          opts.origin,
          opts.dest,
          opts.schoolId,
          includeGeometry,
        );

  if (results.some((r) => !r.error)) cacheSet(key, results, ROUTE_TTL);
  return results;
}
