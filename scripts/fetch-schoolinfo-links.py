#!/usr/bin/env python3
"""data/schools.json의 각 학교에 대해 학교알리미(schoolinfo.go.kr) SHL_IDF_CD를 조회해
data/schoolinfo-links.json으로 저장한다.

학교알리미 Open API(openApi.do)에는 이 식별자가 노출되지 않아, 사이트 자체의
검색창이 내부적으로 호출하는 검색 엔드포인트를 그대로 재현해서 조회한다
(공식 API 아님 — 사이트 구조가 바뀌면 깨질 수 있음).

동명 학교(예: 한빛초등학교)가 전국에 여러 곳 있을 수 있어, 검색 결과 후보를
모두 받아온 뒤 각 후보의 실제 주소가 "경기도"+대상 시·군을 포함하는지
확인하고 일치하는 후보만 채택한다. 일치하는 후보가 없으면 비워둔다
(틀린 학교로 잘못 연결하는 것보다 안전).

일부 학교는 정상적으로 매칭되지 않을 수 있음 (재실행으로 채워질 수 있는 것들):
- 분교장: 본교와 별도로 학교알리미에 등재되지 않는 경우가 많음
- 개교 예정/직후 신설교: 실제 운영 데이터(학생 수 등)가 있어야 공시되므로,
  개교 전이거나 공시 이전이면 검색에 걸리지 않음
  (예: 평택 평안초등학교, 2026.9. 개교 예정 — 2026.8. 기준 미매칭)
- SEARCH_MODE=1(초등학교) 필터를 쓰는데, 초·중·고 통합형 등 학교알리미에서
  "기타학교"로 분류된 곳은 이 필터로 걸리지 않음. SEARCH_TYPE=1(필터 없음)로
  재검색해 "기타학교(N)" 결과에서 수동으로 UUID를 찾아 추가해야 함
  (예: 시흥 군서미래국제학교초등학교)
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

ctx = ssl._create_unverified_context()

SEARCH_URL = "https://www.schoolinfo.go.kr/ei/ss/Pneiss_f01_l0.do"
DETAIL_URL = "https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do"
UUID_PATTERN = r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"
ADDRESS_RE = re.compile(r'주소\s*:\s*([^,"]+)')
COUNT_RE = re.compile(r"초등학교\((\d+)\)")
PAGE_SIZE = 5
MAX_PAGES = 10  # 안전장치: 동명 학교가 아무리 많아도 50개까지만 확인


def _search_page(name: str, page: int) -> str:
    body = urllib.parse.urlencode(
        {
            "SEARCH_SCHUL_NM": name,
            "SEARCH_TYPE": "2",
            "SEARCH_KEYWORD": name,
            "SEARCH_MODE": "1",
            "pageNumber": str(page),
        },
        encoding="euc-kr",
    ).encode()
    req = urllib.request.Request(
        SEARCH_URL,
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
        return r.read().decode("euc-kr", "ignore")


def find_candidates(name: str, delay: float = 0.0) -> list[str]:
    """SEARCH_MODE=1(초등학교) + SEARCH_TYPE=2(목록형)로 검색해
    후보 SHL_IDF_CD 전부를 페이지네이션(5개/페이지)까지 따라가며 순서대로 반환한다."""
    first = _search_page(name, 1)
    m = COUNT_RE.search(first)
    total = int(m.group(1)) if m else 0

    seen: list[str] = []

    def collect(html: str):
        for mm in re.finditer(UUID_PATTERN, html):
            if mm.group(0) not in seen:
                seen.append(mm.group(0))

    collect(first)
    pages = min(MAX_PAGES, -(-total // PAGE_SIZE)) if total else 1
    for page in range(2, pages + 1):
        time.sleep(delay)
        collect(_search_page(name, page))
    return seen


def fetch_address(shl_idf_cd: str) -> str | None:
    url = f"{DETAIL_URL}?SHL_IDF_CD={shl_idf_cd}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
        html = r.read().decode("euc-kr", "ignore")
    m = ADDRESS_RE.search(html)
    return m.group(1).strip() if m else None


def resolve(name: str, city: str, delay: float) -> str | None:
    try:
        candidates = find_candidates(name, delay)
    except Exception:
        return None
    for uuid in candidates:
        time.sleep(delay)
        try:
            address = fetch_address(uuid)
        except Exception:
            continue
        # 주소 표기가 "경기도 XX시", "경기 XX시", 드물게 도 표기 없이 "XX시"로만
        # 시작하는 경우까지 있음. "경기" 접두 없이 시작하는 경우, 광주광역시처럼
        # 경기도 시·군과 이름이 겹치는 광역시와 혼동되지 않도록 "XX시/군"까지 확인한다.
        matched = address and (
            (address.startswith("경기") and city in address)
            or address.startswith(f"{city}시")
            or address.startswith(f"{city}군")
        )
        if matched:
            return uuid
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--schools", default="data/schools.json")
    ap.add_argument("--out", default="data/schoolinfo-links.json")
    ap.add_argument("--delay", type=float, default=0.2)
    ap.add_argument(
        "--force",
        action="store_true",
        help="기존 결과도 무시하고 전부 재조회(주소 검증 강화 후 전면 재검증용)",
    )
    args = ap.parse_args()

    data = json.loads(Path(args.schools).read_text(encoding="utf-8"))
    schools = data if isinstance(data, list) else data["schools"]

    out_path = Path(args.out)
    existing: dict[str, str] = {}
    if out_path.exists() and not args.force:
        existing = json.loads(out_path.read_text(encoding="utf-8")).get("links", {})

    links: dict[str, str] = {} if args.force else dict(existing)
    ok = 0
    fail = 0
    changed = 0
    for i, s in enumerate(schools):
        if not args.force and s["id"] in links:
            continue
        name = s["name"]
        uuid = resolve(name, s["city"], args.delay)
        if not uuid and " " in name:
            uuid = resolve(name.replace(" ", ""), s["city"], args.delay)
        if not uuid:
            uuid = resolve(s["shortName"] + ("분교장" if s.get("isBranch") else "초등학교"), s["city"], args.delay)
        if uuid:
            if links.get(s["id"]) != uuid:
                changed += 1
            links[s["id"]] = uuid
            ok += 1
        else:
            links.pop(s["id"], None)
            fail += 1
        if (i + 1) % 25 == 0:
            print(f"[{i+1}/{len(schools)}] ok={ok} fail={fail} changed={changed}", flush=True)
        time.sleep(args.delay)

    print(f"done. ok={ok} fail={fail} changed={changed} total_links={len(links)}", flush=True)
    out_path.write_text(
        json.dumps(
            {"source": "schoolinfo.go.kr 검색 재현 (비공식, 주소로 시·군 검증)", "links": links},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print("wrote", out_path, flush=True)


if __name__ == "__main__":
    main()
