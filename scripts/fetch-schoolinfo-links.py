#!/usr/bin/env python3
"""data/schools.json의 각 학교에 대해 학교알리미(schoolinfo.go.kr) SHL_IDF_CD를 조회해
data/schoolinfo-links.json으로 저장한다.

학교알리미 Open API(openApi.do)에는 이 식별자가 노출되지 않아, 사이트 자체의
검색창이 내부적으로 호출하는 검색 엔드포인트를 그대로 재현해서 조회한다
(공식 API 아님 — 사이트 구조가 바뀌면 깨질 수 있음).

일부 학교는 정상적으로 매칭되지 않을 수 있음 (재실행으로 채워질 수 있는 것들):
- 분교장: 본교와 별도로 학교알리미에 등재되지 않는 경우가 많음
- 개교 예정/직후 신설교: 실제 운영 데이터(학생 수 등)가 있어야 공시되므로,
  개교 전이거나 공시 이전이면 검색에 걸리지 않음
  (예: 평택 평안초등학교, 2026.9. 개교 예정 — 2026.8. 기준 미매칭)
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
UUID_RE = re.compile(r"searchSchul\('([a-f0-9-]{36})'\)")
UUID_RE_FALLBACK = re.compile(r"SHL_IDF_CD.*?val\('([a-f0-9-]{36})'\)")


def find_shl_idf_cd(name: str) -> str | None:
    body = urllib.parse.urlencode(
        {
            "SEARCH_SCHUL_NM": name,
            "SEARCH_TYPE": "1",
            "SEARCH_KEYWORD": name,
            "pageNumber": "1",
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
        html = r.read().decode("euc-kr", "ignore")
    m = UUID_RE.search(html)
    if m:
        return m.group(1)
    m2 = UUID_RE_FALLBACK.search(html)
    return m2.group(1) if m2 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--schools", default="data/schools.json")
    ap.add_argument("--out", default="data/schoolinfo-links.json")
    ap.add_argument("--delay", type=float, default=0.3)
    args = ap.parse_args()

    data = json.loads(Path(args.schools).read_text(encoding="utf-8"))
    schools = data if isinstance(data, list) else data["schools"]

    existing: dict[str, str] = {}
    out_path = Path(args.out)
    if out_path.exists():
        existing = json.loads(out_path.read_text(encoding="utf-8")).get("links", {})

    links = dict(existing)
    ok = 0
    fail = 0
    for i, s in enumerate(schools):
        if s["id"] in links:
            continue
        try:
            uuid = find_shl_idf_cd(s["name"])
        except Exception as e:
            print(f"[{i+1}/{len(schools)}] {s['name']} ERROR {e}")
            fail += 1
            continue
        if uuid:
            links[s["id"]] = uuid
            ok += 1
        else:
            fail += 1
        if (i + 1) % 50 == 0:
            print(f"[{i+1}/{len(schools)}] ok={ok} fail={fail}")
        time.sleep(args.delay)

    print(f"done. ok={ok} fail={fail} total_links={len(links)}")
    out_path.write_text(
        json.dumps({"source": "schoolinfo.go.kr 검색 재현 (비공식)", "links": links}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("wrote", out_path)


if __name__ == "__main__":
    main()
