# 지역별 전보 커트라인 추이 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지역(시·군, `office`)을 선택하면 해당 지역의 2022/2023/2025/2026년도 전보 커트라인 추이를 사이드바에 작은 표로 보여준다.

**Architecture:** 기존 `data/schools.json` → `src/lib/schools.ts` → `/api/schools` → `AppShell` 패턴을 그대로 복제한다: 정적 JSON(`data/transfer-cutoffs.json`) → 로더(`src/lib/cutoffs.ts`) → API 라우트(`/api/cutoffs`) → 클라이언트 컴포넌트(`CutoffPanel`) → `AppShell`에서 `city` 선택 시 `Filters` 바로 아래에 배치.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4. 프로젝트에 테스트 러너(jest/vitest 등)가 없으므로, 검증은 Node 스크립트(데이터 무결성)와 `npx tsc --noEmit`(타입), `curl`(API), 브라우저 육안 확인(UI)으로 수행한다 — 기존 프로젝트 검증 방식과 동일.

## Global Constraints

- `data/transfer-cutoffs.json`의 `regions` 키는 `data/schools.json`의 `office` 값과 정확히 1:1 일치해야 한다 (25개 지역).
- 정기전보(2022, 2023)와 청간전보(2025, 2026)는 구분 없이 "청간전보"라는 명칭의 단일 연도순 표로 취급한다.
- 2024년 데이터는 없음 — `years` 배열에 포함하지 않는다 (`[2022, 2023, 2025, 2026]`).
- 이번 범위에서 PDF 자동 파싱 스크립트는 만들지 않는다 — 데이터는 수동 JSON 파일로 관리.
- 커트라인 정보는 학교 카드/지도 마커가 아니라 지역(시·군) 선택 시 사이드바 패널로만 노출한다.

---

### Task 1: 타입 정의 추가

**Files:**
- Modify: `src/types/school.ts`

**Interfaces:**
- Produces: `CutoffStatus` (`"신규" | "전원수용" | "특만기" | "일반"`), `CutoffEntry`, `CutoffsFile` — 이후 모든 태스크가 이 타입을 import해서 쓴다.

- [ ] **Step 1: `src/types/school.ts` 파일 끝에 다음 타입을 추가**

`src/types/school.ts` 맨 아래(파일 끝, `SchoolListItem` 인터페이스 뒤)에 이어서 추가:

```typescript
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
```

- [ ] **Step 2: 타입 체크로 문법 오류 없는지 확인**

Run: `cd findmyschool && npx tsc --noEmit`
Expected: 기존에 있던 에러 외에 `school.ts` 관련 새 에러 없음 (프로젝트에 기존 에러가 없다면 exit code 0)

- [ ] **Step 3: Commit**

```bash
git add src/types/school.ts
git commit -m "feat: 전보 커트라인 타입 정의 추가"
```

---

### Task 2: 데이터 파일 생성 및 무결성 검증

**Files:**
- Create: `data/transfer-cutoffs.json`
- Create (임시 검증용, 커밋 후 삭제): `scripts/validate-cutoffs.mjs`

**Interfaces:**
- Consumes: 없음 (정적 데이터)
- Produces: `data/transfer-cutoffs.json` — `CutoffsFile` 형태의 JSON. Task 3의 로더가 이 파일을 읽는다.

- [ ] **Step 1: `data/transfer-cutoffs.json` 생성**

2022(정기전보), 2023(정기전보), 2025(청간전보), 2026(청간전보) 경기도교육청 발표 PDF에서 추출한 값. 아래 내용을 정확히 그대로 저장:

```json
{
  "years": [2022, 2023, 2025, 2026],
  "regions": {
    "가평": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "특만기", "rank": 2 },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "고양": [
      { "year": 2022, "status": "특만기", "rank": 4 },
      { "year": 2023, "status": "특만기", "rank": 2 },
      { "year": 2025, "status": "특만기", "rank": 3 },
      { "year": 2026, "status": "전원수용" }
    ],
    "광명": [
      { "year": 2022, "cutoff": "4.06", "zone": "미" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "cutoff": "4.06", "zone": "수" },
      { "year": 2026, "cutoff": "5.04", "zone": "미" }
    ],
    "광주하남": [
      { "year": 2022, "status": "특만기", "rank": 1 },
      { "year": 2023, "status": "특만기", "rank": 1 },
      { "year": 2025, "cutoff": "3.04", "zone": "미" },
      { "year": 2026, "cutoff": "4.00", "zone": "수" }
    ],
    "구리남양주": [
      { "year": 2022, "cutoff": "3.00", "zone": "미" },
      { "year": 2023, "cutoff": "5.01", "zone": "수" },
      { "year": 2025, "cutoff": "4.09", "zone": "우" },
      { "year": 2026, "cutoff": "6.04", "zone": "미" }
    ],
    "군포의왕": [
      { "year": 2022, "cutoff": "7.01", "zone": "수" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "cutoff": "2.03", "zone": "수" },
      { "year": 2026, "cutoff": "4.03", "zone": "수" }
    ],
    "김포": [
      { "year": 2022, "status": "특만기", "rank": 1 },
      { "year": 2023, "status": "특만기", "rank": 1 },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "cutoff": "2.00", "zone": "미" }
    ],
    "동두천양주": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "부천": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "성남": [
      { "year": 2022, "cutoff": "3.03", "zone": "수" },
      { "year": 2023, "cutoff": "4.04", "zone": "미" },
      { "year": 2025, "cutoff": "5.08", "zone": "수" },
      { "year": 2026, "cutoff": "6.03", "zone": "수" }
    ],
    "수원": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "cutoff": "2.06", "zone": "우" },
      { "year": 2026, "cutoff": "4.03", "zone": "우" }
    ],
    "시흥": [
      { "year": 2022, "status": "특만기", "rank": 1 },
      { "year": 2023, "status": "특만기", "rank": 3 },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "cutoff": "2.00", "zone": "미" }
    ],
    "안산": [
      { "year": 2022, "status": "특만기", "rank": 4 },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "안성": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "안양과천": [
      { "year": 2022, "cutoff": "3.03", "zone": "미" },
      { "year": 2023, "cutoff": "4.07", "zone": "미" },
      { "year": 2025, "cutoff": "6.04", "zone": "미" },
      { "year": 2026, "cutoff": "7.07", "zone": "미" }
    ],
    "양평": [
      { "year": 2022, "status": "특만기", "rank": 3 },
      { "year": 2023, "status": "특만기", "rank": 3 },
      { "year": 2025, "status": "특만기", "rank": 2 },
      { "year": 2026, "status": "일반", "rank": 2 }
    ],
    "여주": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "연천": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "용인": [
      { "year": 2022, "cutoff": "4.11", "zone": "우" },
      { "year": 2023, "cutoff": "5.04", "zone": "수" },
      { "year": 2025, "cutoff": "4.03", "zone": "수" },
      { "year": 2026, "cutoff": "5.00", "zone": "수" }
    ],
    "의정부": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "이천": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "특만기", "rank": 4 },
      { "year": 2025, "status": "특만기", "rank": 2 },
      { "year": 2026, "status": "전원수용" }
    ],
    "파주": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "평택": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "포천": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "전원수용" },
      { "year": 2026, "status": "전원수용" }
    ],
    "화성오산": [
      { "year": 2022, "status": "신규" },
      { "year": 2023, "status": "신규" },
      { "year": 2025, "status": "특만기", "rank": 1 },
      { "year": 2026, "status": "전원수용" }
    ]
  }
}
```

- [ ] **Step 2: 검증 스크립트 작성**

`scripts/validate-cutoffs.mjs` 생성:

```javascript
import { readFileSync } from "fs";

const schools = JSON.parse(readFileSync("data/schools.json", "utf-8"));
const cutoffs = JSON.parse(readFileSync("data/transfer-cutoffs.json", "utf-8"));

const schoolOffices = new Set(schools.schools.map((s) => s.office));
const cutoffOffices = new Set(Object.keys(cutoffs.regions));

let ok = true;

for (const office of schoolOffices) {
  if (!cutoffOffices.has(office)) {
    console.error(`MISSING region in transfer-cutoffs.json: ${office}`);
    ok = false;
  }
}
for (const office of cutoffOffices) {
  if (!schoolOffices.has(office)) {
    console.error(`EXTRA region in transfer-cutoffs.json not in schools.json: ${office}`);
    ok = false;
  }
}

for (const [office, entries] of Object.entries(cutoffs.regions)) {
  const years = entries.map((e) => e.year);
  const expected = cutoffs.years;
  if (JSON.stringify(years) !== JSON.stringify(expected)) {
    console.error(`${office}: years ${JSON.stringify(years)} !== expected ${JSON.stringify(expected)}`);
    ok = false;
  }
  for (const e of entries) {
    const hasCutoff = e.cutoff != null;
    const hasStatus = e.status != null;
    if (hasCutoff === hasStatus) {
      console.error(`${office} ${e.year}: entry must have exactly one of cutoff/status, got ${JSON.stringify(e)}`);
      ok = false;
    }
    if (hasCutoff && !e.zone) {
      console.error(`${office} ${e.year}: cutoff present without zone`);
      ok = false;
    }
    if ((e.status === "특만기" || e.status === "일반") && e.rank == null) {
      console.error(`${office} ${e.year}: status ${e.status} requires rank`);
      ok = false;
    }
  }
}

if (!ok) {
  console.error("VALIDATION FAILED");
  process.exit(1);
}
console.log(`OK: ${cutoffOffices.size} regions, ${cutoffs.years.length} years each`);
```

- [ ] **Step 3: 검증 실행**

Run: `cd findmyschool && node scripts/validate-cutoffs.mjs`
Expected: `OK: 25 regions, 4 years each`

- [ ] **Step 4: Commit**

```bash
git add data/transfer-cutoffs.json scripts/validate-cutoffs.mjs
git commit -m "feat: 지역별 전보 커트라인 데이터 추가 (2022,2023,2025,2026)"
```

---

### Task 3: 데이터 로더 (`src/lib/cutoffs.ts`)

**Files:**
- Create: `src/lib/cutoffs.ts`

**Interfaces:**
- Consumes: `data/transfer-cutoffs.json` (Task 2), `CutoffsFile`/`CutoffEntry` 타입 (Task 1, `@/types/school`)
- Produces: `getCutoffsFile(): CutoffsFile`, `getRegionCutoffs(office: string): CutoffEntry[] | null` — Task 4의 API 라우트가 이 두 함수를 쓴다.

- [ ] **Step 1: `src/lib/cutoffs.ts` 작성**

`src/lib/schools.ts`의 캐싱 패턴을 그대로 따른다:

```typescript
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
```

- [ ] **Step 2: 타입 체크**

Run: `cd findmyschool && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 실제 동작은 Task 4에서 API 라우트를 통해 curl로 검증**

이 로더는 순수 파일 읽기 함수라 Next.js 런타임(App Router) 밖에서 단독 실행하기 번거롭다. Task 4의 `/api/cutoffs` 라우트가 이 함수를 직접 호출하므로, 그 라우트를 `npm run dev`로 띄워 curl로 확인하는 것이 곧 이 로더의 동작 검증이다 (Task 4 Step 2 참고).

- [ ] **Step 4: Commit**

```bash
git add src/lib/cutoffs.ts
git commit -m "feat: 커트라인 데이터 로더 추가"
```

---

### Task 4: API 라우트 (`/api/cutoffs`)

**Files:**
- Create: `src/app/api/cutoffs/route.ts`

**Interfaces:**
- Consumes: `getCutoffsFile`, `getRegionCutoffs` (Task 3, `@/lib/cutoffs`)
- Produces: `GET /api/cutoffs?office=<name>` → `{ years: number[], entries: CutoffEntry[] }` (office 없거나 매칭 실패 시 `{ years: number[], entries: [] }`). `GET /api/cutoffs` (office 파라미터 없음) → `{ years: number[], regions: Record<string, CutoffEntry[]> }`. Task 5의 `CutoffPanel`이 `office` 파라미터를 넣어 호출한다.

- [ ] **Step 1: `src/app/api/cutoffs/route.ts` 작성**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCutoffsFile, getRegionCutoffs } from "@/lib/cutoffs";

export async function GET(req: NextRequest) {
  const office = req.nextUrl.searchParams.get("office");
  const file = getCutoffsFile();

  if (!office) {
    return NextResponse.json({ years: file.years, regions: file.regions });
  }

  const entries = getRegionCutoffs(office) ?? [];
  return NextResponse.json({ years: file.years, entries });
}
```

- [ ] **Step 2: 개발 서버 기동 후 curl로 검증**

Run:
```bash
cd findmyschool && npm run dev &
sleep 3
curl -s "http://localhost:3000/api/cutoffs?office=수원"
echo
curl -s "http://localhost:3000/api/cutoffs?office=존재하지않는지역"
echo
kill %1
```
Expected:
- 첫 번째 curl: `{"years":[2022,2023,2025,2026],"entries":[{"year":2022,"status":"신규"},{"year":2023,"status":"신규"},{"year":2025,"cutoff":"2.06","zone":"우"},{"year":2026,"cutoff":"4.03","zone":"우"}]}`
- 두 번째 curl: `{"years":[2022,2023,2025,2026],"entries":[]}`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cutoffs/route.ts
git commit -m "feat: /api/cutoffs 라우트 추가"
```

---

### Task 5: `CutoffPanel` 컴포넌트

**Files:**
- Create: `src/components/CutoffPanel.tsx`

**Interfaces:**
- Consumes: `GET /api/cutoffs?office=...` (Task 4), `CutoffEntry` 타입 (`@/types/school`)
- Produces: `CutoffPanel({ office: string })` React 컴포넌트 — Task 6에서 `AppShell`이 렌더링한다.

- [ ] **Step 1: `src/components/CutoffPanel.tsx` 작성**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { CutoffEntry } from "@/types/school";

interface Props {
  office: string;
}

const CUTOFF_ZONE_COLOR: Record<string, string> = {
  갑: "#1d4ed8",
  을: "#b45309",
  병: "#be123c",
  수: "#0f766e",
  우: "#7c3aed",
  미: "#334155",
};

function formatEntry(entry: CutoffEntry | undefined): {
  text: string;
  color?: string;
} {
  if (!entry) return { text: "-" };
  if (entry.cutoff) {
    return {
      text: `${entry.cutoff}(${entry.zone ?? ""})`,
      color: CUTOFF_ZONE_COLOR[entry.zone ?? ""] ?? "#0f172a",
    };
  }
  if (entry.status === "특만기" || entry.status === "일반") {
    return { text: `${entry.status}(${entry.rank}희망)` };
  }
  if (entry.status === "전원수용") return { text: "전원 수용" };
  if (entry.status === "신규") return { text: "신규" };
  return { text: "-" };
}

export function CutoffPanel({ office }: Props) {
  const [years, setYears] = useState<number[]>([]);
  const [entries, setEntries] = useState<CutoffEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!office) {
      setYears([]);
      setEntries([]);
      return;
    }
    setLoading(true);
    fetch(`/api/cutoffs?office=${encodeURIComponent(office)}`)
      .then((r) => r.json())
      .then((d) => {
        setYears(d.years ?? []);
        setEntries(d.entries ?? []);
      })
      .finally(() => setLoading(false));
  }, [office]);

  if (!office) return null;
  if (loading) {
    return (
      <p className="text-xs text-slate-500">커트라인 불러오는 중…</p>
    );
  }
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <p className="mb-1.5 text-xs font-semibold text-slate-700">
        {office} 청간전보 커트라인
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400">
            {years.map((y) => (
              <th key={y} className="pb-1 text-left font-medium">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {years.map((y) => {
              const entry = entries.find((e) => e.year === y);
              const { text, color } = formatEntry(entry);
              return (
                <td
                  key={y}
                  className="py-0.5 pr-2 font-medium"
                  style={color ? { color } : undefined}
                >
                  {text}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크 및 린트**

Run: `cd findmyschool && npx tsc --noEmit && npx eslint src/components/CutoffPanel.tsx`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/components/CutoffPanel.tsx
git commit -m "feat: CutoffPanel 컴포넌트 추가"
```

---

### Task 6: `AppShell`에 연결

**Files:**
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `CutoffPanel` (Task 5, `@/components/CutoffPanel`)

- [ ] **Step 1: import 추가**

`src/components/AppShell.tsx` 상단 import 목록에 추가 (`import { Filters } from "@/components/Filters";` 바로 아래):

```typescript
import { CutoffPanel } from "@/components/CutoffPanel";
```

- [ ] **Step 2: `Filters` 바로 아래에 `CutoffPanel` 삽입**

`src/components/AppShell.tsx`에서 다음 블록을 찾는다:

```tsx
        <Filters
          cities={cities}
          city={city}
          zone={zone}
          onCityChange={(c) => updateParams({ city: c })}
          onZoneChange={(z) =>
            updateParams({ zone: z === "전체" ? null : z })
          }
        />

        {message && (
```

다음과 같이 `CutoffPanel` 한 줄을 `Filters`와 `message` 사이에 삽입:

```tsx
        <Filters
          cities={cities}
          city={city}
          zone={zone}
          onCityChange={(c) => updateParams({ city: c })}
          onZoneChange={(z) =>
            updateParams({ zone: z === "전체" ? null : z })
          }
        />

        <CutoffPanel office={city} />

        {message && (
```

- [ ] **Step 3: 타입 체크 및 빌드**

Run: `cd findmyschool && npx tsc --noEmit && npm run build`
Expected: 빌드 성공 (기존 경고 수준 제외 새 에러 없음)

- [ ] **Step 4: 브라우저 육안 확인**

Run: `cd findmyschool && npm run dev`

브라우저에서 `http://localhost:3000` 접속 후:
1. 시·군 드롭다운에서 "수원" 선택
2. Filters 아래에 "수원 청간전보 커트라인" 표가 나타나는지 확인 — 2022 "신규", 2023 "신규", 2025 "2.06(우)"(보라색), 2026 "4.03(우)"(보라색)
3. "양평" 선택 — 2026 열에 "일반(2희망)"이 나오는지 확인
4. 시·군 선택 해제(빈 값) 시 패널이 사라지는지 확인

Expected: 위 4가지 모두 원문 PDF 값과 일치, 시·군 미선택 시 패널 미표시

- [ ] **Step 5: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat: AppShell에 지역별 커트라인 패널 연결"
```

---

## Self-Review Notes

- **Spec coverage**: 데이터 모델(Task 2), 백엔드 로더/API(Task 3, 4), 프런트엔드 컴포넌트/배치(Task 5, 6), 타입(Task 1) — 스펙의 모든 섹션에 대응하는 태스크 존재. PDF 자동 파싱 스크립트와 학교 카드/지도 통합은 스펙에서 명시적으로 범위 밖으로 규정되어 태스크 없음.
- **Placeholder scan**: 전 태스크에 실제 코드/데이터/명령어 포함, "TODO"/"나중에" 없음.
- **Type consistency**: `CutoffEntry`, `CutoffsFile`, `CutoffStatus`가 Task 1에서 정의된 형태 그대로 Task 2(JSON), 3(로더), 4(API), 5(컴포넌트)에서 동일하게 사용됨. `getRegionCutoffs`/`getCutoffsFile` 함수명이 Task 3~4에서 일관됨.
