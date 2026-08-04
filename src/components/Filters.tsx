"use client";

import type { CitySummary, Zone } from "@/types/school";

const ZONES: Array<Zone | "전체"> = ["전체", "갑", "을", "병"];

interface Props {
  cities: CitySummary[];
  city: string;
  zone: Zone | "전체";
  onCityChange: (city: string) => void;
  onZoneChange: (zone: Zone | "전체") => void;
}

export function Filters({
  cities,
  city,
  zone,
  onCityChange,
  onZoneChange,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          시·군
        </label>
        <select
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600/30"
        >
          <option value="">시·군 선택</option>
          {cities.map((c) => (
            <option key={c.city} value={c.city}>
              {c.city} ({c.count})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          급지
        </label>
        <select
          value={zone}
          onChange={(e) => onZoneChange(e.target.value as Zone | "전체")}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600/30"
        >
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
