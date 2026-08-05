export type Zone = "갑" | "을" | "병";
export type SubZone = "가" | "나" | "다" | "라";

export interface ZoneSchool {
  city: string;
  office: string;
  zone: Zone;
  subZone?: SubZone;
  schoolName: string;
  isBranch?: boolean;
  plannedNew?: boolean;
}

export interface School {
  id: string;
  schoolCode: string | null;
  name: string;
  shortName: string;
  address: string | null;
  homepage: string | null;
  tel: string | null;
  lat: number | null;
  lng: number | null;
  city: string;
  office: string;
  zone: Zone;
  subZone?: SubZone;
  isBranch?: boolean;
  classCount: number | null;
  /** 특수학급 수 (학교알리미 COL_C7) */
  specialClassCount: number | null;
  studentCount: number | null;
  /** 교장 수 (학교알리미 직위별 교원) */
  principalCount: number | null;
  /** 교감 수 */
  vicePrincipalCount: number | null;
  /** 부장(보직교사) 수 */
  deptHeadCount: number | null;
  /** 일반교사 수 */
  teacherCount: number | null;
  /** 목록용 교원수: 교장+교감+부장+교사 */
  staffCount: number | null;
}

export interface SchoolsFile {
  year: number;
  source: Record<string, string> | string;
  schools: School[];
}

export interface CitySummary {
  city: string;
  office: string;
  count: number;
  withCoords: number;
}

export interface Origin {
  lat: number;
  lng: number;
  label: string;
}

export type RouteMode = "car" | "transit";
/** 대중교통 세부 선호: 버스 위주 / 지하철 우선 */
export type TransitPreference = "bus" | "subway";

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface TransitStep {
  type: string;
  guidance: string;
  distanceMeters: number | null;
  durationMs: number | null;
  vehicleNames?: string[];
  stops?: string[];
  /** 구간별 지도 경로 */
  path?: LatLngPoint[];
}

/** 자동차 경로의 도로 구간 (연속 동일 도로명 병합) */
export interface CarRoadSegment {
  name: string;
  distanceMeters: number;
  durationMs: number;
}

export interface RouteResult {
  schoolId: string;
  mode: RouteMode;
  /** 대중교통일 때 버스/지하철 구분 */
  transitPreference?: TransitPreference;
  distanceMeters: number | null;
  durationMs: number | null;
  error?: string;
  /** 지도 표시용 경로 좌표 (lat/lng) */
  path?: LatLngPoint[];
  /** 대중교통 구간 안내 */
  steps?: TransitStep[];
  /** 자동차 주요 도로 구간 */
  roads?: CarRoadSegment[];
  fare?: number | null;
  transfers?: number | null;
}

export interface SchoolListItem extends School {
  straightDistanceMeters?: number | null;
  car?: RouteResult | null;
  /** 목록 정렬용: 버스/지하철 중 더 빠른 쪽 */
  transit?: RouteResult | null;
  transitBus?: RouteResult | null;
  transitSubway?: RouteResult | null;
}

export type CutoffStatus = "신규" | "전원수용" | "특만기" | "일반";

export interface CutoffEntry {
  year: number;
  /** 커트라인 없이 수용되는 경우의 사유 */
  status?: CutoffStatus;
  /** status가 "특만기" | "일반"일 때의 희망순위 */
  rank?: number;
  /** 실제 커트라인(전보년수.점수), 예: "4.03" */
  cutoff?: string;
  /** cutoff가 있을 때의 급지 표기(갑/을/병/수/우/미 등 원문 그대로) */
  zone?: string;
}

export interface CutoffsFile {
  years: number[];
  regions: Record<string, CutoffEntry[]>;
}
