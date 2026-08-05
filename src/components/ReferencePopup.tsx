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
          <dd>2027 경기도 인사관리세부기준 별표1</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">좌표</dt>
          <dd>OpenStreetMap</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">경로</dt>
          <dd>카카오(자동차·대중교통)</dd>
        </div>
      </dl>
    </InfoPopup>
  );
}
