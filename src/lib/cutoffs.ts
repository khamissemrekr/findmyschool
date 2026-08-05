import { readFileSync } from "fs";
import path from "path";
import type { CutoffEntry, CutoffsFile } from "@/types/school";

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
