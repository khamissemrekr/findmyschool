import { cacheGet, cacheSet } from "@/lib/cache";
import { GYEONGGI_SGG } from "@/lib/gyeonggi-sgg";
import type { School } from "@/types/school";

/** 학교현황(학급·학생) apiType=09 — COL_C7 = 특수학급 */
type SchoolInfoStatsRow = {
  SCHUL_NM?: string;
  COL_C_SUM?: number | string;
  COL_C7?: number | string;
  COL_S_SUM?: number | string;
  TEACH_CNT?: number | string;
};

/**
 * 직위별 교원 현황 apiType=22
 * COL_1 교장, COL_2 교감, COL_3 보직교사(부장), COL_4 일반교사
 */
type SchoolInfoStaffRow = {
  SCHUL_NM?: string;
  COL_1?: number | string;
  COL_2?: number | string;
  COL_3?: number | string;
  COL_4?: number | string;
};

type StaffBreakdown = {
  principalCount: number | null;
  vicePrincipalCount: number | null;
  deptHeadCount: number | null;
  teacherCount: number | null;
  staffCount: number | null;
};

function normalizeSchoolName(name: string): string {
  return name.replace(/\s+/g, "").replace(/초등학교$/g, "").replace(/분교장$/g, "");
}

function toFiniteInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseStaffRow(row: SchoolInfoStaffRow | undefined): StaffBreakdown {
  if (!row) {
    return {
      principalCount: null,
      vicePrincipalCount: null,
      deptHeadCount: null,
      teacherCount: null,
      staffCount: null,
    };
  }
  const principalCount = toFiniteInt(row.COL_1);
  const vicePrincipalCount = toFiniteInt(row.COL_2);
  const deptHeadCount = toFiniteInt(row.COL_3);
  const teacherCount = toFiniteInt(row.COL_4);
  const parts = [
    principalCount,
    vicePrincipalCount,
    deptHeadCount,
    teacherCount,
  ];
  const staffCount = parts.every((p) => p != null)
    ? (parts as number[]).reduce((a, b) => a + b, 0)
    : null;

  return {
    principalCount,
    vicePrincipalCount,
    deptHeadCount,
    teacherCount,
    staffCount,
  };
}

async function fetchNeisClassCount(schoolCode: string): Promise<number | null> {
  const key = process.env.NEIS_API_KEY;
  if (!key) return null;
  const cacheKey = `neis-class:${schoolCode}`;
  const cached = cacheGet<number>(cacheKey);
  if (cached != null) return cached;

  const url = new URL("https://open.neis.go.kr/hub/classInfo");
  url.searchParams.set("Type", "json");
  url.searchParams.set("KEY", key);
  url.searchParams.set("ATPT_OFCDC_SC_CODE", "J10");
  url.searchParams.set("SD_SCHUL_CODE", schoolCode);
  url.searchParams.set("pSize", "100");
  url.searchParams.set("pIndex", "1");

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    classInfo?: [{ head: unknown }, { row: { AY: string }[] }];
  };
  const rows = data.classInfo?.[1]?.row;
  if (!rows?.length) return null;
  const latest = rows.reduce((max, r) => (r.AY > max ? r.AY : max), rows[0].AY);
  const count = rows.filter((r) => r.AY === latest).length;
  cacheSet(cacheKey, count, 1000 * 60 * 60 * 12);
  return count;
}

async function fetchOneSggList<T extends { SCHUL_NM?: string }>(
  apiKey: string,
  apiType: string,
  sggCode: string,
  year: string,
): Promise<T[]> {
  const url = new URL("https://www.schoolinfo.go.kr/openApi.do");
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("apiType", apiType);
  url.searchParams.set("sidoCode", "41");
  url.searchParams.set("sggCode", sggCode);
  url.searchParams.set("schulKndCode", "02");
  url.searchParams.set("pbanYr", year);

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    resultCode?: string;
    list?: T[];
  };
  if (data.resultCode === "success" && data.list?.length) return data.list;

  // 당해 공시 없으면 전년 시도
  url.searchParams.set("pbanYr", String(Number(year) - 1));
  const res2 = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res2.ok) return [];
  const data2 = (await res2.json()) as {
    resultCode?: string;
    list?: T[];
  };
  if (data2.resultCode === "success" && data2.list?.length) return data2.list;
  return [];
}

async function loadSchoolInfoApi<T extends { SCHUL_NM?: string }>(
  city: string,
  apiType: string,
): Promise<T[]> {
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  const sggCodes = GYEONGGI_SGG[city];
  if (!apiKey || !sggCodes?.length) return [];

  // 학교알리미 공시는 매년 갱신되어 당해년도 데이터가 가장 최신(신설교 포함)이므로
  // 당해년도부터 시도하고, 공시 전(연초)이면 fetchOneSggList가 전년도로 폴백한다.
  const year = String(new Date().getFullYear());
  const cacheKey = `schoolinfo:${apiType}:${sggCodes.join(",")}:${year}`;
  const cached = cacheGet<T[]>(cacheKey);
  if (cached) return cached;

  // 구가 여러 개인 시(성남·수원 등)는 구별로 조회 후 합침
  const chunks = await Promise.all(
    sggCodes.map((code) => fetchOneSggList<T>(apiKey, apiType, code, year)),
  );
  const list = chunks.flat();
  if (!list.length) return [];

  cacheSet(cacheKey, list, 1000 * 60 * 60 * 12);
  return list;
}

function findBySchoolName<T extends { SCHUL_NM?: string }>(
  list: T[],
  schoolName: string,
  shortName?: string,
): T | undefined {
  const byName = new Map<string, T>();
  for (const row of list) {
    byName.set(normalizeSchoolName(row.SCHUL_NM ?? ""), row);
  }
  return (
    byName.get(normalizeSchoolName(schoolName)) ??
    (shortName ? byName.get(normalizeSchoolName(shortName)) : undefined)
  );
}

async function fetchSchoolInfoStats(
  city: string,
  schoolName: string,
): Promise<{
  classCount: number | null;
  specialClassCount: number | null;
  studentCount: number | null;
}> {
  const list = await loadSchoolInfoApi<SchoolInfoStatsRow>(city, "09");
  if (!list.length) {
    return { classCount: null, specialClassCount: null, studentCount: null };
  }

  const row = findBySchoolName(list, schoolName);
  if (!row) {
    return { classCount: null, specialClassCount: null, studentCount: null };
  }

  return {
    classCount: toFiniteInt(row.COL_C_SUM),
    specialClassCount: toFiniteInt(row.COL_C7),
    studentCount: toFiniteInt(row.COL_S_SUM),
  };
}

async function fetchSchoolInfoStaff(
  city: string,
  schoolName: string,
  shortName?: string,
): Promise<StaffBreakdown> {
  const list = await loadSchoolInfoApi<SchoolInfoStaffRow>(city, "22");
  return parseStaffRow(findBySchoolName(list, schoolName, shortName));
}

/** 목록용: 시·군 단위로 학급수·학생수·교원 일괄 보강 */
export async function enrichSchoolsForCity(schools: School[]): Promise<School[]> {
  if (schools.length === 0) return schools;
  const city = schools[0].city;
  try {
    const [statsList, staffList] = await Promise.all([
      loadSchoolInfoApi<SchoolInfoStatsRow>(city, "09"),
      loadSchoolInfoApi<SchoolInfoStaffRow>(city, "22"),
    ]);
    if (!statsList.length && !staffList.length) return schools;

    return schools.map((school) => {
      const stats = findBySchoolName(statsList, school.name, school.shortName);
      const staff = parseStaffRow(
        findBySchoolName(staffList, school.name, school.shortName),
      );
      return {
        ...school,
        classCount: toFiniteInt(stats?.COL_C_SUM) ?? school.classCount,
        specialClassCount:
          toFiniteInt(stats?.COL_C7) ?? school.specialClassCount,
        studentCount: toFiniteInt(stats?.COL_S_SUM) ?? school.studentCount,
        principalCount: staff.principalCount ?? school.principalCount,
        vicePrincipalCount:
          staff.vicePrincipalCount ?? school.vicePrincipalCount,
        deptHeadCount: staff.deptHeadCount ?? school.deptHeadCount,
        teacherCount: staff.teacherCount ?? school.teacherCount,
        staffCount: staff.staffCount ?? school.staffCount,
      };
    });
  } catch {
    return schools;
  }
}

/** 상세 화면용 학급·학생·교원 보강 */
export async function enrichSchoolDetails(school: School): Promise<School> {
  const [neisClass, infoStats, staff] = await Promise.all([
    school.schoolCode
      ? fetchNeisClassCount(school.schoolCode).catch(() => null)
      : Promise.resolve(null),
    fetchSchoolInfoStats(school.city, school.name).catch(() => ({
      classCount: null,
      specialClassCount: null,
      studentCount: null,
    })),
    fetchSchoolInfoStaff(school.city, school.name, school.shortName).catch(
      () => parseStaffRow(undefined),
    ),
  ]);

  return {
    ...school,
    classCount: infoStats.classCount ?? neisClass ?? school.classCount,
    specialClassCount:
      infoStats.specialClassCount ?? school.specialClassCount,
    studentCount: infoStats.studentCount ?? school.studentCount,
    principalCount: staff.principalCount ?? school.principalCount,
    vicePrincipalCount: staff.vicePrincipalCount ?? school.vicePrincipalCount,
    deptHeadCount: staff.deptHeadCount ?? school.deptHeadCount,
    teacherCount: staff.teacherCount ?? school.teacherCount,
    staffCount: staff.staffCount ?? school.staffCount,
  };
}
