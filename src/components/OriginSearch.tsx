"use client";

import { useEffect, useState } from "react";
import type { Origin } from "@/types/school";

interface Result {
  lat: number;
  lng: number;
  label: string;
}

interface Props {
  origin: Origin | null;
  locked: boolean;
  onLockedChange: (locked: boolean) => void;
  onSelect: (origin: Origin) => void;
}

export function OriginSearch({
  origin,
  locked,
  onLockedChange,
  onSelect,
}: Props) {
  const [q, setQ] = useState(origin?.label ?? "");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (origin?.label && origin.label !== q) {
      setQ(origin.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "검색 실패");
          setResults([]);
        } else {
          setResults(data.results ?? []);
        }
      } catch {
        setError("검색 요청 실패");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-500">
          거주지 / 출발지
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={locked}
          aria-label="출발지 고정"
          onClick={() => onLockedChange(!locked)}
          className="flex items-center gap-1.5 text-xs"
        >
          <span className="text-slate-500">고정</span>
          <span
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
              locked ? "bg-emerald-700" : "bg-slate-300"
            }`}
          >
            <span
              className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition"
              style={{
                transform: locked ? "translateX(18px)" : "translateX(2px)",
              }}
            />
          </span>
          <span
            className={`min-w-[1.75rem] font-semibold ${
              locked ? "text-emerald-800" : "text-slate-400"
            }`}
          >
            {locked ? "ON" : "OFF"}
          </span>
        </button>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          locked
            ? "검색으로만 변경 가능 (지도 클릭 잠금)"
            : "주소 또는 장소 검색 (지도 클릭도 가능)"
        }
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2"
      />
      {loading && (
        <p className="mt-1 text-xs text-slate-400">검색 중…</p>
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={`${r.lat}-${r.lng}-${r.label}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                onClick={() => {
                  onSelect(r);
                  setQ(r.label);
                  setResults([]);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {origin && (
        <p className="mt-1 truncate text-xs text-emerald-700">
          출발지: {origin.label}
          {locked ? " · 고정됨" : ""}
        </p>
      )}
    </div>
  );
}
