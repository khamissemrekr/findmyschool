#!/usr/bin/env python3
"""승진점수표와 지역표(MD 변환본) + schools.json -> data/promotion-bonus.json

각 학교에 '현재 적용 중인' 승진 가산점 급지(벽지·접적·농어촌·공단·교육감지정 접경)와 월평점을 붙인다.
- 현재 적용 = 지정기간이 종료일 없이 '~' 또는 '~현재'로 끝나는 행
- 앱(schools.json)에 없는 학교는 폐·휴교(인사기준에서 밑줄 표기)로 보고 closed 목록에 남긴다.

사용: python3 scripts/build-promotion-bonus.py --md 20261007.md [--regions 파주,연천]
"""
import argparse
import collections
import json
import re
from html.parser import HTMLParser
from pathlib import Path

# 월평점 (2026.2.28.자 가산점평정기준일람표)
RATE_BYEOK = {"가": 0.045, "나": 0.036, "다": 0.027, "라": 0.018}  # 도서벽지·접적
RATE_FARM = {"읍": 0.015, "면": 0.018, "공단": 0.012}
RATE_SUPERINTENDENT_BORDER = 0.015  # 교육감지정 접경(교육특별)

# 인사구역(갑/을/병)과 가산점 종류의 일반적 대응. 벗어나면 zoneMismatch 로 표기한다.
EXPECTED_ZONE = {"벽지": "병", "접적": "병", "농어촌": "을", "교육감지정접경": "을", "공단": "갑"}

# 한 칸에 붙여 쓴 학교명
NAME_OVERRIDES = {
    "삼상상수": ["삼상", "상수"],
    "좌항한터": ["좌항", "한터"],
    "지평(지제)청운": ["청운"],
}
# 교육감지정 접경 (접경지역 중 교육감 지정) 표
SUPERINTENDENT_BORDER = [
    ("동두천양주", "탑동,보산,소요,동보,생연,이담,지행,동두천송내,동두천신천,사동,동두천"),
    ("파주", "심학,교하,검산"),
    ("포천", "선단,포천"),
    ("안산", "대남,대동,대부"),
]
# 학교 두 곳 이상이 같은 이름이라 어느 쪽인지 확인되지 않은 항목
UNCONFIRMED = {("안성", "공도")}


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.cur, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self.cur = []
            self.tables.append((self.getpos()[0], self.cur))
        elif tag == "tr":
            self.row = []
            self.cur.append(self.row)
        elif tag in ("td", "th"):
            self.cell = {"t": "", "rs": int(a.get("rowspan", 1)), "cs": int(a.get("colspan", 1))}
        elif tag == "br" and self.cell is not None:
            self.cell["t"] += "\n"

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(self.cell)
            self.cell = None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell["t"] += data


def expand(rows, ncols):
    """rowspan/colspan 을 풀어 ncols 칸짜리 행으로 만든다."""
    out, pend = [], {}
    for cells in rows:
        line, ci, k = [], 0, 0
        while len(line) < ncols:
            if ci in pend and pend[ci][1] > 0:
                line.append(pend[ci][0])
                pend[ci][1] -= 1
                ci += 1
                continue
            if k >= len(cells):
                break
            c = cells[k]
            k += 1
            for _ in range(c["cs"]):
                line.append(c["t"].strip())
                if c["rs"] > 1:
                    pend[ci] = [c["t"].strip(), c["rs"] - 1]
                ci += 1
        out.append(line)
    return out


def is_open_ended(period: str) -> bool:
    p = period.replace(" ", "")
    return "현재" in p or bool(re.search(r"[~\-]$", p))


def norm(s: str) -> str:
    return re.sub(r"\s+", "", s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--md", required=True)
    ap.add_argument("--schools", default="data/schools.json")
    ap.add_argument("--out", default="data/promotion-bonus.json")
    ap.add_argument("--regions", default="", help="쉼표 구분 시·군(비우면 전체)")
    args = ap.parse_args()
    only = {r for r in args.regions.split(",") if r}

    schools = json.loads(Path(args.schools).read_text(encoding="utf-8"))["schools"]
    by_office, by_city = collections.defaultdict(list), collections.defaultdict(list)
    for s in schools:
        by_office[s["office"]].append(s)
        by_city[s["city"]].append(s)

    def find(region, name):
        pool = by_office.get(region) or by_city.get(region) or []
        n = norm(name)
        c = [s for s in pool if norm(s["shortName"]) == n or norm(s["name"]).replace("초등학교", "") == n]
        if not c:
            base = n.replace("분교장", "").replace("분교", "")
            c = [s for s in pool if norm(s["name"]).replace("초등학교", "").replace("분교장", "") == base]
        return c

    parser = TableParser()
    parser.feed(Path(args.md).read_text(encoding="utf-8"))
    tables = [t for _, t in parser.tables]
    # 표 위치: 도서·벽지·접적·수복(구분 열 있는 표) / 농어촌·공단(지역 열 앞) — 헤더로 판별
    byeok_rows, farm_rows = [], []
    for t in tables:
        head = "".join(c["t"] for c in t[0])
        if "구분" in head and "급지" in head and "지정기간" in head:
            for r in expand(t[1:], 5):
                if len(r) == 5:
                    byeok_rows.append(r)
        elif "지역" in head and "급지" in head and "지정기간" in head and "구분" not in head:
            for r in expand(t[2:], 5):
                if len(r) == 5 and r[0]:
                    farm_rows.append(r)

    result, closed, unconfirmed = {}, [], []

    def add(region, name, kind, grade, rate, period):
        if only and region not in only and not any(s["city"] in only for s in by_office.get(region, [])):
            return
        c = find(region, name)
        if (region, name) in UNCONFIRMED or len(c) > 1:
            unconfirmed.append({"region": region, "name": name, "kind": kind, "grade": grade})
            return
        if not c:
            # 유치원·특수학교 표는 대상이 아니다(초등학교만 취급)
            if name.endswith("유치원") or (name.endswith("학교") and not name.endswith("초등학교")):
                return
            closed.append({"region": region, "name": name, "kind": kind, "grade": grade})
            return
        s = c[0]
        if only and s["city"] not in only:
            return
        flags = {}
        if kind in ("벽지", "접적") and s.get("subZone") != grade:
            flags["gradeMismatch"] = {"existing": f"{s['zone']}/{s.get('subZone') or '-'}"}
        if s["zone"] != EXPECTED_ZONE[kind]:
            flags["zoneMismatch"] = {"zone": s["zone"], "expected": EXPECTED_ZONE[kind]}
        entry = {"kind": kind, "grade": grade, "monthly": rate, "since": period}
        if flags:
            entry["flags"] = flags
        result[s["id"]] = entry

    for sec, region, name, period, grade in byeok_rows:
        if not is_open_ended(period) or grade not in RATE_BYEOK:
            continue
        # 구분 열이 비어 있는 행(쪽 이어짐)은 접적 표의 연속이다.
        kind = "벽지" if sec == "벽지" else "접적"
        add(region, name, kind, grade, RATE_BYEOK[grade], period)

    for region, names, period, _before, after in farm_rows:
        if after not in RATE_FARM or not is_open_ended(period):
            continue
        for nm in re.split(r"[,\n]+", names):
            nm = nm.strip()
            if not nm or nm.startswith("("):
                continue
            for x in NAME_OVERRIDES.get(nm, [nm]):
                kind = "공단" if after == "공단" else "농어촌"
                add(region, x, kind, None if kind == "공단" else after, RATE_FARM[after], period)

    for region, names in SUPERINTENDENT_BORDER:
        for nm in names.split(","):
            add(region, nm, "교육감지정접경", None, RATE_SUPERINTENDENT_BORDER, "2013.03.01~")

    out = {
        "source": "2026.2.28.자 기준 교육공무원 승진규정에 따른 평정업무처리요령(초등유아) 승진점수표와 지역표",
        "asOf": "2026-02-28",
        "note": "현재(종료일 없음) 적용 중인 학교만 수록. closed는 앱 데이터에 없는 학교(폐·휴교 추정), unconfirmed는 학교 특정이 안 된 항목.",
        "schools": dict(sorted(result.items())),
        "closed": closed,
        "unconfirmed": unconfirmed,
    }
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    kinds = collections.Counter(v["kind"] for v in result.values())
    print(f"wrote {args.out}: {len(result)}교 {dict(kinds)} / closed {len(closed)} / unconfirmed {len(unconfirmed)}")
    for k in ("gradeMismatch", "zoneMismatch"):
        ids = [i for i, v in result.items() if k in v.get("flags", {})]
        print(f"  {k}: {len(ids)}", ids[:12])


if __name__ == "__main__":
    main()
