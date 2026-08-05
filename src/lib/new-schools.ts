import { readFileSync } from "fs";
import path from "path";
import type { NewSchoolInfo, NewSchoolsFile } from "@/types/school";

let cached: NewSchoolsFile | null = null;
let cachedAt = 0;

export function getNewSchoolsFile(): NewSchoolsFile {
  if (cached && process.env.NODE_ENV === "production") return cached;
  if (cached && Date.now() - cachedAt < 10_000) return cached;

  const filePath = path.join(process.cwd(), "data", "new-schools.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as NewSchoolsFile;
  cachedAt = Date.now();
  return cached;
}

export function getNewSchool(schoolId: string): NewSchoolInfo | null {
  return getNewSchoolsFile().schools[schoolId] ?? null;
}
