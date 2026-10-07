import { readFileSync } from "fs";
import path from "path";
import type { PromotionBonusFile, PromotionBonusInfo } from "@/types/school";

let cached: PromotionBonusFile | null = null;
let cachedAt = 0;

export function getPromotionBonusFile(): PromotionBonusFile {
  if (cached && process.env.NODE_ENV === "production") return cached;
  if (cached && Date.now() - cachedAt < 10_000) return cached;

  const filePath = path.join(process.cwd(), "data", "promotion-bonus.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as PromotionBonusFile;
  cachedAt = Date.now();
  return cached;
}

export function getPromotionBonus(schoolId: string): PromotionBonusInfo | null {
  return getPromotionBonusFile().schools[schoolId] ?? null;
}
