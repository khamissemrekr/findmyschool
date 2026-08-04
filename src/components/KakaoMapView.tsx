"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLngPoint, Origin, School } from "@/types/school";

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (cb: () => void) => void;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        Map: new (
          container: HTMLElement,
          options: { center: KakaoLatLng; level: number },
        ) => KakaoMap;
        Marker: new (options: {
          map?: KakaoMap | KakaoRoadview;
          position: KakaoLatLng;
          title?: string;
          image?: KakaoMarkerImage;
          zIndex?: number;
        }) => KakaoMarker;
        MarkerImage: new (
          src: string,
          size: KakaoSize,
          options?: { offset?: KakaoPoint },
        ) => KakaoMarkerImage;
        CustomOverlay: new (options: {
          map?: KakaoMap | null;
          position: KakaoLatLng;
          content: HTMLElement | string;
          xAnchor?: number;
          yAnchor?: number;
          zIndex?: number;
          clickable?: boolean;
        }) => KakaoCustomOverlay;
        MapTypeControl: new () => KakaoControl;
        ZoomControl: new () => KakaoControl;
        Roadview: new (container: HTMLElement) => KakaoRoadview;
        RoadviewClient: new () => KakaoRoadviewClient;
        ControlPosition: {
          TOPRIGHT: unknown;
          RIGHT: unknown;
        };
        Size: new (w: number, h: number) => KakaoSize;
        Point: new (x: number, y: number) => KakaoPoint;
        Polyline: new (options: {
          map?: KakaoMap | null;
          path: KakaoLatLng[];
          strokeWeight?: number;
          strokeColor?: string;
          strokeOpacity?: number;
          strokeStyle?: string;
        }) => KakaoPolyline;
        event: {
          addListener: (
            target: KakaoMap | KakaoMarker | KakaoRoadview,
            type: string,
            handler: (e?: { latLng: KakaoLatLng }) => void,
          ) => void;
        };
        LatLngBounds: new () => KakaoBounds;
      };
    };
  }
}

interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}
interface KakaoMap {
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  setBounds: (bounds: KakaoBounds) => void;
  addControl: (control: KakaoControl, position: unknown) => void;
}
interface KakaoControl {
  stub?: never;
}
interface KakaoMarker {
  setMap: (map: KakaoMap | KakaoRoadview | null) => void;
}
interface KakaoCustomOverlay {
  setMap: (map: KakaoMap | null) => void;
}
interface KakaoPolyline {
  setMap: (map: KakaoMap | null) => void;
}
interface KakaoRoadview {
  setPanoId: (panoId: number, position: KakaoLatLng) => void;
  relayout: () => void;
}
interface KakaoRoadviewClient {
  getNearestPanoId: (
    position: KakaoLatLng,
    radius: number,
    callback: (panoId: number | null) => void,
  ) => void;
}
interface KakaoMarkerImage {
  stub?: never;
}
interface KakaoSize {
  stub?: never;
}
interface KakaoPoint {
  stub?: never;
}
interface KakaoBounds {
  extend: (latlng: KakaoLatLng) => void;
}

const ZONE_COLOR: Record<string, string> = {
  갑: "#1d4ed8",
  을: "#b45309",
  병: "#be123c",
};

/** 지도 라벨용: shortName → OO초 */
function schoolLabel(school: School): string {
  const base = (school.shortName || school.name)
    .replace(/\s+/g, "")
    .replace(/초등학교$/g, "")
    .replace(/분교장$/g, "");
  return `${base}초`;
}

function zonePinSvg(zone: string, selected: boolean): string {
  const color = ZONE_COLOR[zone] ?? "#334155";
  if (selected) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
      <path fill="${color}" stroke="#fff" stroke-width="2.5" d="M17 1.5C9.5 1.5 3.5 7.5 3.5 15c0 11 13.5 27 13.5 27S30.5 26 30.5 15C30.5 7.5 24.5 1.5 17 1.5z"/>
      <circle cx="17" cy="15" r="8" fill="none" stroke="#fbbf24" stroke-width="2.5"/>
      <circle cx="17" cy="15" r="5" fill="#fff"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path fill="${color}" stroke="#fff" stroke-width="2" d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 21 12 21s12-11.5 12-21C26 6.4 20.6 1 14 1z"/>
    <circle cx="14" cy="13" r="4.5" fill="#fff"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createLabelEl(
  school: School,
  selected: boolean,
  onSelect: (school: School) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "position:relative",
    "left:18px",
    "top:-30px",
    "pointer-events:auto",
    "cursor:pointer",
    "white-space:nowrap",
    "user-select:none",
  ].join(";");

  const label = document.createElement("span");
  const color = ZONE_COLOR[school.zone] ?? "#334155";
  label.textContent = schoolLabel(school);
  label.style.cssText = selected
    ? [
        "display:inline-block",
        "padding:3px 8px",
        "border-radius:6px",
        "background:#0f172a",
        "color:#fff",
        `box-shadow:0 0 0 2px ${color}`,
        "font:700 12px/1.2 Pretendard,Apple SD Gothic Neo,sans-serif",
        "letter-spacing:-0.02em",
      ].join(";")
    : [
        "display:inline-block",
        "padding:2px 6px",
        "border-radius:4px",
        "background:rgba(255,255,255,0.92)",
        "color:#0f172a",
        `border:1px solid ${color}`,
        "font:600 11px/1.2 Pretendard,Apple SD Gothic Neo,sans-serif",
        "letter-spacing:-0.02em",
        "text-shadow:0 0 2px #fff,0 0 2px #fff",
      ].join(";");

  wrap.appendChild(label);
  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(school);
  });
  return wrap;
}

function loadKakaoSdk(appKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve());
      return;
    }
    const existing = document.getElementById("kakao-map-sdk");
    if (existing) {
      existing.addEventListener("load", () => {
        window.kakao?.maps.load(() => resolve());
      });
      return;
    }
    const script = document.createElement("script");
    script.id = "kakao-map-sdk";
    script.async = true;
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.onload = () => {
      if (!window.kakao) {
        reject(new Error("카카오맵 SDK 로드 실패"));
        return;
      }
      window.kakao.maps.load(() => resolve());
    };
    script.onerror = () => reject(new Error("카카오맵 SDK 스크립트 오류"));
    document.head.appendChild(script);
  });
}

interface RouteSegment {
  path: LatLngPoint[];
  color: string;
  weight?: number;
  dashed?: boolean;
}

interface RoutePin {
  lat: number;
  lng: number;
  label: string;
  kind: "board" | "alight";
}

interface Props {
  schools: School[];
  origin: Origin | null;
  selectedId: string | null;
  /** 지도에 그릴 경로 구간들 (자동차 1개 또는 대중교통 구간별) */
  routeSegments?: RouteSegment[] | null;
  /** 승차/하차 정류장 등 */
  routePins?: RoutePin[] | null;
  onSelect: (school: School) => void;
  onMapClick: (origin: Origin) => void;
}

function createRoutePinEl(pin: RoutePin): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "transform:translate(-50%,-100%);pointer-events:none;white-space:nowrap;";
  const badge = document.createElement("span");
  const isBoard = pin.kind === "board";
  badge.textContent = pin.label;
  badge.style.cssText = [
    "display:inline-block",
    "padding:3px 7px",
    "border-radius:6px",
    isBoard ? "background:#0284c7" : "background:#7c3aed",
    "color:#fff",
    "font:600 10px/1.2 Pretendard,Apple SD Gothic Neo,sans-serif",
    "box-shadow:0 1px 4px rgba(0,0,0,.25)",
  ].join(";");
  const tip = document.createElement("div");
  tip.style.cssText = [
    "width:0",
    "height:0",
    "margin:0 auto",
    "border-left:5px solid transparent",
    "border-right:5px solid transparent",
    isBoard ? "border-top:6px solid #0284c7" : "border-top:6px solid #7c3aed",
  ].join(";");
  wrap.appendChild(badge);
  wrap.appendChild(tip);
  return wrap;
}

export function KakaoMapView({
  schools,
  origin,
  selectedId,
  routeSegments,
  routePins,
  onSelect,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const roadviewRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const roadviewInstanceRef = useRef<KakaoRoadview | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const labelsRef = useRef<KakaoCustomOverlay[]>([]);
  const routePinOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const originMarkerRef = useRef<KakaoMarker | null>(null);
  const polylinesRef = useRef<KakaoPolyline[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [roadviewOpen, setRoadviewOpen] = useState(false);
  const [roadviewStatus, setRoadviewStatus] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >("idle");

  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  const hasRoute = Boolean(routeSegments?.some((s) => s.path.length > 0));

  const selectedSchool = useMemo(
    () => schools.find((s) => s.id === selectedId) ?? null,
    [schools, selectedId],
  );

  // 학교 바뀌면 로드뷰 닫기
  useEffect(() => {
    setRoadviewOpen(false);
    setRoadviewStatus("idle");
  }, [selectedId]);

  useEffect(() => {
    if (!appKey || !containerRef.current) return;
    let cancelled = false;

    loadKakaoSdk(appKey)
      .then(() => {
        if (cancelled || !containerRef.current || !window.kakao) return;
        const kakao = window.kakao;
        const center = new kakao.maps.LatLng(37.4138, 127.5183);
        const map = new kakao.maps.Map(containerRef.current, {
          center,
          level: 11,
        });
        mapRef.current = map;

        map.addControl(
          new kakao.maps.MapTypeControl(),
          kakao.maps.ControlPosition.TOPRIGHT,
        );
        map.addControl(
          new kakao.maps.ZoomControl(),
          kakao.maps.ControlPosition.RIGHT,
        );

        kakao.maps.event.addListener(map, "click", (mouseEvent) => {
          const latlng = mouseEvent?.latLng;
          if (!latlng) return;
          onMapClick({
            lat: latlng.getLat(),
            lng: latlng.getLng(),
            label: `지도 클릭 (${latlng.getLat().toFixed(5)}, ${latlng.getLng().toFixed(5)})`,
          });
        });
        setMapReady(true);
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
    };
  }, [appKey, onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    const kakao = window.kakao;
    if (!map || !kakao || !mapReady) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    labelsRef.current.forEach((o) => o.setMap(null));
    labelsRef.current = [];

    const withCoords = schools.filter((s) => s.lat != null && s.lng != null);
    const bounds = new kakao.maps.LatLngBounds();
    let hasBound = false;

    for (const school of withCoords) {
      const selected = school.id === selectedId;
      const pos = new kakao.maps.LatLng(school.lat!, school.lng!);
      const pinW = selected ? 34 : 28;
      const pinH = selected ? 44 : 36;
      const image = new kakao.maps.MarkerImage(
        zonePinSvg(school.zone, selected),
        new kakao.maps.Size(pinW, pinH),
        { offset: new kakao.maps.Point(pinW / 2, pinH) },
      );
      const marker = new kakao.maps.Marker({
        map,
        position: pos,
        title: school.name,
        image,
        zIndex: selected ? 10 : 1,
      });
      kakao.maps.event.addListener(marker, "click", () => onSelect(school));
      markersRef.current.push(marker);

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: pos,
        content: createLabelEl(school, selected, onSelect),
        xAnchor: 0,
        yAnchor: 1,
        zIndex: selected ? 11 : 2,
        clickable: true,
      });
      labelsRef.current.push(overlay);

      if (!hasRoute) {
        bounds.extend(pos);
        hasBound = true;
      }
    }

    if (origin) {
      const pos = new kakao.maps.LatLng(origin.lat, origin.lng);
      if (originMarkerRef.current) originMarkerRef.current.setMap(null);
      originMarkerRef.current = new kakao.maps.Marker({
        map,
        position: pos,
        title: origin.label,
        zIndex: 5,
      });
      if (!hasRoute) {
        bounds.extend(pos);
        hasBound = true;
      }
    }

    if (hasRoute && routeSegments) {
      for (const seg of routeSegments) {
        for (const p of seg.path) {
          bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
        }
      }
      map.setBounds(bounds);
      return;
    }

    if (selectedId) {
      const selected = withCoords.find((s) => s.id === selectedId);
      if (selected) {
        map.setCenter(new kakao.maps.LatLng(selected.lat!, selected.lng!));
        map.setLevel(6);
        return;
      }
    }

    if (hasBound) {
      map.setBounds(bounds);
    }
  }, [schools, origin, selectedId, onSelect, hasRoute, routeSegments, mapReady]);

  // 승차/하차 정류장 핀
  useEffect(() => {
    const map = mapRef.current;
    const kakao = window.kakao;
    if (!map || !kakao || !mapReady) return;

    routePinOverlaysRef.current.forEach((o) => o.setMap(null));
    routePinOverlaysRef.current = [];

    if (!routePins?.length) return;

    for (const pin of routePins) {
      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(pin.lat, pin.lng),
        content: createRoutePinEl(pin),
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: 20,
      });
      routePinOverlaysRef.current.push(overlay);
    }

    return () => {
      routePinOverlaysRef.current.forEach((o) => o.setMap(null));
      routePinOverlaysRef.current = [];
    };
  }, [routePins, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const kakao = window.kakao;
    if (!map || !kakao || !mapReady) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!routeSegments?.length) return;

    for (const seg of routeSegments) {
      if (seg.path.length < 2) continue;
      const path = seg.path.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
      const line = new kakao.maps.Polyline({
        map,
        path,
        strokeWeight: seg.weight ?? 6,
        strokeColor: seg.color,
        strokeOpacity: 0.9,
        strokeStyle: seg.dashed ? "shortdash" : "solid",
      });
      polylinesRef.current.push(line);
    }

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routeSegments, mapReady]);

  // 카카오 로드뷰 (스트리트뷰 대응)
  useEffect(() => {
    if (!roadviewOpen || !selectedSchool?.lat || !selectedSchool?.lng) {
      roadviewInstanceRef.current = null;
      return;
    }
    if (!window.kakao || !roadviewRef.current) return;

    const kakao = window.kakao;
    setRoadviewStatus("loading");

    const position = new kakao.maps.LatLng(
      selectedSchool.lat,
      selectedSchool.lng,
    );
    // 패널이 다시 마운트될 수 있으므로 매번 새로 생성
    const roadview = new kakao.maps.Roadview(roadviewRef.current);
    roadviewInstanceRef.current = roadview;

    const client = new kakao.maps.RoadviewClient();
    // 학교 좌표 기준 반경 100m 내 가장 가까운 파노라마
    client.getNearestPanoId(position, 100, (panoId) => {
      if (roadviewInstanceRef.current !== roadview) return;
      if (!panoId) {
        setRoadviewStatus("empty");
        return;
      }
      roadview.setPanoId(panoId, position);
      requestAnimationFrame(() => roadview.relayout());
      setRoadviewStatus("ready");
    });
  }, [roadviewOpen, selectedSchool]);

  if (!appKey) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-600">
        <p>
          지도를 보려면{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_KAKAO_JS_KEY</code>
          를 설정하세요. 목록과 급지 정보는 계속 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  const canRoadview =
    selectedSchool != null &&
    selectedSchool.lat != null &&
    selectedSchool.lng != null;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {canRoadview && (
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setRoadviewOpen((v) => !v)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold shadow-md ${
              roadviewOpen
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            {roadviewOpen ? "로드뷰 닫기" : "로드뷰 보기"}
          </button>
        </div>
      )}

      {roadviewOpen && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex h-[42%] flex-col border-t border-slate-300 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.12)]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
            <p className="truncate text-xs font-medium text-slate-700">
              로드뷰 · {selectedSchool?.name}
            </p>
            <button
              type="button"
              onClick={() => setRoadviewOpen(false)}
              className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
            >
              닫기
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={roadviewRef} className="h-full w-full" />
            {roadviewStatus === "loading" && (
              <p className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-slate-500">
                로드뷰 불러오는 중…
              </p>
            )}
            {roadviewStatus === "empty" && (
              <p className="absolute inset-0 flex items-center justify-center bg-white text-sm text-slate-500">
                이 학교 근처에는 로드뷰가 없습니다.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
