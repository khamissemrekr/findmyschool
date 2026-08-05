"use client";

interface Props {
  onClose: () => void;
}

export function ReferencePopup({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reference-popup-title"
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2
            id="reference-popup-title"
            className="text-sm font-semibold text-slate-800"
          >
            참고자료
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            닫기
          </button>
        </div>

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

        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          문의/오류제보:{" "}
          <a
            href="mailto:khami@ssem.re.kr"
            className="text-emerald-800 underline underline-offset-2"
          >
            khami@ssem.re.kr
          </a>
        </p>
      </div>
    </div>
  );
}
