// 인강 강의 세부사항 — 탭 공용 타입·상수·헬퍼

// ─── Types ───────────────────────────────────────────────────
export type TabId = 'tags' | 'series' | 'target' | 'cond' | 'exam' | 'retry';

export type Tag = { id?: string; label: string; bg: string; color: string; border: string };
export type TagType = 'subject' | 'level' | 'grade' | 'etc';

export type Lecture = {
  id: string;
  title: string;
  subjects: string[];
  levels: string[];
  targetGrades: string[];
  etcTags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  seriesId: string | null;
  episodeNumber: number | null;
  orderIndex: number;
  cfVideoId: string | null;
  videoUrl: string | null;
};

export type Series = {
  id: string;
  title: string;
  orderIndex: number;
  status: 'DRAFT' | 'PUBLISHED';
};

// 시험 출제 타입
export type QuizOption   = { id?: string; text: string; isCorrect: boolean };
export type QuizQuestion = { id?: string; text: string; score: number; options: QuizOption[] };
export type QuizData     = { passScore: number; maxTries: number; examCond: string; questions: QuizQuestion[] } | null;

// 재응시 관리 타입
export type RetryPending = { studentId: string; student: string; lectureTitle: string; quizId: string; tries: number; maxTries: number; bestScore: number };
export type RetryHistory = { id: string; student: string; lectureTitle: string; allowedBy: string; createdAt: string; result: string; passed: boolean };

// ─── Tab config ───────────────────────────────────────────────
export const TABS: { id: TabId; label: string }[] = [
  { id: 'tags',   label: '강의 분류/태그' },
  { id: 'series', label: '시리즈 구성' },
  { id: 'target', label: '수강 대상 지정' },
  { id: 'cond',   label: '이수 조건 설정' },
  { id: 'exam',   label: '시험 출제' },
  { id: 'retry',  label: '재응시 관리' },
];

// ─── Tag styles ───────────────────────────────────────────────
export const CUSTOM_STYLE = { bg: '#F5F3FF', color: '#6D28D9', border: '#C4B5FD' };

export const SUBJECT_MAP: Record<string, Pick<Tag, 'bg' | 'color'>> = {
  '수학': { bg: '#DBEAFE', color: '#1d4ed8' },
  '영어': { bg: '#D1FAE5', color: '#065f46' },
  '국어': { bg: '#FEF3C7', color: '#92400e' },
  '과학': { bg: '#FEE2E2', color: '#991b1b' },
};
export const LEVEL_MAP: Record<string, Pick<Tag, 'bg' | 'color'>> = {
  '기초':   { bg: '#E1F5EE', color: '#065f46' },
  '심화':   { bg: '#EEEDFE', color: '#534AB7' },
  '최상위': { bg: '#FEF9C3', color: '#713f12' },
};

// ─── Helpers ─────────────────────────────────────────────────
// 학년 숫자(1~12) → 표기(초1~고3)
export function gradeLabel(g: number): string {
  if (g >= 1 && g <= 6)   return `초${g}`;
  if (g >= 7 && g <= 9)   return `중${g - 6}`;
  if (g >= 10 && g <= 12) return `고${g - 9}`;
  return `${g}학년`;
}

export function lectureTags(lec: Pick<Lecture, 'subjects' | 'levels' | 'targetGrades' | 'etcTags'>) {
  return [
    ...lec.subjects.map((s) => ({ label: s, ...(SUBJECT_MAP[s] ?? CUSTOM_STYLE) })),
    ...lec.levels.map((l) => ({ label: l, ...(LEVEL_MAP[l] ?? CUSTOM_STYLE) })),
    ...lec.targetGrades.map((g) => ({ label: g, bg: '#f1f5f9', color: '#374151' })),
    ...(lec.etcTags ?? []).map((e) => ({ label: e, ...CUSTOM_STYLE })),
  ];
}

// 시리즈 소속 강의를 episodeNumber(없으면 orderIndex) 순으로 반환
export function episodesOf(lectures: Lecture[], sid: string): Lecture[] {
  return lectures
    .filter((l) => l.seriesId === sid)
    .sort((a, b) => (a.episodeNumber ?? a.orderIndex) - (b.episodeNumber ?? b.orderIndex));
}
