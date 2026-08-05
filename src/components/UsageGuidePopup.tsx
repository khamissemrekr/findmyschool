"use client";

import { InfoPopup } from "@/components/InfoPopup";

interface Props {
  onClose: () => void;
}

const SECTIONS = [
  {
    heading: "1. 내 출발지 설정하기",
    body: '왼쪽 상단 검색창에 현재 살고 있는 곳(아파트명, 지번 등)을 입력하면 후보 목록이 뜹니다. 원하는 곳을 클릭하면 출발지로 지정됩니다. 지도를 직접 클릭해서 출발지를 바꿀 수도 있습니다. 출발지를 자주 바꾸고 싶지 않다면 검색창 옆 "고정" 토글을 켜두세요. 켜두면 지도를 클릭해도 출발지가 바뀌지 않고, 다음에 접속했을 때도 그대로 유지됩니다.',
  },
  {
    heading: "2. 지역·급지 필터링",
    body: "시·군 드롭다운에서 원하는 지역을 고르면 그 지역 학교들이 목록과 지도에 표시됩니다. 급지 드롭다운(전체/갑/을/병)으로 원하는 급지만 골라볼 수 있습니다.",
  },
  {
    heading: "3. 커트라인 확인",
    body: '지역을 고르면 왼쪽에 최근 몇 년간의 청간전보 커트라인 표가 자동으로 뜹니다. 급지별로 색이 다르며, 숫자 커트라인이 없는 경우 "전원 수용", "신규" 같은 상태로 표시됩니다.',
  },
  {
    heading: "4. 학교 목록 보기 & 정렬",
    body: '목록은 기본적으로 출발지 기준 가까운 순으로 나옵니다. 정렬 기준을 직선거리/자동차/대중교통/학급수/학교명순으로 바꿀 수 있고, "경로 조회" 버튼을 누르면 가까운 학교들의 실제 자동차·대중교통 소요시간을 한 번에 불러옵니다.',
  },
  {
    heading: "5. 학교 상세 정보 보기",
    body: "목록이나 지도에서 학교를 클릭하면 가운데 상세 패널이 열립니다. 주소, 학급 수, 학생 수, 교원 현황, 홈페이지, 전화번호를 확인할 수 있고, 자동차/대중교통 버튼으로 경로를 지도에 그려볼 수 있습니다. 대중교통은 버스 우선/지하철 우선으로 세부 선택도 가능하며, 요금·환승 정보와 단계별 이동 경로(도보→버스→지하철 등)까지 보여줍니다.",
  },
  {
    heading: "6. 지도 활용",
    body: '학교 마커는 급지별로 색이 다르고, 선택한 학교는 크게 강조됩니다. 경로를 조회하면 지도 위에 실제 이동 경로(자동차는 초록 선, 대중교통은 구간별 색)가 그려집니다. 학교를 선택하면 "로드뷰 보기" 버튼으로 학교 주변 로드뷰도 열어볼 수 있습니다.',
  },
  {
    heading: "7. 참고자료",
    body: '사이드바 하단 "참고자료" 메뉴를 누르면 급지 기준, 좌표·경로 출처를 확인할 수 있습니다.',
  },
];

export function UsageGuidePopup({ onClose }: Props) {
  return (
    <InfoPopup
      titleId="usage-guide-popup-title"
      title="사용방법"
      onClose={onClose}
      widthClassName="max-w-lg"
    >
      <div className="space-y-3 text-xs leading-relaxed text-slate-600">
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <h3 className="mb-1 font-medium text-slate-800">
              {section.heading}
            </h3>
            <p>{section.body}</p>
          </div>
        ))}
      </div>
    </InfoPopup>
  );
}
