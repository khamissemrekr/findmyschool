import { readFileSync } from "fs";
import path from "path";
import type { LeadSchoolsFile } from "@/types/school";

let cached: LeadSchoolsFile | null = null;
let cachedIds: Set<string> | null = null;
let cachedAt = 0;

export function getLeadSchoolsFile(): LeadSchoolsFile {
  if (cached && process.env.NODE_ENV === "production") return cached;
  if (cached && Date.now() - cachedAt < 10_000) return cached;

  const filePath = path.join(process.cwd(), "data", "lead-schools.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as LeadSchoolsFile;
  cachedIds = new Set(cached.schoolIds);
  cachedAt = Date.now();
  return cached;
}

export function isLeadSchool(schoolId: string): boolean {
  getLeadSchoolsFile();
  return cachedIds?.has(schoolId) ?? false;
}
