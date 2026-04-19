'use client';
import { useState, useEffect, useCallback } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useClassStore } from '@/lib/stores/classStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { StudentStatus } from '@/lib/types/student';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';

interface ExamForm {
  name: string;
  date: string;
  totalScore: string;
  description: string;
}

const EMPTY_EXAM_FORM: ExamForm = {
  name: '',
  date: new Date().toISOString().slice(0, 10),
  totalScore: '100',
  description: '',
};

export default function GradesPage() {
  const { classes } = useClassStore();
  const {
    exams, selectedExamId, loading,
    getExamsByClass, getGradesByExam,
    setSelectedExam, fetchExams, fetchGrades, addExam, deleteExam, saveGrades, updateGrade,
  } = useGradeStore();
  const { students } = useStudentStore();
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? '');

  // 시험 등록 모달
  const [examFormOpen, setExamFormOpen] = useState(false);
  const [examForm, setExamForm] = useState<ExamForm>(EMPTY_EXAM_FORM);
  const [submitting, setSubmitting] = useState(false);

  // 성적 인라인 편집
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('');

  // 코멘트 인라인 편집
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editMemo, setEditMemo] = useState('');

  const classExams = getExamsByClass(selectedClassId);
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

  // 반 변경 시 시험 목록 로드
  const loadExams = useCallback(async (classId: string) => {
    if (!classId) return;
    await fetchExams(classId);
  }, [fetchExams]);

  useEffect(() => {
    if (selectedClassId) loadExams(selectedClassId);
  }, [selectedClassId, loadExams]);

  // 시험 선택 시 성적 로드
  const handleSelectExam = useCallback(async (examId: string | null) => {
    setSelectedExam(examId);
    if (examId) await fetchGrades(examId);
  }, [setSelectedExam, fetchGrades]);

  const handleAddExam = async () => {
    if (!examForm.name || !examForm.date) {
      toast('시험명과 날짜를 입력해주세요.', 'error'); return;
    }
    setSubmitting(true);
    try {
      const examId = await addExam({
        name: examForm.name,
        subject: selectedClass?.subject ?? '',
        classId: selectedClassId,
        className: selectedClass?.name ?? '',
        date: examForm.date,
        totalScore: Number(examForm.totalScore) || 100,
        description: examForm.description,
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
      setExamFormOpen(false);
      setExamForm(EMPTY_EXAM_FORM);
    } catch (err) {
      toast(err instanceof Error ? err.message : '시험 등록에 실패했습니다.', 'error');
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
        title="성적/시험 결과 관리"
        actions={
          <Button variant="dark" size="sm" onClick={() => setExamFormOpen(true)}>
            <Plus size={13} /> 시험 등록
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 반 선택 */}
        <div className="flex gap-2">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => {
                setSelectedClassId(cls.id);
                setSelectedExam(null);
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

        <div className="grid grid-cols-[260px_1fr] gap-4">
          {/* 시험 목록 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0]">
              <span className="text-[12.5px] font-semibold text-[#111827]">시험 목록</span>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {loading ? (
                <div className="p-6 text-center text-[12px] text-[#9ca3af]">불러오는 중...</div>
              ) : classExams.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-[#9ca3af]">시험 없음</div>
              ) : classExams.map((exam) => (
                <div
                  key={exam.id}
                  className={clsx(
                    'flex items-center group transition-colors',
                    selectedExamId === exam.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                  )}
                >
                  <button
                    onClick={() => handleSelectExam(exam.id)}
                    className="flex-1 px-4 py-3 text-left cursor-pointer"
                  >
                    <div className="text-[13px] font-medium text-[#111827]">{exam.name}</div>
                    <div className="text-[11.5px] text-[#6b7280] mt-0.5">
                      {formatKoreanDate(exam.date)} · 만점 {exam.totalScore}점
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteExam(exam.id, exam.name)}
                    className="px-3 py-3 text-[#d1d5db] hover:text-[#ef4444] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="시험 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
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
      </div>

      {/* 시험 등록 모달 */}
      <Modal
        open={examFormOpen}
        onClose={() => setExamFormOpen(false)}
        title="시험 등록"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setExamFormOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAddExam} disabled={submitting}>
              {submitting ? '등록 중...' : '등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-[12px] text-[#6b7280] bg-[#f4f6f8] rounded-[8px] px-3 py-2">
            반: <span className="font-medium text-[#111827]">{selectedClass?.name ?? '-'}</span>
            <span className="ml-2 text-[#9ca3af]">· 재원생이 자동으로 추가됩니다</span>
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
        </div>
      </Modal>
    </div>
  );
}
