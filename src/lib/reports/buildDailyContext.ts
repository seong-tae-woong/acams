// 수업(반×날짜) + 학생 → DAILY 리포트 TokenContext 빌드
// plan-eng-review D2: DB fetch(비순수)와 변환(순수)을 분리해 변환부만 단위테스트한다.
//   - buildDailyContexts : 얇은 DB fetch + 조립 (수동 검증)
//   - shapeDailyContext / formatClinicFeedback / hasDailyData / formatDateLabel : 순수 (vitest)
//
// 날짜 규약: 수업이력·시험 모두 달력날짜를 UTC 자정으로 저장(`${date}T00:00:00.000Z`).
// 그날 시험 매칭은 exams GET과 동일하게 [00:00Z, 23:59Z] 범위를 쓴다.

import { prisma } from '@/lib/db/prisma';
import type { TokenContext } from './tokens';
import type { ClinicCheck, ClinicCustomItem, ClinicTemplateItem } from '@/lib/types/lesson';

export interface DailyRaw {
  studentId: string;
  studentName: string;
  date: string; // YYYY-MM-DD
  sessionNote: string | null;
  assignmentMemo: string | null;
  attitude: number | null;
  attitudeReason: string | null;
  homeworkDone: boolean | null;
  comment: string | null;
  examName: string | null;
  examScore: number | null;
  examTotal: number | null;
  clinicFeedback: string; // "-" 또는 "• 라벨: 코멘트\n..."
}

export interface DailyContextResult {
  context: TokenContext;
  raw: DailyRaw;
}

// ── 순수 함수 (단위테스트 대상) ──────────────────────────────

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → 'YYYY-MM-DD (요일)' (저장 규약과 동일하게 UTC 기준 요일) */
export function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return date;
  return `${date} (${DOW[d.getUTCDay()]})`;
}

/** 'YYYY-MM-DD' → 'MM/DD (요일)' — 짧은 날짜 토큰({{월일}})용 */
export function formatDateLabelShort(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return date;
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd} (${DOW[d.getUTCDay()]})`;
}

interface ClinicResultLike {
  templateId: string | null; // null = 양식 없이 직접 추가 (양식항목 없이 customItems만)
  checks: ClinicCheck[];
  customItems: ClinicCustomItem[];
  hiddenItemIds: string[];
}

/**
 * 그날 학생의 클리닉 결과(양식별)에서 코멘트가 있는 항목만 "• 라벨: 코멘트" 줄로 결합.
 * - 숨긴 항목(hiddenItemIds) 제외
 * - 양식에서 삭제돼 라벨을 못 찾는 양식항목은 제외(커스텀은 자체 라벨 사용)
 * - 코멘트 있는 항목이 없으면 "-"
 */
export function formatClinicFeedback(
  results: ClinicResultLike[],
  labelOf: (templateId: string | null, itemId: string) => string | undefined,
): string {
  const lines: string[] = [];
  for (const r of results) {
    const hidden = new Set(r.hiddenItemIds ?? []);
    for (const c of r.checks ?? []) {
      if (hidden.has(c.itemId)) continue;
      const comment = (c.comment ?? '').trim();
      if (!comment) continue;
      const label = labelOf(r.templateId, c.itemId);
      if (!label) continue; // 양식에서 삭제된 항목
      lines.push(`• ${label}: ${comment}`);
    }
    for (const ci of r.customItems ?? []) {
      const comment = (ci.comment ?? '').trim();
      if (!comment) continue;
      lines.push(`• ${ci.label}: ${comment}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : '-';
}

export interface ShapeDailyInput {
  studentId: string;
  studentName: string;
  grade: number | string;
  className: string;
  date: string;
  sessionNote: string | null;
  assignmentMemos: string[]; // 그날 과제 메모들 (반 공통)
  attitude: number | null;
  attitudeReason: string | null;
  homeworkDone: boolean | null;
  comment: string | null;
  // 그날 그 반 시험들 + 이 학생 점수 (발행 시 선택된 시험으로 필터됨, 대표 = 첫)
  exams: Array<{ name: string; totalScore: number; score: number | null }>;
  clinicFeedback: string; // formatClinicFeedback 결과
  passThreshold: number;
}

/** 그날 시험들을 "• 시험명: 점수/만점" 줄로 결합 ({{시험결과}} 토큰용). 없으면 "-" */
export function formatExamResults(
  exams: Array<{ name: string; totalScore: number; score: number | null }>,
): string {
  if (exams.length === 0) return '-';
  return exams.map((e) => `• ${e.name}: ${e.score ?? '-'}/${e.totalScore}`).join('\n');
}

/** 가져온 데이터 → TokenContext + raw. 모든 DAILY 토큰 키를 항상 포함(누락 키는 토큰 원문이 노출되므로). */
export function shapeDailyContext(i: ShapeDailyInput): DailyContextResult {
  // 대표 = 선택된 첫 시험. 스칼라 토큰(시험명/시험점수/만점/백분율)은 모두 대표 기준으로 일치시켜
  // "이름은 전부, 점수는 첫 시험"이던 불일치를 제거한다. 여러 시험은 {{시험결과}}로 모두 노출.
  const repExam = i.exams[0] ?? null;
  const examName = repExam?.name ?? null;
  const examScore = repExam?.score ?? null;
  const examTotal = repExam?.totalScore ?? null;
  const examResults = formatExamResults(i.exams);
  const pct =
    examScore != null && examTotal != null && examTotal > 0
      ? Math.round((examScore / examTotal) * 100)
      : null;
  const homework = i.homeworkDone === true ? '완료' : i.homeworkDone === false ? '미완료' : '-';
  const assignmentMemo = i.assignmentMemos.filter((m) => m && m.trim()).join('\n') || null;

  const context: TokenContext = {
    학생: i.studentName,
    학년: i.grade,
    반: i.className,
    날짜: formatDateLabel(i.date),
    월일: formatDateLabelShort(i.date),
    수업내용: i.sessionNote ?? undefined,
    과제내용: assignmentMemo ?? undefined,
    태도점수: i.attitude,
    태도사유: i.attitudeReason ?? undefined,
    과제수행: homework,
    코멘트: i.comment ?? undefined, // 기존 양식 {{코멘트}} 호환용 별칭
    '클리닉 전달 내용': i.comment ?? undefined,
    시험명: examName ?? undefined,
    시험점수: examScore,
    만점: examTotal ?? undefined,
    백분율: pct, // {{합격/불합격}} 조건부용
    시험결과: examResults, // 선택된 시험들을 "• 시험명: 점수/만점" 줄로
    클리닉피드백: i.clinicFeedback,
    passThreshold: i.passThreshold,
  };

  const raw: DailyRaw = {
    studentId: i.studentId,
    studentName: i.studentName,
    date: i.date,
    sessionNote: i.sessionNote,
    assignmentMemo,
    attitude: i.attitude,
    attitudeReason: i.attitudeReason,
    homeworkDone: i.homeworkDone,
    comment: i.comment,
    examName,
    examScore,
    examTotal,
    clinicFeedback: i.clinicFeedback,
  };

  return { context, raw };
}

/** 그날 이 학생에게 리포트로 보낼 만한 데이터가 하나라도 있는지 (빈 리포트 발송 방지) */
export function hasDailyData(raw: DailyRaw): boolean {
  return !!(
    (raw.sessionNote && raw.sessionNote.trim()) ||
    (raw.assignmentMemo && raw.assignmentMemo.trim()) ||
    raw.attitude != null ||
    (raw.attitudeReason && raw.attitudeReason.trim()) ||
    raw.homeworkDone != null ||
    (raw.comment && raw.comment.trim()) ||
    raw.examName ||
    raw.examScore != null ||
    (raw.clinicFeedback && raw.clinicFeedback !== '-')
  );
}

// ── 비순수: DB fetch + 조립 (수동 검증) ──────────────────────

export async function buildDailyContexts(
  academyId: string,
  classId: string,
  date: string, // YYYY-MM-DD
  studentIds: string[],
  passThreshold: number,
  examIds?: string[], // 지정 시 그날 시험 중 이 시험들만 포함 (발행 시 사용자 선택). 미지정=그날 전체
): Promise<Map<string, DailyContextResult>> {
  const sessionDate = new Date(`${date}T00:00:00.000Z`);
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  // 1파: 반 공통 + 학생별 데이터 (독립 read 병렬, 트랜잭션 아님)
  const [cls, sessionNote, assignments, exams, evals, comments, clinics, templates, students] =
    await Promise.all([
      prisma.class.findFirst({ where: { id: classId, academyId }, select: { name: true } }),
      prisma.lessonSessionNote.findUnique({
        where: { classId_sessionDate: { classId, sessionDate } },
        select: { content: true },
      }),
      prisma.assignment.findMany({
        where: { academyId, classId, date: { gte: dayStart, lte: dayEnd } },
        select: { memo: true },
      }),
      prisma.exam.findMany({
        where: {
          academyId, classId, levelTestFormId: null, date: { gte: dayStart, lte: dayEnd },
          // examIds 지정(빈 배열 포함) 시 그 시험들만 — 빈 배열은 "시험 없음"(전체 해제 의도). undefined면 그날 전체
          ...(examIds ? { id: { in: examIds } } : {}),
        },
        orderBy: { date: 'asc' },
        select: { id: true, name: true, totalScore: true },
      }),
      prisma.lessonStudentEval.findMany({
        where: { academyId, classId, sessionDate, studentId: { in: studentIds } },
      }),
      prisma.lessonComment.findMany({
        where: { academyId, classId, sessionDate, studentId: { in: studentIds } },
      }),
      prisma.clinicResult.findMany({
        where: { academyId, classId, sessionDate, studentId: { in: studentIds } },
      }),
      prisma.clinicTemplate.findMany({ where: { academyId }, select: { id: true, items: true } }),
      prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true, grade: true },
      }),
    ]);

  // 2파: 그날 (선택된) 모든 시험에 대한 학생별 점수 — {{시험결과}}가 시험별 점수를 나열하므로 전부 조회
  const examIdsAll = exams.map((e) => e.id);
  const grades = examIdsAll.length
    ? await prisma.gradeRecord.findMany({
        where: { examId: { in: examIdsAll }, studentId: { in: studentIds } },
        select: { examId: true, studentId: true, score: true },
      })
    : [];

  // 양식 itemId → label 매핑
  const labelMap = new Map<string, Map<string, string>>();
  for (const t of templates) {
    const items = (t.items as unknown as ClinicTemplateItem[]) ?? [];
    labelMap.set(t.id, new Map(items.map((it) => [it.id, it.label])));
  }
  const labelOf = (templateId: string | null, itemId: string) =>
    templateId ? labelMap.get(templateId)?.get(itemId) : undefined;

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const assignmentMemos = assignments.map((a) => a.memo);

  const result = new Map<string, DailyContextResult>();
  for (const sid of studentIds) {
    const stu = studentMap.get(sid);
    if (!stu) continue;
    const ev = evals.find((e) => e.studentId === sid);
    const cm = comments.find((c) => c.studentId === sid);
    const studentClinics: ClinicResultLike[] = clinics
      .filter((c) => c.studentId === sid)
      .map((c) => ({
        templateId: c.templateId,
        checks: (c.checks as unknown as ClinicCheck[]) ?? [],
        customItems: (c.customItems as unknown as ClinicCustomItem[]) ?? [],
        hiddenItemIds: (c.hiddenItemIds as unknown as string[]) ?? [],
      }));
    const clinicFeedback = formatClinicFeedback(studentClinics, labelOf);
    const examsWithScores = exams.map((e) => ({
      name: e.name,
      totalScore: e.totalScore,
      score: grades.find((g) => g.examId === e.id && g.studentId === sid)?.score ?? null,
    }));

    result.set(
      sid,
      shapeDailyContext({
        studentId: sid,
        studentName: stu.name,
        grade: stu.grade,
        className: cls?.name ?? '',
        date,
        sessionNote: sessionNote?.content ?? null,
        assignmentMemos,
        attitude: ev?.attitude ?? null,
        attitudeReason: ev?.attitudeReason ?? null,
        homeworkDone: ev?.homeworkDone ?? null,
        comment: cm?.comment ?? null,
        exams: examsWithScores,
        clinicFeedback,
        passThreshold,
      }),
    );
  }

  return result;
}
