import type { PromotionBonusInfo } from "@/types/school";

/** 예: "접적 나 · 월0.036", "농어촌 읍 · 월0.015", "공단 · 월0.012" (바깥 괄호는 호출부에서 붙인다) */
export function promotionBonusLabel(b: PromotionBonusInfo): string {
  const grade = b.grade ? ` ${b.grade}` : "";
  return `${b.kind}${grade} · 월${b.monthly}`;
}

/** 기존 급지표/인사구역과 어긋날 때의 안내 문구 (없으면 null) */
export function promotionBonusWarning(b: PromotionBonusInfo): string | null {
  const msgs: string[] = [];
  if (b.flags?.gradeMismatch) {
    msgs.push(
      `기존 급지표(${b.flags.gradeMismatch.existing})와 승진점수표(${b.grade}) 급지가 다릅니다.`,
    );
  }
  if (b.flags?.zoneMismatch) {
    msgs.push(
      `인사구역 ${b.flags.zoneMismatch.zone}인데 ${b.kind}은(는) 보통 ${b.flags.zoneMismatch.expected} 구역입니다.`,
    );
  }
  return msgs.length ? msgs.join(" ") : null;
}
