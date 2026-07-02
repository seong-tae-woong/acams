// 시험지 초안 → @react-pdf Document 트리 빌더(순수 함수, 렌더 분리로 테스트 가능).
// 라우트(route.ts)는 데이터 로드 + 폰트 등록 + renderToBuffer만 담당.
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { createElement as h, type ReactNode } from 'react';
import { blocksToText, choiceLabel, answerDisplay, sanitizeForPdf } from './pdfContent';
import { DIFFICULTY_LABELS } from '@/lib/types/questionBank';
import type {
  TestSpec,
  MockSpec,
  QuestionContent,
  QuestionAnswer,
  TestLayout,
} from '@/lib/types/questionBank';

export type DraftPdfItem = {
  id: string;
  content: unknown;
  answer: unknown;
  explanation: unknown;
  isKiller: boolean;
  section?: number; // 모의고사 섹션 인덱스(단일 시험지는 0/undefined)
};

export interface DraftPdfOptions {
  academyName: string;
  spec: TestSpec | MockSpec; // MOCK이면 MockSpec
  items: DraftPdfItem[];
  variant: 'exam' | 'answer';
  layout?: TestLayout; // BASIC / VOCAB / MOCK
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: 40,
    paddingHorizontal: 44,
    fontFamily: 'NotoSansKR',
    fontSize: 11,
    color: '#111827',
    lineHeight: 1.5,
  },
  header: { marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#111827' },
  academy: { fontSize: 10, color: '#6b7280' },
  title: { fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 4 },
  sub: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  metaRow: { flexDirection: 'row', marginTop: 12, fontSize: 10, color: '#374151' },
  metaCell: { marginRight: 28 },
  q: { marginTop: 14 },
  qStem: { fontSize: 12 },
  qNum: { fontWeight: 700 },
  killer: { color: '#b91c1c', fontWeight: 700 },
  choice: { fontSize: 11, marginLeft: 14, marginTop: 3, color: '#1f2937' },
  blankRow: { flexDirection: 'row', alignItems: 'flex-end', marginLeft: 14, marginTop: 8 },
  blankLine: { borderBottomWidth: 1, borderBottomColor: '#9ca3af', width: 240, height: 12, marginLeft: 6 },
  ansRow: { marginTop: 10 },
  ansLine: { fontSize: 11 },
  ansNum: { fontWeight: 700 },
  explain: { fontSize: 10, color: '#4b5563', marginLeft: 14, marginTop: 3 },
  emptyNote: { marginTop: 60, fontSize: 12, color: '#6b7280', textAlign: 'center' },
  // VOCAB(단어시험형) — 2단 목록. 번호+지문을 위, 빈칸/정답을 아래(긴 지문도 안 깨지게)
  vocabGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  vocabItem: { width: '50%', paddingRight: 16, marginTop: 10 },
  vocabQ: { fontSize: 11, lineHeight: 1.4 },
  vocabNum: { fontWeight: 700 },
  vocabBlank: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', height: 12, marginTop: 3, marginLeft: 12 },
  vocabAnswer: { fontSize: 11, color: '#065f46', marginTop: 2, marginLeft: 12 },
  // MOCK(모의고사) — 섹션 헤더
  sectionHeader: { marginTop: 18, marginBottom: 2, paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: '#334155' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#1a2535' },
});

function examQuestion(item: DraftPdfItem, idx: number) {
  const content = (item.content ?? {}) as QuestionContent;
  const stemText = blocksToText(content.stem ?? []);
  const choices = Array.isArray(content.choices) ? content.choices : [];
  const children: ReactNode[] = [
    h(
      Text,
      { style: styles.qStem, key: 'stem' },
      h(Text, { style: styles.qNum }, `${idx + 1}. `),
      stemText,
      item.isKiller ? h(Text, { style: styles.killer, key: 'k' }, '  [고난도]') : null,
    ),
  ];
  if (choices.length > 0) {
    choices.forEach((c, ci) => {
      children.push(
        h(Text, { style: styles.choice, key: `c${ci}` }, `${choiceLabel(ci)} ${blocksToText(c)}`),
      );
    });
  } else {
    children.push(
      h(
        View,
        { style: styles.blankRow, key: 'blank' },
        h(Text, null, '답:'),
        h(View, { style: styles.blankLine }),
      ),
    );
  }
  return h(View, { style: styles.q, wrap: false, key: item.id }, ...children);
}

function answerRow(item: DraftPdfItem, idx: number) {
  const content = (item.content ?? {}) as QuestionContent;
  const answer = (item.answer ?? {}) as QuestionAnswer;
  const expl = typeof item.explanation === 'string' ? sanitizeForPdf(item.explanation) : '';
  const children: ReactNode[] = [
    h(
      Text,
      { style: styles.ansLine, key: 'a' },
      h(Text, { style: styles.ansNum }, `${idx + 1}. 정답 `),
      answerDisplay(answer, content),
    ),
  ];
  if (expl) children.push(h(Text, { style: styles.explain, key: 'e' }, `해설: ${expl}`));
  return h(View, { style: styles.ansRow, wrap: false, key: item.id }, ...children);
}

// VOCAB 레이아웃 한 칸(2단) — 지문(단어) + 빈칸(시험지) 또는 정답(정답지)
function vocabItem(item: DraftPdfItem, idx: number, isAnswer: boolean) {
  const content = (item.content ?? {}) as QuestionContent;
  const answer = (item.answer ?? {}) as QuestionAnswer;
  const stemText = blocksToText(content.stem ?? []);
  const children: ReactNode[] = [
    h(
      Text,
      { style: styles.vocabQ, key: 'q' },
      h(Text, { style: styles.vocabNum }, `${idx + 1}. `),
      stemText,
    ),
    isAnswer
      ? h(Text, { style: styles.vocabAnswer, key: 'a' }, answerDisplay(answer, content))
      : h(View, { style: styles.vocabBlank, key: 'b' }),
  ];
  return h(View, { style: styles.vocabItem, wrap: false, key: item.id }, ...children);
}

/** 시험지/정답지 PDF Document 트리를 만든다(렌더는 호출측에서). */
export function buildDraftPdfDocument(opts: DraftPdfOptions) {
  const { academyName, spec, items, variant } = opts;
  const isAnswer = variant === 'answer';
  const layout = opts.layout ?? 'BASIC';
  const isMock = layout === 'MOCK';
  const isVocab = layout === 'VOCAB';

  let titleText: string;
  let subText: string;
  if (isMock) {
    const m = spec as MockSpec;
    titleText = (m.title?.trim() || `${m.subject} 모의고사`) + (isAnswer ? ' 정답 및 해설' : '');
    subText = `${m.gradeLevel} · 총 ${items.length}문항 · ${m.sections?.length ?? 0}개 영역`;
  } else {
    const s = spec as TestSpec;
    const diffLabel = DIFFICULTY_LABELS[s.difficulty] ?? String(s.difficulty);
    titleText = `${s.subject} ${s.type}`.trim() + (isAnswer ? ' 정답 및 해설' : '');
    subText = `${s.gradeLevel} · 난이도 ${diffLabel} · 총 ${items.length}문항`;
  }

  const header = h(
    View,
    { style: styles.header },
    h(Text, { style: styles.academy }, academyName),
    h(Text, { style: styles.title }, titleText),
    h(Text, { style: styles.sub }, subText),
    !isAnswer
      ? h(
          View,
          { style: styles.metaRow },
          h(Text, { style: styles.metaCell }, '이름: __________'),
          h(Text, { style: styles.metaCell }, '날짜: __________'),
        )
      : null,
  );

  let body: ReactNode[];
  if (items.length === 0) {
    body = [h(Text, { style: styles.emptyNote, key: 'empty' }, '문항이 없습니다.')];
  } else if (isMock) {
    // 섹션별 그룹핑 + 헤더. 번호는 전역 연속(gi).
    const m = spec as MockSpec;
    const bySection = new Map<number, { item: DraftPdfItem; gi: number }[]>();
    items.forEach((it, gi) => {
      const sk = it.section ?? 0;
      const arr = bySection.get(sk) ?? [];
      arr.push({ item: it, gi });
      bySection.set(sk, arr);
    });
    body = [...bySection.keys()]
      .sort((a, b) => a - b)
      .flatMap((sk) => {
        const label = m.sections?.[sk]?.label || `영역 ${sk + 1}`;
        const rows = bySection
          .get(sk)!
          .map(({ item, gi }) => (isAnswer ? answerRow(item, gi) : examQuestion(item, gi)));
        return [
          h(
            View,
            { style: styles.sectionHeader, key: `sh${sk}`, wrap: false },
            h(Text, { style: styles.sectionTitle }, `[${sk + 1}] ${label}`),
          ),
          ...rows,
        ];
      });
  } else if (isVocab) {
    body = [
      h(
        View,
        { style: styles.vocabGrid, key: 'grid' },
        ...items.map((it, i) => vocabItem(it, i, isAnswer)),
      ),
    ];
  } else {
    body = items.map((it, i) => (isAnswer ? answerRow(it, i) : examQuestion(it, i)));
  }

  return h(Document, null, h(Page, { size: 'A4', style: styles.page }, header, ...body));
}
