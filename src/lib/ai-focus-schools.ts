import { readFileSync } from "fs";
import path from "path";
import type { AiFocusSchoolInfo, AiFocusSchoolsFile } from "@/types/school";

let cached: AiFocusSchoolsFile | null = null;
let cachedAt = 0;

export function getAiFocusSchoolsFile(): AiFocusSchoolsFile {
  if (cached && process.env.NODE_ENV === "production") return cached;
  if (cached && Date.now() - cachedAt < 10_000) return cached;

  const filePath = path.join(process.cwd(), "data", "ai-focus-schools.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as AiFocusSchoolsFile;
  cachedAt = Date.now();
  return cached;
}

export function getAiFocusSchool(schoolId: string): AiFocusSchoolInfo | null {
  return getAiFocusSchoolsFile().schools[schoolId] ?? null;
}
