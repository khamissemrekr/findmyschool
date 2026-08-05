"use client";

import { InfoPopup } from "@/components/InfoPopup";

interface Props {
  onClose: () => void;
}

export function ContactPopup({ onClose }: Props) {
  return (
    <InfoPopup titleId="contact-popup-title" title="문의/오류 제보" onClose={onClose}>
      <p className="text-xs text-slate-600">
        <a
          href="mailto:khami@ssem.re.kr"
          className="text-emerald-800 underline underline-offset-2"
        >
          khami@ssem.re.kr
        </a>
        로 연락 주세요.
      </p>
    </InfoPopup>
  );
}
