'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import Tabs from '@/components/shared/Tabs';
import { useClassStore } from '@/lib/stores/classStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { StudentStatus } from '@/lib/types/student';
import type { ScoringMethod, GradeRecord } from '@/lib/types/grade';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Trash2, FolderTree, Pencil, Send } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import clsx from 'clsx';
import PublishReportModal from '@/components/communication/PublishReportModal';
import CategoryManagerModal from '../_components/CategoryManagerModal';
import ClassSelector from '../_components/ClassSelector';
import { type ExamForm, type MainTab, EMPTY_EXAM_FORM, PAGE_SIZE, fieldClass, TAB_OPTIONS } from '../_shared';

interface ExamTabProps {
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  mainTab: MainTab;
  setMainTab: (t: MainTab) => void;
}

export default function ExamTab({ selectedClassId, setSelectedClassId, mainTab, setMainTab }: ExamTabProps) {
  const { classes } = useClassStore();
  const {
    exams, selectedExamId, loading, categories,
    getExamsByClass, getGradesByExam,
    setSelectedExam, fetchExams, fetchGrades, addExam, updateExam, deleteExam, saveGrades, updateGrade,
    addCategory, deleteCategory,
  } = useGradeStore();
  const { students } = useStudentStore();

  // 시험 목록 페이지네이션 상태
  const [examHasMore, setExamHasMore] = useState(false);
  const [examLoadingMore, setExamLoadingMore] = useState(false);

  // 시험 등록/수정 모달
  const [examFormOpen, setExamFormOpen] = useState(false);
  const [examForm, setExamForm] = useState<ExamForm>(EMPTY_EXAM_FORM);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 카테고리 관리 모달
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // 시험 목록 카테고리 필터
  const [filterCat1, setFilterCat1] = useState('');
  const [filterCat2, setFilterCat2] = useState('');
  const [filterCat3, setFilterCat3] = useState('');

  // 성적 인라인 편집
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('');

  // 코멘트 인라인 편집
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editMemo, setEditMemo] = useState('');

  // 리포트 발행 모달
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // 시험 목록은 서버에서 반·카테고리 필터 + 등록일순 페이지네이션으로 내려옴
  const classExams = getExamsByClass(selectedClassId);
  const hasExamFilter = Boolean(filterCat1 || filterCat2 || filterCat3);
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const examGrades = selectedExamId ? getGradesByExam(selectedExamId) : [];

  // null 점수 제외하고 통계 계산
  const scoredGrades = examGrades.filter((g) => g.score !== null);
  const avg = scoredGrades.length > 0
    ? Math.round(scoredGrades.reduce((s, g) => s + (g.score as number), 0) / scoredGrades.length)
    : null;
  const max = scoredGrades.length > 0 ? Math.max(...scoredGrades.map((g) => g.score as number)) : null;
  const min = scoredGrades.length > 0 ? Math.min(...scoredGrades.map((g) => g.score as number)) : null;

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // 카테고리 분류
  const cat1List = useMemo(() => categories.filter((c) => c.level === 1), [categories]);
  const cat2ByParent = useMemo(() => {
    const m = new Map<string, typeof categories>();
    categories.filter((c) => c.level === 2).forEach((c) => {
      if (!c.parentId) return;
      const list = m.get(c.parentId) ?? [];
      list.push(c);
      m.set(c.parentId, list);
    });
    return m;
  }, [categories]);
  const cat3ByParent = useMemo(() => {
    const m = new Map<string, typeof categories>();
    categories.filter((c) => c.level === 3).forEach((c) => {
      if (!c.parentId) return;
      const list = m.get(c.parentId) ?? [];
      list.push(c);
      m.set(c.parentId, list);
    });
    return m;
  }, [categories]);

  const cat2Options = examForm.category1Id ? (cat2ByParent.get(examForm.category1Id) ?? []) : [];
  const cat3Options = examForm.category2Id ? (cat3ByParent.get(examForm.category2Id) ?? []) : [];

  const filterCat2Options = filterCat1 ? (cat2ByParent.get(filterCat1) ?? []) : [];
  const filterCat3Options = filterCat2 ? (cat3ByParent.get(filterCat2) ?? []) : [];

  // 시험 목록 1페이지 로드 (반·카테고리 필터 적용, 등록일 최신순)
  const loadExamsFirstPage = useCallback(async () => {
    if (!selectedClassId) return;
    const count = await fetchExams(selectedClassId, {
      take: PAGE_SIZE,
      skip: 0,
      category1Id: filterCat1 || undefined,
      category2Id: filterCat2 || undefined,
      category3Id: filterCat3 || undefined,
    });
    setExamHasMore(count === PAGE_SIZE);
  }, [selectedClassId, filterCat1, filterCat2, filterCat3, fetchExams]);

  // 시험 목록 다음 페이지 로드 (스크롤)
  const loadMoreExams = useCallback(async () => {
    if (examLoadingMore || !examHasMore || !selectedClassId) return;
    setExamLoadingMore(true);
    try {
      const count = await fetchExams(selectedClassId, {
        take: PAGE_SIZE,
        skip: getExamsByClass(selectedClassId).length,
        append: true,
        category1Id: filterCat1 || undefined,
        category2Id: filterCat2 || undefined,
        category3Id: filterCat3 || undefined,
      });
      setExamHasMore(count === PAGE_SIZE);
    } finally {
      setExamLoadingMore(false);
    }
  }, [examLoadingMore, examHasMore, selectedClassId, filterCat1, filterCat2, filterCat3, fetchExams, getExamsByClass]);

  // 시험 탭 진입 / 반·카테고리 필터 변경 시 1페이지 재로딩
  useEffect(() => {
    loadExamsFirstPage();
  }, [loadExamsFirstPage]);

  // 시험 선택 시 성적 로드
  const handleSelectExam = useCallback(async (examId: string | null) => {
    setSelectedExam(examId);
    if (examId) await fetchGrades(examId);
  }, [setSelectedExam, fetchGrades]);

  const openCreateExamModal = () => {
    setEditingExamId(null);
    setExamForm(EMPTY_EXAM_FORM);
    setExamFormOpen(true);
  };

  const openEditExamModal = (examId: string) => {
    const e = exams.find((x) => x.id === examId);
    if (!e) return;
    setEditingExamId(examId);
    setExamForm({
      name: e.name,
      date: e.date,
      scoringMethod: e.scoringMethod,
      totalScore: String(e.totalScore),
      totalQuestions: e.totalQuestions != null ? String(e.totalQuestions) : '',
      description: e.description ?? '',
      category1Id: e.category1Id ?? '',
      category2Id: e.category2Id ?? '',
      category3Id: e.category3Id ?? '',
    });
    setExamFormOpen(true);
  };

  const handleSubmitExam = async () => {
    if (!examForm.name || !examForm.date) {
      toast('시험명과 날짜를 입력해주세요.', 'error'); return;
    }
    if (!examForm.category1Id) {
      toast('카테고리 1을 선택해주세요.', 'error'); return;
    }
    const isCount = examForm.scoringMethod === 'COUNT';
    if (isCount) {
      const tq = Number(examForm.totalQuestions);
      if (!Number.isInteger(tq) || tq < 1) {
        toast('총 문제 수를 1 이상으로 입력해주세요.', 'error'); return;
      }
    }
    setSubmitting(true);
    try {
      if (editingExamId) {
        // 수정 (배점 방식은 잠금 — totalScore/totalQuestions만 모드에 맞게 전송)
        await updateExam(editingExamId, {
          name: examForm.name,
          date: examForm.date,
          totalScore: isCount ? 100 : (Number(examForm.totalScore) || 100),
          totalQuestions: isCount ? Number(examForm.totalQuestions) : null,
          description: examForm.description,
          category1Id: examForm.category1Id || null,
          category2Id: examForm.category2Id || null,
          category3Id: examForm.category3Id || null,
        });
        toast(`'${examForm.name}' 시험이 수정되었습니다.`, 'success');
      } else {
        // 등록
        const examId = await addExam({
          name: examForm.name,
          subject: selectedClass?.subject ?? '',
          classId: selectedClassId,
          className: selectedClass?.name ?? '',
          date: examForm.date,
          scoringMethod: examForm.scoringMethod,
          totalScore: isCount ? 100 : (Number(examForm.totalScore) || 100),
          totalQuestions: isCount ? Number(examForm.totalQuestions) : null,
          description: examForm.description,
          category1Id: examForm.category1Id || null,
          category1Name: null,
          category2Id: examForm.category2Id || null,
          category2Name: null,
          category3Id: examForm.category3Id || null,
          category3Name: null,
        });

        // 해당 반의 재원 학생으로 빈 성적 레코드 자동 생성
        const classStudents = students.filter(
          (s) => s.status === StudentStatus.ACTIVE && s.classes.includes(selectedClassId),
        );
        if (classStudents.length > 0) {
          await saveGrades(
            classStudents.map((s) => ({
              examId,
              studentId: s.id,
              studentName: s.name,
              score: null,
              correctCount: null,
              rank: null,
              memo: '',
            })),
          );
        }

        toast(`'${examForm.name}' 시험이 등록되었습니다.`, 'success');
        // 새 시험이 등록일 최신순 목록 맨 앞에 오도록 1페이지 재로딩
        await loadExamsFirstPage();
        await handleSelectExam(examId);
      }

      setExamFormOpen(false);
      setEditingExamId(null);
      setExamForm(EMPTY_EXAM_FORM);
    } catch (err) {
      toast(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExam = async (examId: string, examName: string) => {
    if (!window.confirm(`'${examName}' 시험을 삭제하시겠습니까?\n모든 성적 데이터도 함께 삭제됩니다.`)) return;
    try {
      await deleteExam(examId);
      toast(`'${examName}' 시험이 삭제되었습니다.`, 'success');
    } catch {
      toast('시험 삭제에 실패했습니다.', 'error');
    }
  };

  const startEditScore = (grade: GradeRecord) => {
    setEditingGradeId(grade.id);
    // COUNT 방식이면 맞힌 문제 수를, SCORE 방식이면 점수를 편집
    const cur = selectedExam?.scoringMethod === 'COUNT' ? grade.correctCount : grade.score;
    setEditScore(cur != null ? String(cur) : '');
    setEditingMemoId(null);
  };

  const saveScore = async (gradeId: string) => {
    const isCount = selectedExam?.scoringMethod === 'COUNT';
    const raw = editScore.trim();
    const parsed = raw === '' ? null : Number(raw);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) { setEditingGradeId(null); return; }

    let newScore: number | null;
    let newCorrectCount: number | null = null;

    if (isCount) {
      const tq = selectedExam?.totalQuestions ?? 0;
      if (parsed !== null && tq > 0 && parsed > tq) {
        toast(`맞힌 문제 수는 총 문제 수(${tq}문제) 이하여야 합니다.`, 'error'); return;
      }
      newCorrectCount = parsed !== null ? Math.round(parsed) : null;
      // 맞힌 문제 수 → 100점 환산
      newScore = newCorrectCount !== null && tq > 0 ? Math.round((newCorrectCount / tq) * 100) : null;
    } else {
      if (selectedExam && parsed !== null && parsed > selectedExam.totalScore) {
        toast(`점수는 만점(${selectedExam.totalScore}점) 이하여야 합니다.`, 'error'); return;
      }
      newScore = parsed;
    }

    // 순위 계산 (환산 점수 기준 — COUNT/SCORE 동일)
    const allScores = examGrades
      .map((g) => (g.id === gradeId ? newScore : g.score))
      .filter((s): s is number => s !== null);
    const sorted = [...allScores].sort((a, b) => b - a);

    setEditingGradeId(null);

    try {
      // 현재 학생 점수(+맞힌 수)+순위 저장
      await updateGrade(gradeId, {
        score: newScore,
        ...(isCount ? { correctCount: newCorrectCount } : {}),
        rank: newScore !== null ? sorted.indexOf(newScore) + 1 : null,
      });
      // 나머지 학생 순위 재계산
      const others = examGrades.filter((g) => g.id !== gradeId && g.score !== null);
      await Promise.all(
        others.map((g) => updateGrade(g.id, { rank: sorted.indexOf(g.score as number) + 1 })),
      );
    } catch {
      toast('점수 저장에 실패했습니다.', 'error');
    }
  };

  const saveMemo = async (gradeId: string) => {
    setEditingMemoId(null);
    try {
      await updateGrade(gradeId, { memo: editMemo });
    } catch {
      toast('코멘트 저장에 실패했습니다.', 'error');
    }
  };

  return (
    <>
      <Topbar
        title="수업 관리"
        actions={
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={() => setCategoryModalOpen(true)}>
              <FolderTree size={13} /> 시험 카테고리 생성
            </Button>
            <Button variant="dark" size="sm" onClick={openCreateExamModal}>
              <Plus size={13} /> 시험 등록
            </Button>
          </div>
        }
      />
      <div className="px-5 pt-3 bg-white">
        <Tabs
          tabs={TAB_OPTIONS}
          value={mainTab}
          onChange={(v) => setMainTab(v as MainTab)}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 반 선택 */}
        <ClassSelector
          classes={classes}
          selectedClassId={selectedClassId}
          onSelect={(id) => {
            setSelectedClassId(id);
            setSelectedExam(null);
            setFilterCat1(''); setFilterCat2(''); setFilterCat3('');
          }}
        />

        <div className="grid grid-cols-[260px_1fr] gap-4">
          {/* 시험 목록 */}
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-[#111827]">시험 목록</span>
            <span className="text-[11px] text-[#9ca3af]">
              {classExams.length}개{examHasMore ? '+' : ''}
            </span>
          </div>

          {/* 카테고리 필터 */}
          <div className="px-3 py-2.5 border-b border-[#e2e8f0] bg-[#fafbfc] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] text-[#6b7280] font-medium">카테고리 필터</span>
              {(filterCat1 || filterCat2 || filterCat3) && (
                <button
                  onClick={() => { setFilterCat1(''); setFilterCat2(''); setFilterCat3(''); }}
                  className="text-[10.5px] text-[#4fc3a1] hover:underline cursor-pointer"
                >
                  초기화
                </button>
              )}
            </div>
            <select
              value={filterCat1}
              onChange={(e) => { setFilterCat1(e.target.value); setFilterCat2(''); setFilterCat3(''); }}
              className="w-full text-[11.5px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 bg-white focus:outline-none focus:border-[#4fc3a1]"
            >
              <option value="">카테고리 1 (전체)</option>
              {cat1List.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterCat2}
              onChange={(e) => { setFilterCat2(e.target.value); setFilterCat3(''); }}
              className="w-full text-[11.5px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 bg-white focus:outline-none focus:border-[#4fc3a1] disabled:bg-[#f4f6f8] disabled:text-[#9ca3af]"
              disabled={!filterCat1 || filterCat2Options.length === 0}
            >
              <option value="">{!filterCat1 ? '카테고리 2 (먼저 1 선택)' : filterCat2Options.length === 0 ? '하위 없음' : '카테고리 2 (전체)'}</option>
              {filterCat2Options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterCat3}
              onChange={(e) => setFilterCat3(e.target.value)}
              className="w-full text-[11.5px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 bg-white focus:outline-none focus:border-[#4fc3a1] disabled:bg-[#f4f6f8] disabled:text-[#9ca3af]"
              disabled={!filterCat2 || filterCat3Options.length === 0}
            >
              <option value="">{!filterCat2 ? '카테고리 3 (먼저 2 선택)' : filterCat3Options.length === 0 ? '하위 없음' : '카테고리 3 (전체)'}</option>
              {filterCat3Options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div
            className="divide-y divide-[#f1f5f9] max-h-[calc(100vh-280px)] overflow-y-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) loadMoreExams();
            }}
          >
            {loading ? (
              <LoadingSpinner size="inline" />
            ) : classExams.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-[#9ca3af]">
                {hasExamFilter ? '필터 조건에 해당하는 시험 없음' : '시험 없음'}
              </div>
            ) : classExams.map((exam) => {
              const crumbs = [exam.category1Name, exam.category2Name, exam.category3Name].filter(Boolean) as string[];
              return (
                <div
                  key={exam.id}
                  className={clsx(
                    'flex items-center group transition-colors',
                    selectedExamId === exam.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                  )}
                >
                  <button
                    onClick={() => handleSelectExam(exam.id)}
                    className="flex-1 px-4 py-3 text-left cursor-pointer min-w-0"
                  >
                    {crumbs.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        {crumbs.map((c, i) => (
                          <span
                            key={i}
                            className={clsx(
                              'text-[10.5px] px-1.5 py-0.5 rounded-[4px] font-medium',
                              i === 0 && 'bg-[#4fc3a1] text-white',
                              i === 1 && 'bg-[#e8f5f1] text-[#2f8f74]',
                              i === 2 && 'bg-[#f4f6f8] text-[#6b7280]',
                            )}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mb-1">
                        <span className="text-[10.5px] px-1.5 py-0.5 rounded-[4px] bg-[#fef3c7] text-[#92400e] font-medium">
                          카테고리 미지정
                        </span>
                      </div>
                    )}
                    <div className="text-[13px] font-medium text-[#111827] truncate">{exam.name}</div>
                    <div className="text-[11.5px] text-[#6b7280] mt-0.5">
                      {formatKoreanDate(exam.date)} · {exam.scoringMethod === 'COUNT' ? `총 ${exam.totalQuestions ?? 0}문제` : `만점 ${exam.totalScore}점`}
                    </div>
                  </button>
                  <div className="flex flex-col">
                    <button
                      onClick={() => openEditExamModal(exam.id)}
                      className="px-3 pt-3 pb-1 text-[#d1d5db] hover:text-[#4fc3a1] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="시험 수정"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteExam(exam.id, exam.name)}
                      className="px-3 pt-1 pb-3 text-[#d1d5db] hover:text-[#ef4444] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="시험 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {examLoadingMore && (
              <div className="p-3 text-center text-[11px] text-[#9ca3af]">불러오는 중…</div>
            )}
          </div>
        </div>

        {/* 성적 상세 */}
        {selectedExam ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '전체 인원', value: `${examGrades.length}명` },
                { label: '평균', value: avg !== null ? `${avg}점` : '-' },
                { label: '최고', value: max !== null ? `${max}점` : '-' },
                { label: '최저', value: min !== null ? `${min}점` : '-' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                  <div className="text-[20px] font-bold text-[#111827]">{s.value}</div>
                  <div className="text-[11.5px] text-[#6b7280] mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-[12.5px] font-semibold text-[#111827]">학생별 성적</span>
                  <span className="text-[11px] text-[#9ca3af]">점수·코멘트를 클릭하면 수정할 수 있습니다</span>
                </div>
                <Button variant="primary" size="sm" onClick={() => setPublishModalOpen(true)}>
                  <Send size={13} /> 리포트 발행
                </Button>
              </div>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-[#f4f6f8]">
                    <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">이름</th>
                    <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">점수</th>
                    <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">순위</th>
                    <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium w-36">점수 비율</th>
                    <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium min-w-[200px]">코멘트</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {[...examGrades]
                    .sort((a, b) => {
                      if (a.score === null && b.score === null) return 0;
                      if (a.score === null) return 1;
                      if (b.score === null) return -1;
                      return b.score - a.score;
                    })
                    .map((g) => {
                      const pct = g.score !== null ? Math.round((g.score / selectedExam.totalScore) * 100) : null;
                      const isCount = selectedExam.scoringMethod === 'COUNT';
                      const isEditingScore = editingGradeId === g.id;
                      const isEditingMemo = editingMemoId === g.id;
                      return (
                        <tr key={g.id} className="hover:bg-[#f4f6f8]">
                          <td className="px-4 py-2.5 text-[#111827]">{g.studentName}</td>

                          {/* 점수 — 클릭하면 input (COUNT 방식이면 맞힌 문제 수 입력) */}
                          <td className="px-4 py-2.5 text-center">
                            {isEditingScore ? (
                              <span className="inline-flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  value={editScore}
                                  onChange={(e) => setEditScore(e.target.value)}
                                  onBlur={() => saveScore(g.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveScore(g.id);
                                    if (e.key === 'Escape') setEditingGradeId(null);
                                  }}
                                  className="w-14 text-center border border-[#4fc3a1] rounded-[6px] px-1 py-0.5 text-[12.5px] font-semibold focus:outline-none"
                                  placeholder={isCount ? '맞힌 수' : '점수'}
                                  autoFocus
                                />
                                {isCount && (
                                  <span className="text-[11px] text-[#9ca3af]">/ {selectedExam.totalQuestions}</span>
                                )}
                              </span>
                            ) : (
                              <button
                                onClick={() => startEditScore(g)}
                                className={clsx(
                                  'font-semibold hover:text-[#4fc3a1] cursor-pointer',
                                  g.score !== null ? 'text-[#111827]' : 'text-[#9ca3af]',
                                )}
                                title={isCount ? '클릭하여 맞힌 문제 수 입력' : '클릭하여 점수 입력'}
                              >
                                {g.score !== null ? (
                                  isCount ? (
                                    <>
                                      {g.score}<span className="text-[#9ca3af] font-normal">점</span>
                                      {g.correctCount !== null && (
                                        <span className="text-[#9ca3af] font-normal ml-1">({g.correctCount}/{selectedExam.totalQuestions})</span>
                                      )}
                                    </>
                                  ) : (
                                    <>{g.score}<span className="text-[#9ca3af] font-normal">/{selectedExam.totalScore}</span></>
                                  )
                                ) : '미입력'}
                              </button>
                            )}
                          </td>

                          <td className="px-4 py-2.5 text-center text-[#374151]">
                            {g.rank !== null ? `${g.rank}위` : '-'}
                          </td>

                          <td className="px-4 py-2.5">
                            {pct !== null ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: pct >= 90 ? '#4fc3a1' : pct >= 70 ? '#f59e0b' : '#ef4444',
                                    }}
                                  />
                                </div>
                                <span className="text-[11.5px] text-[#6b7280] w-8 text-right">{pct}%</span>
                              </div>
                            ) : (
                              <div className="flex-1 h-1.5 bg-[#f1f5f9] rounded-full" />
                            )}
                          </td>

                          {/* 코멘트 — 클릭하면 textarea */}
                          <td className="px-4 py-2">
                            {isEditingMemo ? (
                              <textarea
                                value={editMemo}
                                onChange={(e) => setEditMemo(e.target.value)}
                                onBlur={() => saveMemo(g.id)}
                                onKeyDown={(e) => { if (e.key === 'Escape') setEditingMemoId(null); }}
                                rows={2}
                                className="w-full border border-[#4fc3a1] rounded-[6px] px-2 py-1 text-[12px] resize-none focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingMemoId(g.id);
                                  setEditMemo(g.memo ?? '');
                                  setEditingGradeId(null);
                                }}
                                className={clsx(
                                  'w-full text-left text-[12px] py-1 px-1 rounded hover:bg-[#e8f5f1] cursor-pointer',
                                  g.memo ? 'text-[#374151]' : 'text-[#9ca3af] italic',
                                )}
                                title="클릭하여 코멘트 입력"
                              >
                                {g.memo || '코멘트 입력...'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] flex items-center justify-center h-48">
            <p className="text-[13px] text-[#9ca3af]">좌측에서 시험을 선택하세요</p>
          </div>
        )}
        </div>
      </div>

      {/* 시험 등록/수정 모달 */}
      <Modal
        open={examFormOpen}
        onClose={() => { setExamFormOpen(false); setEditingExamId(null); }}
        title={editingExamId ? '시험 수정' : '시험 등록'}
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => { setExamFormOpen(false); setEditingExamId(null); }}>취소</Button>
            <Button variant="dark" size="md" onClick={handleSubmitExam} disabled={submitting}>
              {submitting ? '저장 중...' : editingExamId ? '수정' : '등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-[12px] text-[#6b7280] bg-[#f4f6f8] rounded-[8px] px-3 py-2">
            반: <span className="font-medium text-[#111827]">
              {editingExamId
                ? (exams.find((e) => e.id === editingExamId)?.className ?? '-')
                : (selectedClass?.name ?? '-')}
            </span>
            {!editingExamId && <span className="ml-2 text-[#9ca3af]">· 재원생이 자동으로 추가됩니다</span>}
          </div>

          {[
            { label: '시험명 *', key: 'name', type: 'text', placeholder: '5월 월례테스트' },
            { label: '날짜 *', key: 'date', type: 'date', placeholder: '' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">{label}</label>
              <input
                type={type}
                value={(examForm as unknown as Record<string, string>)[key]}
                onChange={(e) => setExamForm({ ...examForm, [key]: e.target.value })}
                placeholder={placeholder}
                className={fieldClass}
              />
            </div>
          ))}

          {/* 배점 방식 (생성 후 잠금) */}
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">배점 방식</label>
            <select
              value={examForm.scoringMethod}
              onChange={(e) => setExamForm({ ...examForm, scoringMethod: e.target.value as ScoringMethod })}
              className={clsx(fieldClass, editingExamId && 'bg-[#f4f6f8] text-[#9ca3af] cursor-not-allowed')}
              disabled={!!editingExamId}
            >
              <option value="SCORE">점수 (만점 기준)</option>
              <option value="COUNT">문제수 (맞힌 개수 기준)</option>
            </select>
            {editingExamId && (
              <p className="text-[10.5px] text-[#9ca3af] mt-1">배점 방식은 시험 생성 후 변경할 수 없습니다.</p>
            )}
          </div>

          {/* 만점 또는 총 문제 수 */}
          {examForm.scoringMethod === 'COUNT' ? (
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">총 문제 수 *</label>
              <input
                type="number"
                min={1}
                value={examForm.totalQuestions}
                onChange={(e) => setExamForm({ ...examForm, totalQuestions: e.target.value })}
                placeholder="예: 20"
                className={fieldClass}
              />
              <p className="text-[10.5px] text-[#9ca3af] mt-1">맞힌 문제 수를 입력하면 100점 만점으로 환산됩니다.</p>
            </div>
          ) : (
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">만점</label>
              <input
                type="number"
                value={examForm.totalScore}
                onChange={(e) => setExamForm({ ...examForm, totalScore: e.target.value })}
                placeholder="100"
                className={fieldClass}
              />
            </div>
          )}

          {/* 설명 */}
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">설명</label>
            <input
              type="text"
              value={examForm.description}
              onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
              placeholder="시험 범위 등 메모"
              className={fieldClass}
            />
          </div>

          {/* 카테고리 선택 */}
          <div className="border-t border-[#f1f5f9] pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[#111827]">카테고리</span>
              {cat1List.length === 0 && (
                <button
                  type="button"
                  className="text-[11px] text-[#4fc3a1] hover:underline cursor-pointer"
                  onClick={() => setCategoryModalOpen(true)}
                >
                  카테고리 등록하러 가기
                </button>
              )}
            </div>

            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">카테고리 1 *</label>
              <select
                value={examForm.category1Id}
                onChange={(e) => setExamForm({ ...examForm, category1Id: e.target.value, category2Id: '', category3Id: '' })}
                className={fieldClass}
              >
                <option value="">선택</option>
                {cat1List.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">카테고리 2</label>
              <select
                value={examForm.category2Id}
                onChange={(e) => setExamForm({ ...examForm, category2Id: e.target.value, category3Id: '' })}
                className={fieldClass}
                disabled={!examForm.category1Id || cat2Options.length === 0}
              >
                <option value="">{!examForm.category1Id ? '카테고리 1 먼저 선택' : cat2Options.length === 0 ? '하위 카테고리 없음' : '선택 (선택사항)'}</option>
                {cat2Options.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">카테고리 3</label>
              <select
                value={examForm.category3Id}
                onChange={(e) => setExamForm({ ...examForm, category3Id: e.target.value })}
                className={fieldClass}
                disabled={!examForm.category2Id || cat3Options.length === 0}
              >
                <option value="">{!examForm.category2Id ? '카테고리 2 먼저 선택' : cat3Options.length === 0 ? '하위 카테고리 없음' : '선택 (선택사항)'}</option>
                {cat3Options.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* 카테고리 관리 모달 */}
      <CategoryManagerModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categories}
        cat2ByParent={cat2ByParent}
        cat3ByParent={cat3ByParent}
        cat1List={cat1List}
        onAdd={addCategory}
        onDelete={deleteCategory}
      />

      {/* 리포트 발행 모달 (시험 목록 진입 — 시험별 전용) */}
      {selectedExam && publishModalOpen && (
        <PublishReportModal
          open={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          source="exam"
          exam={{
            id: selectedExam.id,
            name: selectedExam.name,
            classId: selectedExam.classId,
            totalScore: selectedExam.totalScore,
            date: selectedExam.date,
          }}
          examClassName={selectedClass?.name ?? ''}
          examClassStudents={examGrades.map((g) => ({ id: g.studentId, name: g.studentName }))}
        />
      )}
    </>
  );
}
