import { readFileSync } from "fs";
import path from "path";
import type { SchoolInfoLinksFile } from "@/types/school";

let cached: SchoolInfoLinksFile | null = null;
let cachedAt = 0;

export function getSchoolInfoLinksFile(): SchoolInfoLinksFile {
  if (cached && process.env.NODE_ENV === "production") return cached;
  if (cached && Date.now() - cachedAt < 10_000) return cached;

  const filePath = path.join(process.cwd(), "data", "schoolinfo-links.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as SchoolInfoLinksFile;
  cachedAt = Date.now();
  return cached;
}

/** 학교알리미(schoolinfo.go.kr) 학교별 상세 페이지 URL (없으면 null) */
export function getSchoolInfoUrl(schoolId: string): string | null {
  const shlIdfCd = getSchoolInfoLinksFile().links[schoolId];
  if (!shlIdfCd) return null;
  return `https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=${shlIdfCd}`;
}
