import { readFileSync } from "fs";
import path from "path";
import type { ResearchSchoolInfo, ResearchSchoolsFile } from "@/types/school";

let cached: ResearchSchoolsFile | null = null;
let cachedAt = 0;

export function getResearchSchoolsFile(): ResearchSchoolsFile {
  if (cached && process.env.NODE_ENV === "production") return cached;
  if (cached && Date.now() - cachedAt < 10_000) return cached;

  const filePath = path.join(process.cwd(), "data", "research-schools.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as ResearchSchoolsFile;
  cachedAt = Date.now();
  return cached;
}

export function getResearchSchool(schoolId: string): ResearchSchoolInfo | null {
  return getResearchSchoolsFile().schools[schoolId] ?? null;
}
