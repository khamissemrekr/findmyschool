import { readFileSync } from "fs";
import path from "path";
import type { CutoffEntry, CutoffsFile } from "@/types/school";
import { getCities } from "@/lib/schools";

let cached: CutoffsFile | null = null;
let cachedAt = 0;

export function getCutoffsFile(): CutoffsFile {
  if (cached && process.env.NODE_ENV === "production") return cached;
  if (cached && Date.now() - cachedAt < 10_000) return cached;

  const filePath = path.join(process.cwd(), "data", "transfer-cutoffs.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as CutoffsFile;
  cachedAt = Date.now();
  return cached;
}

export function getRegionCutoffs(office: string): CutoffEntry[] | null {
  return getCutoffsFile().regions[office] ?? null;
}

/**
 * Resolves either a 시·군 (city) value or an 인사구역 (office) value to the
 * 인사구역 key used in transfer-cutoffs.json's `regions`. Several cities
 * share a single 인사구역 (e.g. 안양/과천 -> 안양과천), so `city` from
 * School records does not always match `office` directly.
 */
export function resolveOffice(cityOrOffice: string): string | null {
  const file = getCutoffsFile();
  if (file.regions[cityOrOffice]) return cityOrOffice;
  return getCities().find((c) => c.city === cityOrOffice)?.office ?? null;
}
