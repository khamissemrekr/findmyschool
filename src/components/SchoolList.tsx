"use client";

import { formatDistance, formatDuration } from "@/lib/geo";
import type { SchoolListItem } from "@/types/school";

type SortKey = "name" | "straight" | "car" | "transit" | "classCount";

interface Props {
  schools: SchoolListItem[];
  selectedId: string | null;
  sort: SortKey;
  loadingRoutes: boolean;
  onSortChange: (sort: SortKey) => void;
  onSelect: (school: SchoolListItem) => void;
  onLoadRoutes: () => void;
}

function zoneBadge(zone: string, subZone?: string) {
  const colors: Record<string, string> = {
    갑: "bg-blue-100 text-blue-800",
    을: "bg-amber-100 text-amber-900",
    병: "bg-rose-100 text-rose-800",
  };
  const label = subZone ? `${zone}/${subZone}` : zone;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${colors[zone] ?? "bg-slate-100 text-slate-700"}`}
    >
      {label}
    </span>
  );
}

export function SchoolList({
  schools,
  selectedId,
  sort,
  loadingRoutes,
  onSortChange,
  onSelect,
  onLoadRoutes,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{schools.length}개 학교</p>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            <option value="straight">직선거리</option>
            <option value="car">자동차</option>
            <option value="transit">대중교통</option>
            <option value="classCount">학급수</option>
            <option value="name">학교명순</option>
          </select>
          <button
            type="button"
            onClick={onLoadRoutes}
            disabled={loadingRoutes || schools.length === 0}
            className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            {loadingRoutes ? "조회 중…" : "경로 조회"}
          </button>
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {schools.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                selectedId === s.id
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {zoneBadge(s.zone, s.subZone)}
                    <span className="text-sm font-medium text-slate-900">
                      {s.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {[
                        s.classCount != null || s.studentCount != null
                          ? `${s.classCount ?? "—"}학급${
                              s.specialClassCount != null &&
                              s.specialClassCount > 0
                                ? `(특수${s.specialClassCount})`
                                : ""
                            } / ${s.studentCount != null ? s.studentCount.toLocaleString() : "—"}명`
                          : null,
                        s.staffCount != null ? `교원 ${s.staffCount}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    직선 {formatDistance(s.straightDistanceMeters)}
                    {s.lat == null ? " · 좌표 없음" : ""}
                  </p>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                <span>
                  자동차 {formatDuration(s.car?.durationMs)} /{" "}
                  {formatDistance(s.car?.distanceMeters)}
                </span>
                <span>
                  {s.transitBus || s.transitSubway ? (
                    <>
                      {s.transitBus
                        ? `버스 ${formatDuration(s.transitBus.durationMs)}`
                        : null}
                      {s.transitBus && s.transitSubway ? " · " : null}
                      {s.transitSubway
                        ? `지하철 ${formatDuration(s.transitSubway.durationMs)}`
                        : null}
                    </>
                  ) : (
                    <>
                      대중교통 {formatDuration(s.transit?.durationMs)} /{" "}
                      {formatDistance(s.transit?.distanceMeters)}
                    </>
                  )}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
