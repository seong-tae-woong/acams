'use client';
// edit-flow v1
import { useState, useEffect, useCallback, useMemo } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import Tabs from '@/components/shared/Tabs';
import { useClassStore } from '@/lib/stores/classStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { StudentStatus } from '@/lib/types/student';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Trash2, FolderTree, ChevronRight, ChevronDown, Pencil } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { DAY_NAMES } from '@/lib/types/class';
import clsx from 'clsx';

const TAB_OPTIONS = [
  { value: 'exam', label: '시험 목록' },
  { value: 'assignment', label: '과제' },
];

interface Assignment {
  id: string;
  classId: string;
  className: string;
  classSubject: string;
  date: string;
  dueDate: string;
  memo: string;
}

interface AssignmentForm {
  date: string;
  dueDate: string;
  memo: string;
}

const EMPTY_ASSIGNMENT_FORM: AssignmentForm = {
  date: new Date().toISOString().slice(0, 10),
  dueDate: '',
  memo: '',
};

interface ExamForm {
  name: string;
  date: string;
  totalScore: string;
  description: string;
  category1Id: string;
  category2Id: string;
  category3Id: string;
}

const EMPTY_EXAM_FORM: ExamForm = {
  name: '',
  date: new Date().toISOString().slice(0, 10),
  totalScore: '100',
  description: '',
  category1Id: '',
  category2Id: '',
  category3Id: '',
};

export default function GradesPage() {
  const { classes, fetchClasses } = useClassStore();
  const {
    exams, selectedExamId, loading, categories,
    getExamsByClass, getGradesByExam,
    setSelectedExam, fetchExams, fetchGrades, addExam, updateExam, deleteExam, saveGrades, updateGrade,
    fetchCategories, addCategory, deleteCategory,
  } = useGradeStore();
  const { students, fetchStudents } = useStudentStore();
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? '');

  // 메인 탭 (시험 목록 | 과제)
  const [mainTab, setMainTab] = useState<'exam' | 'assignment'>('exam');

  // 과제 상태
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentFormOpen, setAssignmentFormOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(EMPTY_ASSIGNMENT_FORM);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false);
  const [useScheduleDate, setUseScheduleDate] = useState(false);

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

  const classExams = getExamsByClass(selectedClassId);
  const filteredExams = classExams.filter((e) => {
    if (filterCat1 && e.category1Id !== filterCat1) return false;
    if (filterCat2 && e.category2Id !== filterCat2) return false;
    if (filterCat3 && e.category3Id !== filterCat3) return false;
    return true;
  });
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

  // 반 변경 시 시험 목록 로드
  const loadExams = useCallback(async (classId: string) => {
    if (!classId) return;
    await fetchExams(classId);
  }, [fetchExams]);

  useEffect(() => {
    if (students.length === 0) fetchStudents();
    if (classes.length === 0) fetchClasses();
    fetchCategories().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 클래스가 늦게 로드되어 selectedClassId가 비었으면 첫번째로 자동 설정
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (selectedClassId) loadExams(selectedClassId);
  }, [selectedClassId, loadExams]);

  // 과제 목록 로드
  const loadAssignments = useCallback(async (classId: string) => {
    if (!classId) return;
    setAssignmentLoading(true);
    try {
      const res = await fetch(`/api/assignments?classId=${classId}`);
      if (!res.ok) throw new Error('과제 목록을 불러올 수 없습니다.');
      const data = await res.json();
      setAssignments(data);
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === 'assignment' && selectedClassId) {
      loadAssignments(selectedClassId);
    }
  }, [mainTab, selectedClassId, loadAssignments]);

  // 선택된 반의 시간표
  const scheduleDates = useMemo(() => {
    if (!selectedClassId) return [] as { date: string; label: string }[];
    const cls = classes.find((c) => c.id === selectedClassId);
    if (!cls) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out: { date: string; label: string }[] = [];
    // 오늘부터 60일치 시간표 날짜 후보
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      const slot = cls.schedule.find((s) => s.dayOfWeek === dow);
      if (slot) {
        const iso = d.toISOString().slice(0, 10);
        out.push({ date: iso, label: `${iso} (${DAY_NAMES[dow]} ${slot.startTime}~${slot.endTime})` });
      }
    }
    return out;
  }, [selectedClassId, classes]);

  const openCreateAssignmentModal = () => {
    setEditingAssignmentId(null);
    setAssignmentForm(EMPTY_ASSIGNMENT_FORM);
    setUseScheduleDate(false);
    setAssignmentFormOpen(true);
  };

  const openEditAssignmentModal = (a: Assignment) => {
    setEditingAssignmentId(a.id);
    setAssignmentForm({ date: a.date, dueDate: a.dueDate, memo: a.memo });
    setUseScheduleDate(false);
    setAssignmentFormOpen(true);
  };

  const handleSubmitAssignment = async () => {
    if (!selectedClassId) { toast('반을 선택해주세요.', 'error'); return; }
    if (!assignmentForm.date) { toast('과제 일자를 입력해주세요.', 'error'); return; }
    if (!assignmentForm.dueDate) { toast('납기일을 입력해주세요.', 'error'); return; }
    if (assignmentForm.dueDate < assignmentForm.date) {
      toast('납기일은 과제 일자 이후여야 합니다.', 'error'); return;
    }
    setAssignmentSubmitting(true);
    try {
      if (editingAssignmentId) {
        const res = await fetch(`/api/assignments/${editingAssignmentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assignmentForm),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? '저장 실패');
        toast('과제가 수정되었습니다.', 'success');
      } else {
        const res = await fetch('/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classId: selectedClassId, ...assignmentForm }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? '저장 실패');
        toast('과제가 등록되었습니다.', 'success');
      }
      setAssignmentFormOpen(false);
      setEditingAssignmentId(null);
      setAssignmentForm(EMPTY_ASSIGNMENT_FORM);
      await loadAssignments(selectedClassId);
    } catch (err) {
      toast(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setAssignmentSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm('과제를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      toast('과제가 삭제되었습니다.', 'success');
      await loadAssignments(selectedClassId);
    } catch {
      toast('삭제에 실패했습니다.', 'error');
    }
  };

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
      totalScore: String(e.totalScore),
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
    setSubmitting(true);
    try {
      if (editingExamId) {
        // 수정
        await updateExam(editingExamId, {
          name: examForm.name,
          date: examForm.date,
          totalScore: Number(examForm.totalScore) || 100,
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
          totalScore: Number(examForm.totalScore) || 100,
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
              rank: null,
              memo: '',
            })),
          );
        }

        toast(`'${examForm.name}' 시험이 등록되었습니다.`, 'success');
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

  const startEditScore = (gradeId: string, currentScore: number | null) => {
    setEditingGradeId(gradeId);
    setEditScore(currentScore !== null ? String(currentScore) : '');
    setEditingMemoId(null);
  };

  const saveScore = async (gradeId: string) => {
    const newScore = editScore.trim() === '' ? null : Number(editScore);
    if (newScore !== null && (isNaN(newScore) || newScore < 0)) { setEditingGradeId(null); return; }
    if (selectedExam && newScore !== null && newScore > selectedExam.totalScore) {
      toast(`점수는 만점(${selectedExam.totalScore}점) 이하여야 합니다.`, 'error'); return;
    }

    // 순위 계산
    const allScores = examGrades
      .map((g) => (g.id === gradeId ? newScore : g.score))
      .filter((s): s is number => s !== null);
    const sorted = [...allScores].sort((a, b) => b - a);

    setEditingGradeId(null);

    try {
      // 현재 학생 점수+순위 저장
      await updateGrade(gradeId, {
        score: newScore,
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

  const fieldClass = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="성적 관리"
        actions={
          <div className="flex gap-2">
            {mainTab === 'exam' ? (
              <>
                <Button variant="default" size="sm" onClick={() => setCategoryModalOpen(true)}>
                  <FolderTree size={13} /> 시험 카테고리 생성
                </Button>
                <Button variant="dark" size="sm" onClick={openCreateExamModal}>
                  <Plus size={13} /> 시험 등록
                </Button>
              </>
            ) : (
              <Button variant="dark" size="sm" onClick={openCreateAssignmentModal}>
                <Plus size={13} /> 과제 등록
              </Button>
            )}
          </div>
        }
      />
      <div className="px-5 pt-3 bg-white">
        <Tabs
          tabs={TAB_OPTIONS}
          value={mainTab}
          onChange={(v) => setMainTab(v as 'exam' | 'assignment')}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 반 선택 */}
        <div className="flex gap-2">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => {
                setSelectedClassId(cls.id);
                setSelectedExam(null);
                setFilterCat1(''); setFilterCat2(''); setFilterCat3('');
              }}
              className={clsx(
                'px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium border transition-colors cursor-pointer',
                selectedClassId === cls.id
                  ? 'text-white border-transparent'
                  : 'text-[#374151] border-[#e2e8f0] bg-white hover:bg-[#f4f6f8]',
              )}
              style={selectedClassId === cls.id ? { backgroundColor: cls.color } : {}}
            >
              {cls.name}
            </button>
          ))}
        </div>

        {mainTab === 'exam' && (
        <div className="grid grid-cols-[260px_1fr] gap-4">
          {/* 시험 목록 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-[#111827]">시험 목록</span>
              <span className="text-[11px] text-[#9ca3af]">{filteredExams.length}개</span>
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

            <div className="divide-y divide-[#f1f5f9]">
              {loading ? (
                <LoadingSpinner size="inline" />
              ) : filteredExams.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-[#9ca3af]">
                  {classExams.length === 0 ? '시험 없음' : '필터 조건에 해당하는 시험 없음'}
                </div>
              ) : filteredExams.map((exam) => {
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
                        {formatKoreanDate(exam.date)} · 만점 {exam.totalScore}점
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
                <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[#111827]">학생별 성적</span>
                  <span className="text-[11px] text-[#9ca3af]">점수·코멘트를 클릭하면 수정할 수 있습니다</span>
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
                        const isEditingScore = editingGradeId === g.id;
                        const isEditingMemo = editingMemoId === g.id;
                        return (
                          <tr key={g.id} className="hover:bg-[#f4f6f8]">
                            <td className="px-4 py-2.5 text-[#111827]">{g.studentName}</td>

                            {/* 점수 — 클릭하면 input */}
                            <td className="px-4 py-2.5 text-center">
                              {isEditingScore ? (
                                <input
                                  type="number"
                                  value={editScore}
                                  onChange={(e) => setEditScore(e.target.value)}
                                  onBlur={() => saveScore(g.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveScore(g.id);
                                    if (e.key === 'Escape') setEditingGradeId(null);
                                  }}
                                  className="w-16 text-center border border-[#4fc3a1] rounded-[6px] px-1 py-0.5 text-[12.5px] font-semibold focus:outline-none"
                                  placeholder="점수"
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => startEditScore(g.id, g.score)}
                                  className={clsx(
                                    'font-semibold hover:text-[#4fc3a1] cursor-pointer',
                                    g.score !== null ? 'text-[#111827]' : 'text-[#9ca3af]',
                                  )}
                                  title="클릭하여 점수 입력"
                                >
                                  {g.score !== null
                                    ? <>{g.score}<span className="text-[#9ca3af] font-normal">/{selectedExam.totalScore}</span></>
                                    : '미입력'}
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
        )}

        {mainTab === 'assignment' && (
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-[#111827]">
                과제 목록 {selectedClass ? `· ${selectedClass.name}` : ''}
              </span>
              <span className="text-[11px] text-[#9ca3af]">{assignments.length}건</span>
            </div>
            {assignmentLoading ? (
              <LoadingSpinner size="inline" />
            ) : assignments.length === 0 ? (
              <div className="p-8 text-center text-[12.5px] text-[#9ca3af]">
                {selectedClassId ? '등록된 과제가 없습니다.' : '반을 선택해주세요.'}
              </div>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-[#f4f6f8]">
                    <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium w-32">출제일</th>
                    <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium w-32">납기일</th>
                    <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">과제 내용</th>
                    <th className="px-4 py-2.5 text-[#6b7280] font-medium w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {assignments.map((a) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const overdue = a.dueDate < today;
                    return (
                      <tr key={a.id} className={clsx('hover:bg-[#f4f6f8]', overdue && 'opacity-60')}>
                        <td className="px-4 py-3 text-[#111827]">{a.date}</td>
                        <td className="px-4 py-3">
                          <span className={clsx('font-medium', overdue ? 'text-[#9ca3af]' : 'text-[#111827]')}>
                            {a.dueDate}
                          </span>
                          {overdue && <span className="ml-2 text-[10.5px] text-[#9ca3af]">(마감)</span>}
                        </td>
                        <td className="px-4 py-3 text-[#374151] whitespace-pre-wrap">
                          {a.memo || <span className="text-[#9ca3af]">(메모 없음)</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openEditAssignmentModal(a)}
                            className="text-[#9ca3af] hover:text-[#4fc3a1] cursor-pointer mr-2"
                            title="수정"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(a.id)}
                            className="text-[#9ca3af] hover:text-[#ef4444] cursor-pointer"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
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
            { label: '만점', key: 'totalScore', type: 'number', placeholder: '100' },
            { label: '설명', key: 'description', type: 'text', placeholder: '시험 범위 등 메모' },
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

      {/* 과제 등록/수정 모달 */}
      <Modal
        open={assignmentFormOpen}
        onClose={() => { setAssignmentFormOpen(false); setEditingAssignmentId(null); }}
        title={editingAssignmentId ? '과제 수정' : '과제 등록'}
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => { setAssignmentFormOpen(false); setEditingAssignmentId(null); }}>취소</Button>
            <Button variant="dark" size="md" onClick={handleSubmitAssignment} disabled={assignmentSubmitting}>
              {assignmentSubmitting ? '저장 중...' : editingAssignmentId ? '수정' : '등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-[12px] text-[#6b7280] bg-[#f4f6f8] rounded-[8px] px-3 py-2">
            반: <span className="font-medium text-[#111827]">{selectedClass?.name ?? '-'}</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11.5px] text-[#6b7280]">과제 일자 *</label>
              {scheduleDates.length > 0 && (
                <button
                  type="button"
                  className="text-[10.5px] text-[#4fc3a1] hover:underline cursor-pointer"
                  onClick={() => setUseScheduleDate((v) => !v)}
                >
                  {useScheduleDate ? '직접 입력으로' : '시간표에서 선택'}
                </button>
              )}
            </div>
            {useScheduleDate ? (
              <select
                value={assignmentForm.date}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, date: e.target.value })}
                className={fieldClass}
              >
                <option value="">선택</option>
                {scheduleDates.map((d) => (
                  <option key={d.date} value={d.date}>{d.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                value={assignmentForm.date}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, date: e.target.value })}
                className={fieldClass}
              />
            )}
          </div>

          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">납기일 *</label>
            <input
              type="date"
              value={assignmentForm.dueDate}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">과제 내용 (메모)</label>
            <textarea
              value={assignmentForm.memo}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, memo: e.target.value })}
              rows={5}
              className={`${fieldClass} resize-none`}
              placeholder="예: 교재 23~28쪽 풀이, 단어시험 대비 1~30번"
            />
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
    </div>
  );
}

// ─────────────────────────────────────────────
// 카테고리 관리 모달
// ─────────────────────────────────────────────

interface CategoryManagerModalProps {
  open: boolean;
  onClose: () => void;
  categories: ReturnType<typeof useGradeStore.getState>['categories'];
  cat1List: ReturnType<typeof useGradeStore.getState>['categories'];
  cat2ByParent: Map<string, ReturnType<typeof useGradeStore.getState>['categories']>;
  cat3ByParent: Map<string, ReturnType<typeof useGradeStore.getState>['categories']>;
  onAdd: ReturnType<typeof useGradeStore.getState>['addCategory'];
  onDelete: ReturnType<typeof useGradeStore.getState>['deleteCategory'];
}

function CategoryManagerModal({
  open, onClose, cat1List, cat2ByParent, cat3ByParent, onAdd, onDelete,
}: CategoryManagerModalProps) {
  const [newCat1, setNewCat1] = useState('');
  const [expanded1, setExpanded1] = useState<Set<string>>(new Set());
  const [expanded2, setExpanded2] = useState<Set<string>>(new Set());
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null); // 추가 입력창을 띄울 부모 id
  const [childInput, setChildInput] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const handleAddTop = async () => {
    const name = newCat1.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onAdd({ name, level: 1, parentId: null });
      setNewCat1('');
      toast(`카테고리 1 '${name}'이(가) 등록되었습니다.`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '등록 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAddChild = async (parentId: string, level: 2 | 3) => {
    const name = childInput.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onAdd({ name, level, parentId });
      setChildInput('');
      setAddingChildOf(null);
      toast(`카테고리 ${level} '${name}'이(가) 등록되었습니다.`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '등록 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string, hasChildren: boolean) => {
    const msg = hasChildren
      ? `'${name}'을(를) 삭제하시겠습니까?\n하위 카테고리도 함께 삭제되며, 이 카테고리를 사용 중인 시험의 카테고리는 해제됩니다.`
      : `'${name}'을(를) 삭제하시겠습니까?\n이 카테고리를 사용 중인 시험의 카테고리는 해제됩니다.`;
    if (!window.confirm(msg)) return;
    try {
      await onDelete(id);
      toast('카테고리가 삭제되었습니다.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제 실패', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="시험 카테고리 관리"
      size="md"
      footer={<Button variant="dark" size="md" onClick={onClose}>닫기</Button>}
    >
      <div className="space-y-4">
        <div className="text-[12px] text-[#6b7280] bg-[#f4f6f8] rounded-[8px] px-3 py-2">
          카테고리 1 → 2 → 3 순서로 계층을 구성하세요. 시험 등록 시 카테고리 1은 필수입니다.
        </div>

        {/* 카테고리 1 추가 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newCat1}
            onChange={(e) => setNewCat1(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTop(); }}
            placeholder="카테고리 1 이름 (예: 중간고사)"
            className="flex-1 text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]"
          />
          <Button variant="dark" size="md" onClick={handleAddTop} disabled={busy || !newCat1.trim()}>
            <Plus size={13} /> 추가
          </Button>
        </div>

        {/* 트리 */}
        <div className="border border-[#e2e8f0] rounded-[8px] divide-y divide-[#f1f5f9] max-h-[420px] overflow-y-auto">
          {cat1List.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-[#9ca3af]">등록된 카테고리가 없습니다.</div>
          ) : cat1List.map((c1) => {
            const c2list = cat2ByParent.get(c1.id) ?? [];
            const isExpanded1 = expanded1.has(c1.id);
            return (
              <div key={c1.id}>
                {/* level 1 */}
                <div className="flex items-center gap-2 px-3 py-2 hover:bg-[#f4f6f8] group">
                  <button
                    onClick={() => toggle(expanded1, c1.id, setExpanded1)}
                    className="text-[#9ca3af] hover:text-[#374151] cursor-pointer"
                  >
                    {isExpanded1 ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <span className="text-[13px] font-medium text-[#111827] flex-1">{c1.name}</span>
                  <span className="text-[10.5px] text-[#9ca3af] bg-[#f4f6f8] px-1.5 py-0.5 rounded">L1</span>
                  <button
                    onClick={() => { setAddingChildOf(c1.id); setChildInput(''); setExpanded1(new Set([...expanded1, c1.id])); }}
                    className="text-[11px] text-[#4fc3a1] hover:underline cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    + 하위 추가
                  </button>
                  <button
                    onClick={() => handleDelete(c1.id, c1.name, c2list.length > 0)}
                    className="text-[#d1d5db] hover:text-[#ef4444] cursor-pointer opacity-0 group-hover:opacity-100"
                    title="삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {isExpanded1 && (
                  <div className="bg-[#fafbfc]">
                    {/* level 2 추가 입력 */}
                    {addingChildOf === c1.id && (
                      <div className="flex gap-2 pl-9 pr-3 py-2 border-t border-[#f1f5f9]">
                        <input
                          type="text"
                          value={childInput}
                          onChange={(e) => setChildInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddChild(c1.id, 2); if (e.key === 'Escape') setAddingChildOf(null); }}
                          autoFocus
                          placeholder="카테고리 2 이름"
                          className="flex-1 text-[12px] border border-[#4fc3a1] rounded-[6px] px-2 py-1 focus:outline-none"
                        />
                        <Button variant="dark" size="sm" onClick={() => handleAddChild(c1.id, 2)} disabled={busy || !childInput.trim()}>추가</Button>
                        <Button variant="default" size="sm" onClick={() => setAddingChildOf(null)}>취소</Button>
                      </div>
                    )}

                    {c2list.length === 0 && addingChildOf !== c1.id ? (
                      <div className="pl-9 pr-3 py-2 text-[11.5px] text-[#9ca3af]">하위 카테고리 없음</div>
                    ) : c2list.map((c2) => {
                      const c3list = cat3ByParent.get(c2.id) ?? [];
                      const isExpanded2 = expanded2.has(c2.id);
                      return (
                        <div key={c2.id}>
                          <div className="flex items-center gap-2 pl-9 pr-3 py-2 hover:bg-[#f4f6f8] group border-t border-[#f1f5f9]">
                            <button
                              onClick={() => toggle(expanded2, c2.id, setExpanded2)}
                              className="text-[#9ca3af] hover:text-[#374151] cursor-pointer"
                            >
                              {isExpanded2 ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </button>
                            <span className="text-[12.5px] text-[#111827] flex-1">{c2.name}</span>
                            <span className="text-[10.5px] text-[#9ca3af] bg-[#f4f6f8] px-1.5 py-0.5 rounded">L2</span>
                            <button
                              onClick={() => { setAddingChildOf(c2.id); setChildInput(''); setExpanded2(new Set([...expanded2, c2.id])); }}
                              className="text-[11px] text-[#4fc3a1] hover:underline cursor-pointer opacity-0 group-hover:opacity-100"
                            >
                              + 하위 추가
                            </button>
                            <button
                              onClick={() => handleDelete(c2.id, c2.name, c3list.length > 0)}
                              className="text-[#d1d5db] hover:text-[#ef4444] cursor-pointer opacity-0 group-hover:opacity-100"
                              title="삭제"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {isExpanded2 && (
                            <div className="bg-[#f6f8fa]">
                              {addingChildOf === c2.id && (
                                <div className="flex gap-2 pl-16 pr-3 py-2 border-t border-[#f1f5f9]">
                                  <input
                                    type="text"
                                    value={childInput}
                                    onChange={(e) => setChildInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddChild(c2.id, 3); if (e.key === 'Escape') setAddingChildOf(null); }}
                                    autoFocus
                                    placeholder="카테고리 3 이름"
                                    className="flex-1 text-[12px] border border-[#4fc3a1] rounded-[6px] px-2 py-1 focus:outline-none"
                                  />
                                  <Button variant="dark" size="sm" onClick={() => handleAddChild(c2.id, 3)} disabled={busy || !childInput.trim()}>추가</Button>
                                  <Button variant="default" size="sm" onClick={() => setAddingChildOf(null)}>취소</Button>
                                </div>
                              )}

                              {c3list.length === 0 && addingChildOf !== c2.id ? (
                                <div className="pl-16 pr-3 py-2 text-[11.5px] text-[#9ca3af]">하위 카테고리 없음</div>
                              ) : c3list.map((c3) => (
                                <div key={c3.id} className="flex items-center gap-2 pl-16 pr-3 py-2 hover:bg-[#f4f6f8] group border-t border-[#f1f5f9]">
                                  <span className="text-[12px] text-[#374151] flex-1">{c3.name}</span>
                                  <span className="text-[10.5px] text-[#9ca3af] bg-[#f4f6f8] px-1.5 py-0.5 rounded">L3</span>
                                  <button
                                    onClick={() => handleDelete(c3.id, c3.name, false)}
                                    className="text-[#d1d5db] hover:text-[#ef4444] cursor-pointer opacity-0 group-hover:opacity-100"
                                    title="삭제"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
