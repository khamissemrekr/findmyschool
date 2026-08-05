"use client";

import { useEffect, useState } from "react";
import type { CutoffEntry } from "@/types/school";

interface Props {
  office: string;
}

const CUTOFF_ZONE_COLOR: Record<string, string> = {
  갑: "#1d4ed8",
  을: "#b45309",
  병: "#be123c",
  수: "#0f766e",
  우: "#7c3aed",
  미: "#334155",
};

function formatEntry(entry: CutoffEntry | undefined): {
  text: string;
  color?: string;
} {
  if (!entry) return { text: "-" };
  if (entry.cutoff) {
    return {
      text: `${entry.cutoff}(${entry.zone ?? ""})`,
      color: CUTOFF_ZONE_COLOR[entry.zone ?? ""] ?? "#0f172a",
    };
  }
  if (entry.status === "특만기" || entry.status === "일반") {
    return { text: `${entry.status}(${entry.rank}희망)` };
  }
  if (entry.status === "전원수용") return { text: "전원 수용" };
  if (entry.status === "신규") return { text: "신규" };
  return { text: "-" };
}

export function CutoffPanel({ office }: Props) {
  const [years, setYears] = useState<number[]>([]);
  const [entries, setEntries] = useState<CutoffEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!office) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setYears([]);
      setEntries([]);
      return;
    }
    setLoading(true);
    fetch(`/api/cutoffs?office=${encodeURIComponent(office)}`)
      .then((r) => r.json())
      .then((d) => {
        setYears(d.years ?? []);
        setEntries(d.entries ?? []);
      })
      .finally(() => setLoading(false));
  }, [office]);

  if (!office) return null;
  if (loading) {
    return (
      <p className="text-xs text-slate-500">커트라인 불러오는 중…</p>
    );
  }
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <p className="mb-1.5 text-xs font-semibold text-slate-700">
        {office} 청간전보 커트라인
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400">
            {years.map((y) => (
              <th key={y} className="pb-1 text-left font-medium">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {years.map((y) => {
              const entry = entries.find((e) => e.year === y);
              const { text, color } = formatEntry(entry);
              return (
                <td
                  key={y}
                  className="py-0.5 pr-2 font-medium"
                  style={color ? { color } : undefined}
                >
                  {text}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
