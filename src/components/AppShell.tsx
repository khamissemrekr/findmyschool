"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KakaoMapView } from "@/components/KakaoMapView";
import { OriginSearch } from "@/components/OriginSearch";
import { Filters } from "@/components/Filters";
import { CutoffPanel } from "@/components/CutoffPanel";
import { ReferencePopup } from "@/components/ReferencePopup";
import { ContactPopup } from "@/components/ContactPopup";
import { UsageGuidePopup } from "@/components/UsageGuidePopup";
import { SchoolList } from "@/components/SchoolList";
import { DetailPanel } from "@/components/DetailPanel";
import type {
  CitySummary,
  Origin,
  RouteMode,
  RouteResult,
  School,
  SchoolListItem,
  TransitPreference,
  Zone,
} from "@/types/school";

type SortKey =
  | "name"
  | "straight"
  | "car"
  | "transit"
  | "classCount"
  | "research"
  | "lead"
  | "newSchool";

const TRANSIT_SEGMENT_COLOR: Record<string, { color: string; dashed?: boolean }> = {
  WALK: { color: "#64748b", dashed: true },
  WALKING: { color: "#64748b", dashed: true },
  BUS: { color: "#0284c7" },
  SUBWAY: { color: "#7c3aed" },
  TRAIN: { color: "#4f46e5" },
};

function routeKey(r: RouteResult): string {
  if (r.mode === "transit" && r.transitPreference) {
    return `${r.schoolId}:transit:${r.transitPreference}`;
  }
  return `${r.schoolId}:${r.mode}`;
}

function fasterTransit(
  bus?: RouteResult | null,
  subway?: RouteResult | null,
): RouteResult | null {
  const candidates = [bus, subway].filter(
    (r): r is RouteResult => r != null && r.durationMs != null,
  );
  if (candidates.length === 0) return bus ?? subway ?? null;
  return candidates.reduce((a, b) =>
    (a.durationMs ?? Infinity) <= (b.durationMs ?? Infinity) ? a : b,
  );
}

export function AppShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [cities, setCities] = useState<CitySummary[]>([]);
  const [schools, setSchools] = useState<SchoolListItem[]>([]);
  const [selected, setSelected] = useState<School | null>(null);
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const [sort, setSort] = useState<SortKey>("straight");
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingSelectedRoute, setLoadingSelectedRoute] = useState(false);
  const [mapRouteMode, setMapRouteMode] = useState<RouteMode>("car");
  const [transitPreference, setTransitPreference] =
    useState<TransitPreference>("subway");
  const [message, setMessage] = useState<string | null>(null);
  const [originLocked, setOriginLocked] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [usageGuideOpen, setUsageGuideOpen] = useState(false);

  // 출발지 고정 상태는 새로고침 후에도 유지
  useEffect(() => {
    try {
      const saved = localStorage.getItem("originLocked");
      if (saved === "1") setOriginLocked(true);
    } catch {
      // ignore
    }
  }, []);

  const onOriginLockedChange = useCallback((locked: boolean) => {
    setOriginLocked(locked);
    try {
      localStorage.setItem("originLocked", locked ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const city = searchParams.get("city") ?? "";
  const zoneParam = searchParams.get("zone");
  const zone: Zone | "전체" =
    zoneParam === "갑" || zoneParam === "을" || zoneParam === "병"
      ? zoneParam
      : "전체";

  const origin: Origin | null = useMemo(() => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const label = searchParams.get("origin") ?? "출발지";
    if (!lat || !lng) return null;
    return { lat: Number(lat), lng: Number(lng), label };
  }, [searchParams]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    fetch("/api/cities")
      .then((r) => r.json())
      .then((d) => setCities(d.cities ?? []));
  }, []);

  useEffect(() => {
    if (!city) {
      setSchools([]);
      return;
    }
    setLoadingSchools(true);
    setRoutes({});
    const params = new URLSearchParams({ city });
    if (zone !== "전체") params.set("zone", zone);
    if (origin) {
      params.set("lat", String(origin.lat));
      params.set("lng", String(origin.lng));
    }
    fetch(`/api/schools?${params}`)
      .then((r) => r.json())
      .then((d) => setSchools(d.schools ?? []))
      .finally(() => setLoadingSchools(false));
  }, [city, zone, origin]);

  const mergedSchools: SchoolListItem[] = useMemo(() => {
    const list = schools.map((s) => {
      const car = routes[`${s.id}:car`] ?? null;
      const transitBus = routes[`${s.id}:transit:bus`] ?? null;
      const transitSubway = routes[`${s.id}:transit:subway`] ?? null;
      return {
        ...s,
        car,
        transitBus,
        transitSubway,
        transit: fasterTransit(transitBus, transitSubway),
      };
    });
    const sorted = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ko");
      if (sort === "classCount") {
        return (
          (b.classCount ?? Number.NEGATIVE_INFINITY) -
          (a.classCount ?? Number.NEGATIVE_INFINITY)
        );
      }
      if (sort === "car") {
        return (
          (a.car?.durationMs ?? Number.POSITIVE_INFINITY) -
          (b.car?.durationMs ?? Number.POSITIVE_INFINITY)
        );
      }
      if (sort === "transit") {
        return (
          (a.transit?.durationMs ?? Number.POSITIVE_INFINITY) -
          (b.transit?.durationMs ?? Number.POSITIVE_INFINITY)
        );
      }
      if (sort === "research") {
        const diff = Number(!!b.researchSchool) - Number(!!a.researchSchool);
        return diff !== 0 ? diff : a.name.localeCompare(b.name, "ko");
      }
      if (sort === "lead") {
        const diff = Number(b.leadSchool) - Number(a.leadSchool);
        return diff !== 0 ? diff : a.name.localeCompare(b.name, "ko");
      }
      if (sort === "newSchool") {
        const diff = Number(!!b.newSchool) - Number(!!a.newSchool);
        if (diff !== 0) return diff;
        const yearDiff = (a.newSchool?.year ?? 0) - (b.newSchool?.year ?? 0);
        return yearDiff !== 0 ? yearDiff : a.name.localeCompare(b.name, "ko");
      }
      return (
        (a.straightDistanceMeters ?? Number.POSITIVE_INFINITY) -
        (b.straightDistanceMeters ?? Number.POSITIVE_INFINITY)
      );
    });
    return sorted;
  }, [schools, routes, sort]);

  const loadRoutes = useCallback(async () => {
    if (!origin) {
      setMessage("먼저 거주지를 지정하세요.");
      return;
    }
    const targets = mergedSchools
      .filter((s) => s.lat != null && s.lng != null)
      .slice(0, 15);
    if (targets.length === 0) {
      setMessage("좌표가 있는 학교가 없습니다.");
      return;
    }
    setLoadingRoutes(true);
    setMessage(
      `가까운 ${targets.length}개 학교의 자동차·대중교통 경로를 조회합니다.`,
    );
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: origin.lat, lng: origin.lng },
          schoolIds: targets.map((s) => s.id),
          modes: ["car", "transit"],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "경로 조회 실패");
        return;
      }
      const next: Record<string, RouteResult> = { ...routes };
      for (const r of data.routes as RouteResult[]) {
        next[routeKey(r)] = r;
      }
      setRoutes(next);
      setMessage(null);
    } catch {
      setMessage("경로 조회 중 오류가 발생했습니다.");
    } finally {
      setLoadingRoutes(false);
    }
  }, [origin, mergedSchools, routes]);

  const onSelectSchool = useCallback(
    async (school: School) => {
      setSelected(school);
      setMapRouteMode("car");
      // 지하철 경로가 있으면 기본으로 지하철 우선 탭
      setTransitPreference(
        routes[`${school.id}:transit:subway`] ? "subway" : "bus",
      );

      // 학교 상세(주소·학급·학생 등)
      try {
        const res = await fetch(
          `/api/schools/${encodeURIComponent(school.id)}`,
        );
        const data = await res.json();
        if (res.ok && data.school) setSelected(data.school);
      } catch {
        // keep basic school
      }

      // 출발지가 있으면 선택 학교 경로(지도용 좌표 + 대중교통 단계) 조회
      if (!origin || school.lat == null || school.lng == null) return;

      const existingCar = routes[`${school.id}:car`];
      const existingBus = routes[`${school.id}:transit:bus`];
      const existingSubway = routes[`${school.id}:transit:subway`];
      const hasAccessWalk = [existingBus, existingSubway].some((r) =>
        r?.steps?.some(
          (s) =>
            (s.type === "WALK" || s.type === "WALKING") &&
            (s.guidance.includes("정류장") || s.guidance.includes("학교까지")),
        ),
      );
      if (
        existingCar?.path?.length &&
        existingCar?.roads?.length &&
        (existingBus?.steps || existingSubway?.steps) &&
        hasAccessWalk
      ) {
        return;
      }

      setLoadingSelectedRoute(true);
      try {
        const res = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: { lat: origin.lat, lng: origin.lng },
            schoolIds: [school.id],
            modes: ["car", "transit"],
            includeGeometry: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error ?? "선택 학교 경로 조회 실패");
          return;
        }
        setRoutes((prev) => {
          const next = { ...prev };
          for (const r of data.routes as RouteResult[]) {
            next[routeKey(r)] = r;
          }
          return next;
        });
        const hasSubway = (data.routes as RouteResult[]).some(
          (r) => r.mode === "transit" && r.transitPreference === "subway",
        );
        setTransitPreference(hasSubway ? "subway" : "bus");
      } catch {
        setMessage("선택 학교 경로 조회 중 오류가 발생했습니다.");
      } finally {
        setLoadingSelectedRoute(false);
      }
    },
    [origin, routes],
  );

  const selectedCar = selected ? routes[`${selected.id}:car`] : undefined;
  const selectedTransitBus = selected
    ? routes[`${selected.id}:transit:bus`]
    : undefined;
  const selectedTransitSubway = selected
    ? routes[`${selected.id}:transit:subway`]
    : undefined;
  const selectedTransit =
    transitPreference === "subway" && selectedTransitSubway
      ? selectedTransitSubway
      : selectedTransitBus ?? selectedTransitSubway;

  const routeSegments = useMemo(() => {
    if (!selected) return null;
    if (mapRouteMode === "car") {
      const path = selectedCar?.path;
      if (!path?.length) return null;
      return [{ path, color: "#047857", weight: 6 }];
    }
    const steps = selectedTransit?.steps;
    if (steps?.some((s) => s.path && s.path.length > 1)) {
      return steps
        .filter((s) => s.path && s.path.length > 1)
        .map((s) => {
          const type = s.type.toUpperCase();
          const style = TRANSIT_SEGMENT_COLOR[type] ?? {
            color: "#0284c7",
          };
          const isWalk = type === "WALK" || type === "WALKING";
          return {
            path: s.path!,
            color: style.color,
            weight: isWalk ? 4 : 6,
            dashed: style.dashed ?? isWalk,
          };
        });
    }
    const path = selectedTransit?.path;
    if (!path?.length) return null;
    return [{ path, color: "#0284c7", weight: 6 }];
  }, [selected, mapRouteMode, selectedCar, selectedTransit]);

  const routePins = useMemo(() => {
    if (mapRouteMode !== "transit" || !selectedTransit?.steps) return null;
    const steps = selectedTransit.steps;
    const firstVehicle = steps.find(
      (s) => s.type !== "WALK" && s.type !== "WALKING" && s.path?.length,
    );
    const lastVehicle = [...steps]
      .reverse()
      .find(
        (s) => s.type !== "WALK" && s.type !== "WALKING" && s.path?.length,
      );
    const pins: { lat: number; lng: number; label: string; kind: "board" | "alight" }[] =
      [];
    if (firstVehicle?.path?.length) {
      const p = firstVehicle.path[0];
      const stop = firstVehicle.stops?.[0];
      pins.push({
        lat: p.lat,
        lng: p.lng,
        label: stop ? `승차 · ${stop}` : "승차",
        kind: "board",
      });
    }
    if (lastVehicle?.path?.length) {
      const p = lastVehicle.path[lastVehicle.path.length - 1];
      const stop =
        lastVehicle.stops && lastVehicle.stops.length > 0
          ? lastVehicle.stops[lastVehicle.stops.length - 1]
          : undefined;
      // 승차·하차가 같은 좌표면 하차만 표시하지 않음(초단거리)
      const board = pins[0];
      if (
        !board ||
        Math.abs(board.lat - p.lat) > 0.00005 ||
        Math.abs(board.lng - p.lng) > 0.00005
      ) {
        pins.push({
          lat: p.lat,
          lng: p.lng,
          label: stop ? `하차 · ${stop}` : "하차",
          kind: "alight",
        });
      }
    }
    return pins.length ? pins : null;
  }, [mapRouteMode, selectedTransit]);

  const onMapClick = useCallback(
    (o: Origin) => {
      if (originLocked) {
        setMessage("출발지가 고정되어 있습니다. 고정을 끄면 지도로 변경할 수 있습니다.");
        return;
      }
      if (origin) {
        const ok = window.confirm(
          `출발지를 변경할까요?\n\n현재: ${origin.label}\n변경: ${o.label}`,
        );
        if (!ok) return;
      }
      updateParams({
        lat: String(o.lat),
        lng: String(o.lng),
        origin: o.label,
      });
    },
    [origin, originLocked, updateParams],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section className="flex w-full shrink-0 flex-col gap-3 border-b border-slate-200 bg-[#f7f4ef] p-4 lg:w-[380px] lg:border-b-0 lg:border-r">
        <header>
          <p className="text-xs font-semibold tracking-wide text-emerald-800">
            FIND MY SCHOOL
          </p>
          <h1 className="font-serif text-2xl text-slate-900">
            초등 전보 도움 지도
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            가고 싶은 지역의 급지, 학교까지의 이동 시간을 한 눈에 확인할 수
            있어요
          </p>
        </header>

        <OriginSearch
          origin={origin}
          locked={originLocked}
          onLockedChange={onOriginLockedChange}
          onSelect={(o) =>
            updateParams({
              lat: String(o.lat),
              lng: String(o.lng),
              origin: o.label,
            })
          }
        />

        <Filters
          cities={cities}
          city={city}
          zone={zone}
          onCityChange={(c) => updateParams({ city: c })}
          onZoneChange={(z) =>
            updateParams({ zone: z === "전체" ? null : z })
          }
        />

        <CutoffPanel office={city} />

        {message && (
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            {message}
          </p>
        )}

        <div className="min-h-[280px] flex-1 lg:min-h-0">
          {loadingSchools ? (
            <p className="text-sm text-slate-500">학교 목록 불러오는 중…</p>
          ) : !city ? (
            <p className="text-sm text-slate-500">
              시·군을 선택하면 학교가 지도와 목록에 표시됩니다.
            </p>
          ) : (
            <SchoolList
              schools={mergedSchools}
              selectedId={selected?.id ?? null}
              sort={sort}
              loadingRoutes={loadingRoutes}
              onSortChange={setSort}
              onSelect={onSelectSchool}
              onLoadRoutes={loadRoutes}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 self-start text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => setReferenceOpen(true)}
            className="underline underline-offset-2 hover:text-slate-600"
          >
            참고자료
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="underline underline-offset-2 hover:text-slate-600"
          >
            문의/오류 제보
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => setUsageGuideOpen(true)}
            className="underline underline-offset-2 hover:text-slate-600"
          >
            사용방법
          </button>
        </div>
      </section>

      {referenceOpen && (
        <ReferencePopup onClose={() => setReferenceOpen(false)} />
      )}
      {contactOpen && <ContactPopup onClose={() => setContactOpen(false)} />}
      {usageGuideOpen && (
        <UsageGuidePopup onClose={() => setUsageGuideOpen(false)} />
      )}

      {selected && (
        <div className="w-full shrink-0 border-b border-slate-200 lg:w-[320px] lg:border-b-0">
          <DetailPanel
            school={selected}
            car={selectedCar}
            transit={selectedTransit}
            transitBus={selectedTransitBus}
            transitSubway={selectedTransitSubway}
            transitPreference={transitPreference}
            onTransitPreferenceChange={setTransitPreference}
            loadingRoute={loadingSelectedRoute}
            mapRouteMode={mapRouteMode}
            onMapRouteModeChange={setMapRouteMode}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      <section className="relative min-h-[45vh] flex-1 bg-slate-200 lg:min-h-0">
        <KakaoMapView
          schools={mergedSchools}
          origin={origin}
          selectedId={selected?.id ?? null}
          routeSegments={routeSegments}
          routePins={routePins}
          onSelect={onSelectSchool}
          onMapClick={onMapClick}
        />
      </section>
    </div>
  );
}
