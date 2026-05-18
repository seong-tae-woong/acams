// 인강 강의 목록 — 페이지/탭/모달 공용 타입·상수

// 무한 스크롤 윈도잉 단위 (한 번에 늘려서 렌더할 항목 수)
export const PAGE_SIZE = 10;

export type Lecture = {
  id: string;
  title: string;
  subjects: string[];
  levels: string[];
  targetGrades: string[];
  etcTags: string[];
  duration: string;
  status: 'DRAFT' | 'PUBLISHED';
  teacher?: { name: string } | null;
  seriesId: string | null;
  episodeNumber: number | null;
  orderIndex: number;
};

export type AcademyTag = { id: string; label: string; tagType: string };

export type Series = {
  id: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED';
  _count: { lectures: number };
};

export type LectureDetail = Lecture & {
  description: string;
  videoUrl: string | null;
  cfVideoId: string | null;
  teacherId: string | null;
};
// Lecture 타입에 이미 seriesId, episodeNumber, etcTags가 있으므로 LectureDetail은 그대로 사용

export type SeriesDetail = Series & { orderIndex: number };
