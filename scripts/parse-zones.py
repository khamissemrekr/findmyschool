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


def extract_text_from_hwpx(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        raw = zf.read("Contents/section0.xml").decode("utf-8", "ignore")
    texts = re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", raw)
    parts = [html.unescape(re.sub(r"<[^>]+>", "", t)) for t in texts]
    return " ".join(parts)


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
        if main:
            e = make(city, zone, sub, main, False)
            if e:
                entries.append(e)
        for b in branches:
            for bb in re.split(r"[,、]", b):
                bb = re.sub(r"\s+", "", bb.strip())
                if bb:
                    e = make(city, zone, sub, bb, True)
                    if e:
                        entries.append(e)
        if not main and not branches:
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
    idx = text.find("초등학교 인사구역 현황표")
    idx2 = text.find("유치원 인사구역 현황표")
    if idx < 0 or idx2 < 0:
        raise SystemExit("별표1 구간을 찾지 못했습니다.")
    schools = parse_zones(text[idx:idx2])
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
