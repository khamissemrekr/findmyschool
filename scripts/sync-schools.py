#!/usr/bin/env python3
"""급지 JSON + OSM(+선택 NEIS/Kakao)으로 data/schools.json 생성."""

from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ctx = ssl._create_unverified_context()

CITY_BBOX = {
    "수원": (37.23, 37.35, 126.92, 127.10),
    "성남": (37.35, 37.48, 127.05, 127.22),
    "의정부": (37.68, 37.80, 127.00, 127.15),
    "안양": (37.36, 37.45, 126.88, 127.02),
    "과천": (37.40, 37.47, 126.98, 127.05),
    "부천": (37.44, 37.55, 126.73, 126.85),
    "광명": (37.42, 37.50, 126.82, 126.92),
    "동두천": (37.85, 37.95, 127.02, 127.12),
    "양주": (37.70, 37.95, 126.90, 127.20),
    "안산": (37.28, 37.38, 126.70, 126.95),
    "평택": (36.95, 37.15, 126.85, 127.20),
    "군포": (37.32, 37.40, 126.90, 127.00),
    "의왕": (37.32, 37.42, 126.95, 127.08),
    "고양": (37.58, 37.72, 126.70, 126.95),
    "구리": (37.58, 37.65, 127.10, 127.18),
    "남양주": (37.55, 37.80, 127.10, 127.40),
    "여주": (37.20, 37.40, 127.50, 127.75),
    "화성": (37.05, 37.35, 126.70, 127.15),
    "오산": (37.12, 37.20, 127.00, 127.12),
    "파주": (37.65, 37.95, 126.60, 126.95),
    "광주": (37.35, 37.50, 127.20, 127.40),
    "하남": (37.48, 37.58, 127.15, 127.30),
    "연천": (37.95, 38.20, 126.85, 127.20),
    "포천": (37.75, 38.10, 127.10, 127.40),
    "가평": (37.70, 38.00, 127.30, 127.60),
    "양평": (37.40, 37.65, 127.35, 127.70),
    "이천": (37.15, 37.35, 127.35, 127.55),
    "용인": (37.20, 37.40, 127.05, 127.35),
    "안성": (36.95, 37.15, 127.15, 127.45),
    "김포": (37.55, 37.75, 126.55, 126.80),
    "시흥": (37.35, 37.50, 126.70, 126.90),
}


def normalize_tel(tel: str | None) -> str | None:
    """OSM/NEIS 원본은 국제전화 코드, 괄호, 하이픈 누락, 내선 병기 등 형식이 제각각 —
    지역번호-국번-번호(0XX-XXX(X)-XXXX) 형식으로 정규화."""
    if not tel:
        return tel
    t = tel.strip()
    t = re.sub(r"^\+?82[-\s]?(?=\d)", "0", t)  # 국제전화 코드 제거
    t = re.sub(r"[()]", "", t)  # 괄호 제거: (031) 391-0166
    parts = t.split()
    if len(parts) > 1 and all(re.match(r"^0\d", p) for p in parts):
        t = parts[0]  # 공백으로 나열된 복수 번호는 첫 번호만 사용
    t = t.split(",")[0].strip()  # 쉼표 뒤 내선/추가회선 표기 제거
    t = re.sub(r"\s*-\s*", "-", t)
    t = re.sub(r"\s+", "", t)

    digits = t.replace("-", "")
    if not digits.isdigit():
        return t

    if digits.startswith("02"):
        area, rest = digits[:2], digits[2:]
    elif re.match(r"^050\d", digits):
        area, rest = digits[:4], digits[4:]
    else:
        area, rest = digits[:3], digits[3:]

    if len(rest) == 8:
        mid, last = rest[:4], rest[4:]
    elif len(rest) == 7:
        mid, last = rest[:3], rest[3:]
    elif len(rest) > 4:
        mid, last = rest[:-4], rest[-4:]
    else:
        mid, last = "", rest

    if not mid:
        return f"{area}-{last}" if last else area
    return f"{area}-{mid}-{last}"


def norm_name(n: str) -> str:
    n = (n or "").strip().replace(" ", "")
    n = re.sub(r"\(.*?\)", "", n)
    for s in ["초등학교", "분교장", "분교", "초"]:
        if n.endswith(s):
            n = n[: -len(s)]
            break
    return n


def fetch_json(url: str, headers: dict | None = None):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "findmyschool/1.0"})
    with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
        return json.load(r)


def load_osm(cache: Path):
    if cache.exists():
        return json.loads(cache.read_text())["elements"]
    query = '[out:json][timeout:90];area["name"="경기도"]["admin_level"="4"]->.a;(node["amenity"="school"](area.a);way["amenity"="school"](area.a););out center tags;'
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=data,
        headers={"User-Agent": "findmyschool/1.0"},
    )
    with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
        payload = json.load(r)
    cache.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload["elements"]


def fetch_neis_all():
    """NEIS 키 없으면 페이지당 5건·동일 결과 반복이므로 KEY 필요."""
    key = os.environ.get("NEIS_API_KEY", "")
    base = (
        "https://open.neis.go.kr/hub/schoolInfo?Type=json"
        "&ATPT_OFCDC_SC_CODE=J10&SCHUL_KND_SC_NM=%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90"
        f"&pSize=100&KEY={urllib.parse.quote(key)}"
    )
    first = fetch_json(base + "&pIndex=1")
    if "schoolInfo" not in first:
        print("NEIS 응답 없음, 스킵")
        return []
    total = first["schoolInfo"][0]["head"][0]["list_total_count"]
    rows = list(first["schoolInfo"][1]["row"])
    pages = (total + 99) // 100
    for p in range(2, pages + 1):
        data = fetch_json(base + f"&pIndex={p}")
        rows.extend(data["schoolInfo"][1]["row"])
        time.sleep(0.05)
    public = [r for r in rows if r.get("FOND_SC_NM") == "공립"]
    # dedupe
    by_code = {r["SD_SCHUL_CODE"]: r for r in public}
    print("NEIS public unique", len(by_code))
    return list(by_code.values())


def kakao_geocode(address: str, key: str):
    url = "https://dapi.kakao.com/v2/local/search/address.json?" + urllib.parse.urlencode(
        {"query": address}
    )
    data = fetch_json(url, {"Authorization": f"KakaoAK {key}"})
    docs = data.get("documents") or []
    if not docs:
        return None
    return float(docs[0]["y"]), float(docs[0]["x"])


def in_city(lat, lng, city):
    b = CITY_BBOX.get(city)
    if not b:
        return True
    return b[0] <= lat <= b[1] and b[2] <= lng <= b[3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zones", default="data/gyeonggi-zones-2027.json")
    ap.add_argument("--out", default="data/schools.json")
    ap.add_argument("--osm-cache", default="/tmp/osm_schools.json")
    args = ap.parse_args()

    zones = json.loads(Path(args.zones).read_text(encoding="utf-8"))
    osm_elements = load_osm(Path(args.osm_cache))

    osm_elem = []
    for el in osm_elements:
        tags = el.get("tags") or {}
        name = tags.get("name") or tags.get("name:ko") or ""
        if not name:
            continue
        if any(x in name for x in ["고등학교", "중학교", "유치원", "대학교", "대학원"]):
            continue
        isced = str(tags.get("isced:level", ""))
        if isced in ("2", "3", "2;3"):
            continue
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None:
            continue
        osm_elem.append(
            {
                "name": name,
                "norm": norm_name(name),
                "lat": float(lat),
                "lng": float(lon),
                "website": tags.get("website") or tags.get("contact:website"),
                "phone": tags.get("phone") or tags.get("contact:phone"),
                "addr": tags.get("addr:full"),
            }
        )
    by_norm = defaultdict(list)
    for o in osm_elem:
        by_norm[o["norm"]].append(o)

    neis_rows = []
    if os.environ.get("NEIS_API_KEY"):
        try:
            neis_rows = fetch_neis_all()
        except Exception as e:
            print("NEIS fetch failed", e)

    neis_by_norm = defaultdict(list)
    for r in neis_rows:
        neis_by_norm[norm_name(r["SCHUL_NM"])].append(r)

    kakao_key = os.environ.get("KAKAO_REST_KEY", "")
    schools = []
    unmatched = []
    coords = 0

    for z in zones["schools"]:
        short = norm_name(z["schoolName"])
        cands = by_norm.get(short, []) or by_norm.get(z["city"] + short, [])
        filtered = [c for c in cands if in_city(c["lat"], c["lng"], z["city"])]
        if filtered:
            cands = filtered
        pick = cands[0] if cands else None

        neis = None
        if neis_by_norm.get(short):
            # prefer address containing city
            for cand in neis_by_norm[short]:
                if z["city"] in (cand.get("ORG_RDNMA") or ""):
                    neis = cand
                    break
            neis = neis or neis_by_norm[short][0]

        lat = pick["lat"] if pick else None
        lng = pick["lng"] if pick else None
        address = (neis or {}).get("ORG_RDNMA") or (pick or {}).get("addr")
        if lat is None and address and kakao_key:
            try:
                geo = kakao_geocode(address.strip(), kakao_key)
                if geo:
                    lat, lng = geo
                    time.sleep(0.05)
            except Exception as e:
                print("geocode fail", address, e)

        if lat is not None:
            coords += 1
        else:
            unmatched.append(z)

        if pick and ("초등" in pick["name"] or "분교" in pick["name"]):
            name = pick["name"]
        elif neis:
            name = neis["SCHUL_NM"]
        else:
            name = (
                z["schoolName"]
                if ("분교" in z["schoolName"] or z["schoolName"].endswith("초등학교"))
                else z["schoolName"] + "초등학교"
            )

        # shortName(원문)으로 id 생성 — 분교장과 본교가 norm 후 같은 id가 되지 않도록
        id_slug = re.sub(r"\s+", "", z["schoolName"])
        school = {
            "id": f"{z['city']}-{z['zone']}-{z.get('subZone') or 'x'}-{id_slug}",
            "schoolCode": (neis or {}).get("SD_SCHUL_CODE"),
            "name": name,
            "shortName": z["schoolName"],
            "address": (address or None),
            "homepage": (neis or {}).get("HMPG_ADRES") or (pick or {}).get("website"),
            "tel": normalize_tel((neis or {}).get("ORG_TELNO") or (pick or {}).get("phone")),
            "lat": lat,
            "lng": lng,
            "city": z["city"],
            "office": z["office"],
            "zone": z["zone"],
            "classCount": None,
            "studentCount": None,
            "isBranch": bool(z.get("isBranch")),
        }
        if z.get("subZone"):
            school["subZone"] = z["subZone"]
        schools.append(school)

    print("coords", coords, "/", len(schools), "unmatched", len(unmatched))
    print("unmatched by city", Counter(u["city"] for u in unmatched).most_common(8))

    out = {
        "year": 2027,
        "source": {
            "zones": zones.get("source", ""),
            "coords": "OpenStreetMap Overpass (+ optional Kakao geocode)",
            "neis": "optional NEIS_API_KEY",
        },
        "schools": schools,
    }
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", args.out)


if __name__ == "__main__":
    main()
