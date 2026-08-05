"use client";

import { formatDistance, formatDuration } from "@/lib/geo";
import type {
  RouteMode,
  RouteResult,
  School,
  TransitPreference,
} from "@/types/school";

interface Props {
  school: School | null;
  car?: RouteResult | null;
  transit?: RouteResult | null;
  transitBus?: RouteResult | null;
  transitSubway?: RouteResult | null;
  transitPreference: TransitPreference;
  onTransitPreferenceChange: (pref: TransitPreference) => void;
  loadingRoute?: boolean;
  mapRouteMode: RouteMode;
  onMapRouteModeChange: (mode: RouteMode) => void;
  onClose: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  WALK: "도보",
  BUS: "버스",
  SUBWAY: "지하철",
  TRAIN: "열차",
  TRANSFER: "환승",
  WALKING: "도보",
};

function typeBadge(type: string) {
  const key = type.toUpperCase();
  const label = TYPE_LABEL[key] ?? type;
  const colors: Record<string, string> = {
    WALK: "bg-slate-200 text-slate-700",
    WALKING: "bg-slate-200 text-slate-700",
    BUS: "bg-sky-100 text-sky-800",
    SUBWAY: "bg-violet-100 text-violet-800",
    TRAIN: "bg-indigo-100 text-indigo-800",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors[key] ?? "bg-emerald-100 text-emerald-800"}`}
    >
      {label}
    </span>
  );
}

export function DetailPanel({
  school,
  car,
  transit,
  transitBus,
  transitSubway,
  transitPreference,
  onTransitPreferenceChange,
  loadingRoute,
  mapRouteMode,
  onMapRouteModeChange,
  onClose,
}: Props) {
  if (!school) return null;

  const hasTransitPath =
    Boolean(transitBus?.path?.length) || Boolean(transitSubway?.path?.length);

  return (
    <aside className="flex max-h-[50vh] flex-col overflow-hidden border-t border-slate-200 bg-white lg:max-h-none lg:h-full lg:border-r lg:border-t-0">
      <div className="shrink-0 border-b border-slate-100 p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-emerald-700">
              {school.city} · {school.zone}
              {school.subZone ? `/${school.subZone}` : ""} 급지
            </p>
            <h2 className="flex flex-wrap items-center gap-1.5 text-lg font-semibold text-slate-900">
              {school.name}
              {school.researchSchool && (
                <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold bg-violet-100 text-violet-800">
                  연구학교
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            닫기
          </button>
        </div>

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">주소</dt>
            <dd className="text-slate-800">{school.address ?? "정보 없음"}</dd>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <dt className="text-xs text-slate-500">학급 수</dt>
              <dd>
                {school.classCount ?? "—"}
                {school.specialClassCount != null && school.specialClassCount > 0
                  ? ` (특수 ${school.specialClassCount})`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">학생 수</dt>
              <dd>{school.studentCount ?? "—"}</dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-slate-500">교원 현황</dt>
            <dd className="mt-1">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-800">
                <span>교장 {school.principalCount ?? "—"}</span>
                <span>교감 {school.vicePrincipalCount ?? "—"}</span>
                <span>부장 {school.deptHeadCount ?? "—"}</span>
                <span>교사 {school.teacherCount ?? "—"}</span>
              </div>
              {school.staffCount != null && (
                <p className="mt-1 text-[11px] text-slate-500">
                  교원수 합계 {school.staffCount}명
                </p>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">홈페이지</dt>
            <dd>
              {school.homepage ? (
                <a
                  href={school.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-emerald-700 underline"
                >
                  {school.homepage}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">전화</dt>
            <dd>{school.tel ?? "—"}</dd>
          </div>
          {school.researchSchool && (
            <div className="rounded-lg bg-violet-50 p-2.5">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-violet-800">
                <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold bg-violet-100 text-violet-800">
                  연구학교
                </span>
                {school.researchSchool.source} · {school.researchSchool.kind}
              </dt>
              <dd className="mt-1.5 space-y-1 text-slate-800">
                <p>{school.researchSchool.task}</p>
                <p className="text-[11px] text-slate-500">
                  운영 기간 {school.researchSchool.period}
                </p>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="mb-2 text-xs font-medium text-slate-500">
            이동 정보 · 지도에 표시할 경로
          </p>
          {loadingRoute && (
            <p className="mb-2 text-xs text-slate-400">경로 불러오는 중…</p>
          )}

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onMapRouteModeChange("car")}
              disabled={!car?.path?.length && !loadingRoute}
              className={`rounded-lg border px-2 py-2 text-left transition ${
                mapRouteMode === "car"
                  ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                  : "border-slate-200 bg-white hover:border-slate-300"
              } disabled:opacity-40`}
            >
              <p className="text-[11px] font-semibold text-emerald-800">자동차</p>
              <p className="text-xs text-slate-700">
                {formatDuration(car?.durationMs)} /{" "}
                {formatDistance(car?.distanceMeters)}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onMapRouteModeChange("transit")}
              disabled={!hasTransitPath && !loadingRoute}
              className={`rounded-lg border px-2 py-2 text-left transition ${
                mapRouteMode === "transit"
                  ? "border-sky-600 bg-sky-50 ring-1 ring-sky-600"
                  : "border-slate-200 bg-white hover:border-slate-300"
              } disabled:opacity-40`}
            >
              <p className="text-[11px] font-semibold text-sky-800">대중교통</p>
              <p className="text-xs text-slate-700">
                {formatDuration(transit?.durationMs)} /{" "}
                {formatDistance(transit?.distanceMeters)}
              </p>
            </button>
          </div>

          {mapRouteMode === "transit" && (
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={!transitBus}
                onClick={() => onTransitPreferenceChange("bus")}
                className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition disabled:opacity-40 ${
                  transitPreference === "bus"
                    ? "border-sky-600 bg-sky-100 font-semibold text-sky-900"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                버스
                <span className="mt-0.5 block font-normal text-slate-500">
                  {formatDuration(transitBus?.durationMs)}
                </span>
              </button>
              <button
                type="button"
                disabled={!transitSubway}
                onClick={() => onTransitPreferenceChange("subway")}
                className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition disabled:opacity-40 ${
                  transitPreference === "subway"
                    ? "border-violet-600 bg-violet-100 font-semibold text-violet-900"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                지하철 우선
                <span className="mt-0.5 block font-normal text-slate-500">
                  {transitSubway
                    ? formatDuration(transitSubway.durationMs)
                    : "경로 없음"}
                </span>
              </button>
            </div>
          )}

          {mapRouteMode === "transit" && (
            <p className="text-[11px] text-slate-500">
              {transit?.fare != null
                ? `요금 ${transit.fare.toLocaleString()}원`
                : ""}
              {transit?.transfers != null
                ? `${transit.fare != null ? " · " : ""}환승 ${transit.transfers}회`
                : ""}
              {transit?.path?.length
                ? " · 지도에 대중교통 경로 표시"
                : ""}
            </p>
          )}
          {mapRouteMode === "car" && car?.path?.length ? (
            <p className="text-[11px] text-emerald-700">
              지도에 자동차 경로가 표시됩니다.
            </p>
          ) : null}

          {(car?.error || transit?.error) && (
            <p className="mt-2 text-xs text-rose-600">
              {car?.error || transit?.error}
            </p>
          )}
        </div>

        {mapRouteMode === "car" && car?.roads && car.roads.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">
              자동차 주요 도로
            </p>
            <ol className="space-y-1.5">
              {car.roads.map((road, idx) => (
                <li
                  key={`${idx}-${road.name}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-slate-800">
                    <span className="mr-1.5 text-[11px] font-normal text-slate-400">
                      {idx + 1}.
                    </span>
                    {road.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {formatDuration(road.durationMs)} ·{" "}
                    {formatDistance(road.distanceMeters)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {mapRouteMode === "transit" &&
          transit?.steps &&
          transit.steps.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">
              대중교통 경로 상세
            </p>
            <ol className="space-y-2">
              {transit.steps.map((step, idx) => (
                <li
                  key={`${idx}-${step.guidance}`}
                  className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm"
                >
                  <div className="mb-1 flex items-center gap-2">
                    {typeBadge(step.type)}
                    <span className="text-[11px] text-slate-400">
                      {formatDuration(step.durationMs)} ·{" "}
                      {formatDistance(step.distanceMeters)}
                    </span>
                  </div>
                  <p className="text-slate-800">{step.guidance || "이동"}</p>
                  {step.vehicleNames && step.vehicleNames.length > 0 && (
                    <p className="mt-1 text-xs text-sky-700">
                      {step.vehicleNames.join(", ")}
                    </p>
                  )}
                  {step.stops && step.stops.length > 1 && (
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {step.stops[0]} → {step.stops[step.stops.length - 1]}
                      {step.stops.length > 2
                        ? ` (정류 ${step.stops.length}개)`
                        : ""}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </aside>
  );
}
