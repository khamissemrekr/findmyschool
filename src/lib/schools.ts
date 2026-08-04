import { readFileSync } from "fs";
import path from "path";
import type { CitySummary, School, SchoolsFile } from "@/types/school";

let cached: SchoolsFile | null = null;
let cachedAt = 0;

export function getSchoolsFile(): SchoolsFile {
  // production: 프로세스 수명 동안 캐시 / development: 10초마다 재로딩
  if (cached && process.env.NODE_ENV === "production") return cached;
  if (cached && Date.now() - cachedAt < 10_000) return cached;

  const filePath = path.join(process.cwd(), "data", "schools.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as SchoolsFile;
  cachedAt = Date.now();
  return cached;
}

function withStaffDefaults(school: School): School {
  return {
    ...school,
    specialClassCount: school.specialClassCount ?? null,
    principalCount: school.principalCount ?? null,
    vicePrincipalCount: school.vicePrincipalCount ?? null,
    deptHeadCount: school.deptHeadCount ?? null,
    teacherCount: school.teacherCount ?? null,
    staffCount: school.staffCount ?? null,
  };
}

export function getAllSchools(): School[] {
  return getSchoolsFile().schools.map(withStaffDefaults);
}

export function getCities(): CitySummary[] {
  const map = new Map<string, CitySummary>();
  for (const s of getAllSchools()) {
    const cur = map.get(s.city) ?? {
      city: s.city,
      office: s.office,
      count: 0,
      withCoords: 0,
    };
    cur.count += 1;
    if (s.lat != null && s.lng != null) cur.withCoords += 1;
    map.set(s.city, cur);
  }
  return [...map.values()].sort((a, b) => a.city.localeCompare(b.city, "ko"));
}

export function findSchool(id: string): School | undefined {
  return getAllSchools().find((s) => s.id === id || s.schoolCode === id);
}

export function filterSchools(opts: {
  city?: string;
  zone?: string;
}): School[] {
  return getAllSchools().filter((s) => {
    if (opts.city && s.city !== opts.city) return false;
    if (opts.zone && s.zone !== opts.zone) return false;
    return true;
  });
}
