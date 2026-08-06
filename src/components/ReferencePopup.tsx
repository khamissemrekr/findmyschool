"use client";

import { InfoPopup } from "@/components/InfoPopup";

interface Props {
  onClose: () => void;
}

export function ReferencePopup({ onClose }: Props) {
  return (
    <InfoPopup titleId="reference-popup-title" title="참고자료" onClose={onClose}>
      <dl className="space-y-2 text-xs text-slate-600">
        <div>
          <dt className="font-medium text-slate-800">급지</dt>
          <dd>
            <a
              href="https://www.goe.go.kr/goe/na/ntt/selectNttInfo.do?bbsId=2675&nttSn=2361915&mi=10961"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 underline"
            >
              2027 경기도교육공무원인사관리세부기준
            </a>{" "}
            별표1
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">지역별 커트라인</dt>
          <dd>
            2022·2023.3.1.자 초등교사 정기전보 지역별 커트라인, 2024·2025·2026.3.1.자
            초등교사 청간전보 지역별 커트라인 (경기도교육청)
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">좌표</dt>
          <dd>OpenStreetMap</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">경로</dt>
          <dd>카카오(자동차·대중교통)</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">사용 API</dt>
          <dd>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>카카오맵 JS SDK — 지도 표시</li>
              <li>카카오 로컬 API — 주소/키워드 검색</li>
              <li>카카오모빌리티 길찾기 API — 자동차 경로</li>
              <li>카카오맵 대중교통 길찾기 API — 버스·지하철 경로</li>
              <li>OSRM — 정류장 접근 도보 구간</li>
              <li>NEIS 학급운영정보 Open API — 학급·학생 수</li>
              <li>학교알리미 Open API — 학급·학생 수 보강</li>
            </ul>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">연구학교</dt>
          <dd>2026 연구학교 운영 현황(공개용).xlsx (경기도교육청)</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">선도학교</dt>
          <dd>2026년 AI·디지털 활용 선도학교 선정 결과_경기 (경기도교육청)</dd>
        </div>
      </dl>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
        공개된 자료를 활용하였으며, 민감한 개인정보나 내부자료는 사용하거나
        저장하지 않습니다. 자료에는 오류가 있을 수 있습니다. 오류 사항
        발견시 제보해주시면 반영하겠습니다.
      </p>
    </InfoPopup>
  );
}
