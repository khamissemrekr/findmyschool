#!/usr/bin/env python3
"""HWPX/별표1 → data/gyeonggi-zones-2027.json 변환 스크립트."""

from __future__ import annotations

import argparse
import html
import json
import re
import zipfile
from collections import Counter
from pathlib import Path

CITIES = [
    "남양주",
    "동두천",
    "의정부",
    "과천",
    "광명",
    "양주",
    "안산",
    "평택",
    "군포",
    "의왕",
    "고양",
    "구리",
    "여주",
    "화성",
    "오산",
    "파주",
    "광주",
    "하남",
    "연천",
    "포천",
    "가평",
    "양평",
    "이천",
    "용인",
    "안성",
    "김포",
    "시흥",
    "수원",
    "성남",
    "안양",
    "부천",
]
CITIES_SORTED = sorted(CITIES, key=len, reverse=True)

OFFICE = {
    "안양": "안양과천",
    "과천": "안양과천",
    "동두천": "동두천양주",
    "양주": "동두천양주",
    "군포": "군포의왕",
    "의왕": "군포의왕",
    "구리": "구리남양주",
    "남양주": "구리남양주",
    "화성": "화성오산",
    "오산": "화성오산",
    "광주": "광주하남",
    "하남": "광주하남",
}

EXPECTED = {
    "수원": 100,
    "성남": 74,
    "의정부": 34,
    "안양": 41,
    "과천": 6,
    "부천": 64,
    "광명": 25,
    "동두천": 11,
    "양주": 40,
    "안산": 54,
    "평택": 73,
    "군포": 27,
    "의왕": 16,
    "고양": 91,
    "구리": 16,
    "남양주": 67,
    "여주": 23,
    "화성": 111,
    "오산": 27,
    "파주": 66,
    "광주": 35,
    "하남": 23,
    "연천": 13,
    "포천": 27,
    "가평": 13,
    "양평": 22,
    "이천": 32,
    "용인": 108,
    "안성": 34,
    "김포": 48,
    "시흥": 52,
}


CLOSED_OPEN = ""  # 밑줄(폐교/휴교 표기) 구간 시작 마커
CLOSED_CLOSE = ""  # 밑줄(폐교/휴교 표기) 구간 끝 마커


def extract_text_from_hwpx(path: Path) -> str:
    """밑줄(hh:underline) 서식이 적용된 학교명은 폐교/휴교 표기이므로
    CLOSED_OPEN/CLOSE 마커로 감싸 parse_school_list에서 제외할 수 있게 한다."""
    with zipfile.ZipFile(path) as zf:
        raw = zf.read("Contents/section0.xml").decode("utf-8", "ignore")
        header = zf.read("Contents/header.xml").decode("utf-8", "ignore")

    closed_char_ids = set()
    for m in re.finditer(r'<hh:charPr id="(\d+)"[^>]*>(.*?)</hh:charPr>', header, re.S):
        cid, body = m.groups()
        u = re.search(r'<hh:underline type="([^"]+)"', body)
        if u and u.group(1) != "NONE":
            closed_char_ids.add(cid)

    parts = []
    for run_m in re.finditer(r'<hp:run charPrIDRef="(\d+)"[^>]*>(.*?)</hp:run>', raw, re.S):
        cid, body = run_m.groups()
        texts = re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", body)
        joined = "".join(html.unescape(re.sub(r"<[^>]+>", "", t)) for t in texts)
        if not joined:
            continue
        if cid in closed_char_ids:
            joined = CLOSED_OPEN + joined + CLOSED_CLOSE
        parts.append(joined)
    return " ".join(parts)


CLOSED_NAME_RE = re.compile(r"^[가-힣()·,、]+$")
ZONE_LABELS = {"갑", "을", "병", "가", "나", "다", "라"}


def resolve_closed_markers(text: str) -> tuple[str, set[str]]:
    """밑줄 구간 중 숫자·서술문 등은 표 서식(합계 칸 등)일 뿐이므로 마커를 지우고,
    한글로만 이루어진 짧은 구간(실제 학교명)만 마커를 남겨 parse_school_list에서 제외한다."""
    closed_names: set[str] = set()

    def repl(m: re.Match) -> str:
        inner = m.group(1)
        stripped = re.sub(r"\s+", "", inner)
        if (
            stripped
            and len(stripped) <= 20
            and CLOSED_NAME_RE.match(stripped)
            and stripped not in ZONE_LABELS
        ):
            closed_names.add(stripped)
            return CLOSED_OPEN + inner + CLOSED_CLOSE
        return inner

    pattern = re.escape(CLOSED_OPEN) + r"(.*?)" + re.escape(CLOSED_CLOSE)
    new_text = re.sub(pattern, repl, text, flags=re.S)
    return new_text, closed_names


def find_cities(text: str):
    pat = r"(?<![가-힣])(" + "|".join(CITIES_SORTED) + r")(?![가-힣])"
    return list(re.finditer(pat, text))


def last_city_in(text: str):
    matches = find_cities(text)
    if not matches:
        return None
    best = None
    for m in matches:
        after = text[m.end() : m.end() + 15]
        if re.match(r"\s*\d", after):
            best = m.group(1)
    return best or matches[-1].group(1)


def make(city, zone, sub, name, is_branch):
    name = re.sub(r"\s+", "", name)
    name = name.replace(CLOSED_OPEN, "").replace(CLOSED_CLOSE, "")
    if not name or "교육지원청" in name or "인사구역" in name or "학교수" in name:
        return None
    e = {"city": city, "office": OFFICE.get(city, city), "zone": zone, "schoolName": name}
    if sub:
        e["subZone"] = sub
    if is_branch:
        e["isBranch"] = True
    return e


def parse_school_list(entries, text, city, zone, sub=None):
    text = text.strip()
    text = re.sub(r"\s*\d+(\(\d+\))?\s*$", "", text)
    text = re.sub(r"\(\d+\)\s*$", "", text)
    items = [x.strip() for x in text.split(",") if x.strip()]
    for item in items:
        if "교육지원청" in item:
            continue
        branches = re.findall(r"\(([^)]*분교[^)]*)\)", item)
        main = re.sub(r"\([^)]*분교[^)]*\)", "", item).strip().strip("() ").strip()
        main = re.sub(r"\s+", "", main)
        main = re.sub(r"\d+(\(\d+\))?$", "", main)
        if main and CLOSED_OPEN not in main:
            e = make(city, zone, sub, main, False)
            if e:
                entries.append(e)
        for b in branches:
            for bb in re.split(r"[,、]", b):
                bb = bb.strip()
                if CLOSED_OPEN in bb:
                    continue
                bb = re.sub(r"\s+", "", bb)
                if bb:
                    e = make(city, zone, sub, bb, True)
                    if e:
                        entries.append(e)
        if not main and not branches:
            if CLOSED_OPEN in item:
                continue
            m = re.fullmatch(r"\((.+)\)", item)
            raw_name = m.group(1) if m else item
            raw_name = re.sub(r"\s+", "", raw_name)
            e = make(city, zone, sub, raw_name, "분교" in raw_name)
            if e:
                entries.append(e)


def parse_zones(sec: str):
    sec = re.sub(r"교육지원청\s*시\.군명\s*인사구역\s*학\s*교\s*명\s*학교수", " ", sec)
    sec = re.sub(r"^.*?학교수\s*", "", sec)
    sec = re.sub(r"\s+", " ", sec)
    chunks = [c.strip() for c in re.split(r"\s*\d+\.\s*", sec) if c.strip()]
    entries = []
    city_pat = "(?:" + "|".join(CITIES_SORTED) + ")"

    for chunk in chunks:
        parts_z = re.split(r"(갑|을|병)", chunk)
        city_ctx = last_city_in(parts_z[0])
        j = 1
        while j < len(parts_z):
            zone = parts_z[j]
            content = parts_z[j + 1] if j + 1 < len(parts_z) else ""
            sub = None
            sm = re.match(r"\s*(가|나|다|라)(?![가-힣])\s*", content)
            if zone == "병" and sm:
                sub = sm.group(1)
                content = content[sm.end() :]
            trail = re.search(
                r"(?:(?<![가-힣])(?:"
                + "|".join(CITIES_SORTED)
                + r")(?![가-힣])\s*\d+(?:\(\d+\))?\s*)+$",
                content,
            )
            next_city = None
            if trail:
                next_city = last_city_in(trail.group())
                content = content[: trail.start()]
            content = re.sub(r"^\s*\d+(\(\d+\))?\s*", "", content)
            if zone == "병":
                sub_parts = re.split(r"(?<![가-힣])(가|나|다|라)(?![가-힣])", content)
                if sub_parts[0].strip() and sub:
                    parse_school_list(entries, sub_parts[0], city_ctx, zone, sub)
                elif sub_parts[0].strip() and not sub:
                    parse_school_list(entries, sub_parts[0], city_ctx, zone, None)
                k = 1
                while k < len(sub_parts):
                    s = sub_parts[k]
                    c = sub_parts[k + 1] if k + 1 < len(sub_parts) else ""
                    if city_ctx and c.strip():
                        parse_school_list(entries, c, city_ctx, zone, s)
                    k += 2
            else:
                if city_ctx and content.strip():
                    parse_school_list(entries, content, city_ctx, zone, None)
            if next_city:
                city_ctx = next_city
            j += 2

    seen = set()
    uniq = []
    for e in entries:
        key = (e["city"], e["zone"], e.get("subZone"), e["schoolName"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(e)
    return uniq


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hwpx", required=True, help="인사기준 HWPX 경로")
    parser.add_argument(
        "--out",
        default="data/gyeonggi-zones-2027.json",
        help="출력 JSON 경로",
    )
    args = parser.parse_args()

    text = extract_text_from_hwpx(Path(args.hwpx))
    text, closed_names = resolve_closed_markers(text)
    idx = text.find("초등학교 인사구역 현황표")
    idx2 = text.find("유치원 인사구역 현황표")
    if idx < 0 or idx2 < 0:
        raise SystemExit("별표1 구간을 찾지 못했습니다.")
    schools = parse_zones(text[idx:idx2])
    print(f"밑줄(폐교/휴교 표기) 감지 {len(closed_names)}건, 목록에서 제외: {sorted(closed_names)}")
    by_city = Counter(e["city"] for e in schools)
    print(f"total={len(schools)}")
    for c, exp in EXPECTED.items():
        got = by_city[c]
        mark = "OK" if abs(got - exp) <= 4 else "!!"
        print(f"  {mark} {c}: {got} (exp {exp})")

    out = {
        "year": 2027,
        "source": "경기도교육공무원인사관리세부기준 67차 별표1",
        "schools": schools,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out_path)


if __name__ == "__main__":
    main()
