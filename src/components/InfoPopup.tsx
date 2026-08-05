"use client";

interface Props {
  titleId: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
}

export function InfoPopup({
  titleId,
  title,
  onClose,
  children,
  widthClassName = "max-w-sm",
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${widthClassName} max-h-[80vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 id={titleId} className="text-sm font-semibold text-slate-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            닫기
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
