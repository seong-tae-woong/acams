// 학년 숫자(평면 1~12) → 초/중/고 표기.
// Student.grade·LevelTestForm.grade 공통 규칙 (1~6 초등, 7~9 중등, 10~12 고등).
export function gradeLabel(g: number): string {
  if (g >= 1 && g <= 6) return `초${g}`;
  if (g >= 7 && g <= 9) return `중${g - 6}`;
  if (g >= 10 && g <= 12) return `고${g - 9}`;
  return `${g}학년`;
}

// 양식 학년 선택용 옵션 (초1~고3 → 평면 1~12)
export const GRADE_OPTIONS: { value: number; label: string }[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ value: i + 1, label: `초${i + 1}` })),
  ...Array.from({ length: 3 }, (_, i) => ({ value: i + 7, label: `중${i + 1}` })),
  ...Array.from({ length: 3 }, (_, i) => ({ value: i + 10, label: `고${i + 1}` })),
];
