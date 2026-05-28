// 인강 영상 출처 판별 + examCond 강제 변환 공용 helper.
// UI 가드(CondContent), 서버 가드(quizzes PUT/PATCH), 마이그레이션 스크립트가 모두 같은 규칙을 쓰도록 한 곳에 정의.
//
// 규칙:
// - cfVideoId가 있으면 Cloudflare Stream으로 간주 (재생 경로 `cfVideoId ?? videoUrl`와 동일한 precedence).
// - cfVideoId가 없고 videoUrl이 있으면 YouTube (또는 외부 임베드).
// - 둘 다 없으면 DRAFT 강의 — YouTube 아님 (시험 출제 자체가 의미 없음, default 동작 유지).
//
// YouTube는 시청률 추적이 불가하므로 examCond='after100'을 'anytime'으로 강제.

export type LectureVideoFields = {
  cfVideoId: string | null;
  videoUrl: string | null;
};

export function isYouTubeLecture(lec: LectureVideoFields): boolean {
  return lec.cfVideoId === null && lec.videoUrl !== null;
}

export type ExamCond = 'after100' | 'anytime';

export function coerceExamCond(lec: LectureVideoFields, examCond: string): ExamCond {
  const normalized: ExamCond = examCond === 'anytime' ? 'anytime' : 'after100';
  if (isYouTubeLecture(lec) && normalized === 'after100') return 'anytime';
  return normalized;
}
