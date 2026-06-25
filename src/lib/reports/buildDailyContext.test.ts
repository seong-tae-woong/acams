import { describe, it, expect } from 'vitest';
import {
  formatDateLabel,
  formatClinicFeedback,
  shapeDailyContext,
  hasDailyData,
  type ShapeDailyInput,
} from './buildDailyContext';
import { renderBody } from './tokens';

const base: ShapeDailyInput = {
  studentId: 's1',
  studentName: '김민준',
  grade: 2,
  className: '중2A',
  date: '2026-06-25',
  sessionNote: '관계대명사 that/which',
  assignmentMemos: ['p.42-45'],
  attitude: 4,
  attitudeReason: '집중 잘함',
  homeworkDone: true,
  comment: '발표 적극적',
  exams: [{ name: '단어시험', totalScore: 100 }],
  examScore: 80,
  clinicFeedback: '• 단어 암기: 부족',
  passThreshold: 70,
};

describe('formatDateLabel', () => {
  it('UTC 기준 요일을 붙인다 (1970-01-01 = 목)', () => {
    expect(formatDateLabel('1970-01-01')).toBe('1970-01-01 (목)');
  });
  it('형식을 유지한다', () => {
    expect(formatDateLabel('2026-06-25')).toMatch(/^2026-06-25 \([일월화수목금토]\)$/);
  });
  it('잘못된 날짜는 원문 반환', () => {
    expect(formatDateLabel('not-a-date')).toBe('not-a-date');
  });
});

describe('formatClinicFeedback', () => {
  const labelOf = (tid: string, iid: string): string | undefined =>
    ((({ t1: { i1: '단어 암기', i2: '독해' } } as Record<string, Record<string, string>>)[tid]) ?? {})[iid];

  it('코멘트 있는 항목만 "• 라벨: 코멘트"로 결합', () => {
    const out = formatClinicFeedback(
      [{ templateId: 't1', checks: [
        { itemId: 'i1', checked: true, comment: '3회 미흡' },
        { itemId: 'i2', checked: true }, // 코멘트 없음 → 제외
      ], customItems: [], hiddenItemIds: [] }],
      labelOf,
    );
    expect(out).toBe('• 단어 암기: 3회 미흡');
  });

  it('숨긴 항목 제외, 커스텀은 자체 라벨 사용, 다중 결과 결합', () => {
    const out = formatClinicFeedback(
      [
        { templateId: 't1', checks: [{ itemId: 'i1', checked: false, comment: '보강 필요' }], customItems: [{ id: 'c1', label: '오답노트', checked: true, comment: '작성 양호' }], hiddenItemIds: [] },
        { templateId: 't1', checks: [{ itemId: 'i2', checked: true, comment: '숨김대상' }], customItems: [], hiddenItemIds: ['i2'] },
      ],
      labelOf,
    );
    expect(out).toBe('• 단어 암기: 보강 필요\n• 오답노트: 작성 양호');
  });

  it('양식에서 삭제돼 라벨 없는 항목은 제외', () => {
    const out = formatClinicFeedback(
      [{ templateId: 't1', checks: [{ itemId: 'gone', checked: true, comment: '있음' }], customItems: [], hiddenItemIds: [] }],
      labelOf,
    );
    expect(out).toBe('-');
  });

  it('코멘트가 하나도 없으면 "-"', () => {
    expect(formatClinicFeedback([{ templateId: 't1', checks: [{ itemId: 'i1', checked: true }], customItems: [], hiddenItemIds: [] }], labelOf)).toBe('-');
    expect(formatClinicFeedback([], labelOf)).toBe('-');
  });
});

describe('shapeDailyContext', () => {
  it('전 항목 존재 → 컨텍스트 채움', () => {
    const { context } = shapeDailyContext(base);
    expect(context.과제수행).toBe('완료');
    expect(context.시험명).toBe('단어시험');
    expect(context.시험점수).toBe(80);
    expect(context.백분율).toBe(80);
    expect(context.날짜).toMatch(/^2026-06-25 \(.\)$/);
  });

  it('homeworkDone false/null → 미완료/-', () => {
    expect(shapeDailyContext({ ...base, homeworkDone: false }).context.과제수행).toBe('미완료');
    expect(shapeDailyContext({ ...base, homeworkDone: null }).context.과제수행).toBe('-');
  });

  it('시험 여러 개 → 시험명 결합, 만점·백분율은 대표(첫) 시험', () => {
    const { context } = shapeDailyContext({
      ...base,
      exams: [{ name: '단어', totalScore: 50 }, { name: '문법', totalScore: 100 }],
      examScore: 40,
    });
    expect(context.시험명).toBe('단어, 문법');
    expect(context.만점).toBe(50);
    expect(context.백분율).toBe(80); // 40/50
  });

  it('과제 메모 여러 개 → 줄바꿈 결합, 없으면 미포함', () => {
    expect(shapeDailyContext({ ...base, assignmentMemos: ['a', 'b'] }).context.과제내용).toBe('a\nb');
    expect(shapeDailyContext({ ...base, assignmentMemos: [] }).raw.assignmentMemo).toBeNull();
  });
});

describe('renderBody로 DAILY 토큰 치환', () => {
  it('데이터 없는 토큰은 "-"로 치환 (원문 노출 안 함)', () => {
    const { context } = shapeDailyContext({ ...base, sessionNote: null, comment: null });
    expect(renderBody('수업: {{수업내용}} / 코멘트: {{코멘트}}', context)).toBe('수업: - / 코멘트: -');
  });

  it('시험 없으면 시험 토큰·합격/불합격 모두 "-"', () => {
    const { context } = shapeDailyContext({ ...base, exams: [], examScore: null });
    expect(renderBody('{{시험명}} {{시험점수}} {{합격/불합격}}', context)).toBe('- - -');
  });

  it('합격/불합격: 백분율 ≥ 임계 → 합격, 미만 → 불합격', () => {
    expect(renderBody('{{합격/불합격}}', shapeDailyContext(base).context)).toBe('합격'); // 80 ≥ 70
    expect(renderBody('{{합격/불합격}}', shapeDailyContext({ ...base, examScore: 60 }).context)).toBe('불합격'); // 60 < 70
  });

  it('태도·날짜 정상 치환', () => {
    const { context } = shapeDailyContext(base);
    expect(renderBody('태도 {{태도점수}}점', context)).toBe('태도 4점');
    expect(renderBody('{{날짜}}', context)).toMatch(/^2026-06-25 \(.\)$/);
  });
});

describe('hasDailyData', () => {
  const emptyRaw = shapeDailyContext({
    ...base,
    sessionNote: null, assignmentMemos: [], attitude: null, attitudeReason: null,
    homeworkDone: null, comment: null, exams: [], examScore: null, clinicFeedback: '-',
  }).raw;

  it('전부 비면 false', () => {
    expect(hasDailyData(emptyRaw)).toBe(false);
  });

  it('하나라도 있으면 true', () => {
    expect(hasDailyData({ ...emptyRaw, sessionNote: '수업함' })).toBe(true);
    expect(hasDailyData({ ...emptyRaw, attitude: 3 })).toBe(true);
    expect(hasDailyData({ ...emptyRaw, homeworkDone: false })).toBe(true);
    expect(hasDailyData({ ...emptyRaw, clinicFeedback: '• 단어: 부족' })).toBe(true);
  });

  it('clinicFeedback "-"는 빈 것으로 취급', () => {
    expect(hasDailyData({ ...emptyRaw, clinicFeedback: '-' })).toBe(false);
  });
});
