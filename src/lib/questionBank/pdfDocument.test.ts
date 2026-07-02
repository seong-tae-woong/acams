import { describe, it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildDraftPdfDocument, type DraftPdfItem } from './pdfDocument';
import { ensureQuestionBankFonts } from './pdfFont';
import type { TestSpec, MockSpec } from '@/lib/types/questionBank';

// 실제 렌더까지 수행하는 스모크 테스트 — 폰트 로드·createElement 트리·PDF 바이트 생성 검증.
const spec: TestSpec = { subject: '영어', gradeLevel: '중3', type: '어법', difficulty: 4, count: 2 };

const items: DraftPdfItem[] = [
  {
    id: 'i1',
    content: {
      stem: [{ type: 'text', text: '다음 중 자동사는?' }],
      choices: [[{ type: 'text', text: 'run' }], [{ type: 'text', text: 'raise' }]],
    },
    answer: { kind: 'choice', index: 0 },
    explanation: 'run은 목적어가 필요 없는 자동사',
    isKiller: false,
  },
  {
    id: 'i2',
    content: { stem: [{ type: 'text', text: '빈칸에 알맞은 말을 쓰시오.' }] },
    answer: { kind: 'text', value: 'went' },
    explanation: null,
    isKiller: true,
  },
];

async function renderPdf(variant: 'exam' | 'answer', its: DraftPdfItem[] = items): Promise<Buffer> {
  ensureQuestionBankFonts();
  return renderToBuffer(buildDraftPdfDocument({ academyName: '테스트학원', spec, items: its, variant }));
}

function isPdf(buf: Buffer): boolean {
  return buf.length > 1000 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
}

describe('buildDraftPdfDocument (render smoke)', () => {
  it('시험지(exam) — 유효한 PDF 생성', async () => {
    expect(isPdf(await renderPdf('exam'))).toBe(true);
  }, 20000);

  it('정답지(answer) — 유효한 PDF 생성', async () => {
    expect(isPdf(await renderPdf('answer'))).toBe(true);
  }, 20000);

  it('문항 0개 — 크래시 없이 PDF 생성', async () => {
    expect(isPdf(await renderPdf('exam', []))).toBe(true);
  }, 20000);
});

const vocabItems: DraftPdfItem[] = [
  { id: 'v1', content: { stem: [{ type: 'text', text: 'diligent' }] }, answer: { kind: 'text', value: '부지런한' }, explanation: null, isKiller: false },
  { id: 'v2', content: { stem: [{ type: 'text', text: 'arrive' }] }, answer: { kind: 'text', value: '도착하다' }, explanation: null, isKiller: false },
];

describe('buildDraftPdfDocument — VOCAB(단어시험형) 레이아웃', () => {
  it('단어시험 시험지(2단 빈칸) — 유효한 PDF', async () => {
    ensureQuestionBankFonts();
    const buf = await renderToBuffer(
      buildDraftPdfDocument({ academyName: '테스트학원', spec, items: vocabItems, variant: 'exam', layout: 'VOCAB' }),
    );
    expect(isPdf(buf)).toBe(true);
  }, 20000);

  it('단어시험 정답지(뜻 표시) — 유효한 PDF', async () => {
    ensureQuestionBankFonts();
    const buf = await renderToBuffer(
      buildDraftPdfDocument({ academyName: '테스트학원', spec, items: vocabItems, variant: 'answer', layout: 'VOCAB' }),
    );
    expect(isPdf(buf)).toBe(true);
  }, 20000);
});

const mockSpec: MockSpec = {
  subject: '영어',
  gradeLevel: '고1',
  title: '3월 모의고사',
  sections: [
    { label: '어법', type: '어법', count: 1, difficulty: 3 },
    { label: '독해', type: '독해', count: 1, difficulty: 4 },
  ],
};
const mockItems: DraftPdfItem[] = [
  {
    id: 'm0',
    section: 0,
    content: { stem: [{ type: 'text', text: '어법 문항' }], choices: [[{ type: 'text', text: 'a' }], [{ type: 'text', text: 'b' }]] },
    answer: { kind: 'choice', index: 0 },
    explanation: '해설1',
    isKiller: false,
  },
  {
    id: 'm1',
    section: 1,
    content: { stem: [{ type: 'text', text: '독해 문항' }], choices: [[{ type: 'text', text: 'c' }], [{ type: 'text', text: 'd' }]] },
    answer: { kind: 'choice', index: 1 },
    explanation: '해설2',
    isKiller: false,
  },
];

describe('buildDraftPdfDocument — MOCK(모의고사) 레이아웃', () => {
  it('모의고사 시험지(섹션 구분) — 유효한 PDF', async () => {
    ensureQuestionBankFonts();
    const buf = await renderToBuffer(
      buildDraftPdfDocument({ academyName: '테스트학원', spec: mockSpec, items: mockItems, variant: 'exam', layout: 'MOCK' }),
    );
    expect(isPdf(buf)).toBe(true);
  }, 20000);

  it('모의고사 정답지 — 유효한 PDF', async () => {
    ensureQuestionBankFonts();
    const buf = await renderToBuffer(
      buildDraftPdfDocument({ academyName: '테스트학원', spec: mockSpec, items: mockItems, variant: 'answer', layout: 'MOCK' }),
    );
    expect(isPdf(buf)).toBe(true);
  }, 20000);
});
