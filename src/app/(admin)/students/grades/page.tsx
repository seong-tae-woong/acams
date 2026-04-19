'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useClassStore } from '@/lib/stores/classStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus } from 'lucide-react';
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
  const { exams, selectedExamId, getExamsByClass, getGradesByExam, setSelectedExam, addExam, updateGrade } = useGradeStore();
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? '');

  // 시험 등록 모달
  const [examFormOpen, setExamFormOpen] = useState(false);
  const [examForm, setExamForm] = useState<ExamForm>(EMPTY_EXAM_FORM);

  // 성적 인라인 편집
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('');

  // 코멘트 인라인 편집
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editMemo, setEditMemo] = useState('');

  const classExams = getExamsByClass(selectedClassId);
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const examGrades = selectedExamId ? getGradesByExam(selectedExamId) : [];

  const avg = examGrades.length > 0
    ? Math.round(examGrades.reduce((s, g) => s + g.score, 0) / examGrades.length)
    : 0;
  const max = examGrades.length > 0 ? Math.max(...examGrades.map(g => g.score)) : 0;
  const min = examGrades.length > 0 ? Math.min(...examGrades.map(g => g.score)) : 0;

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const handleAddExam = () => {
    if (!examForm.name || !examForm.date) {
      toast('시험명과 날짜를 입력해주세요.', 'error'); return;
    }
    addExam({
      name: examForm.name,
      subject: selectedClass?.subject ?? '',
      classId: selectedClassId,
      className: selectedClass?.name ?? '',
      date: examForm.date,
      totalScore: Number(examForm.totalScore) || 100,
      description: examForm.description,
    });
    toast(`'${examForm.name}' 시험이 등록되었습니다.`, 'success');
    setExamFormOpen(false);
    setExamForm(EMPTY_EXAM_FORM);
  };

  const startEditScore = (gradeId: string, currentScore: number) => {
    setEditingGradeId(gradeId);
    setEditScore(String(currentScore));
    setEditingMemoId(null);
  };

  const saveScore = (gradeId: string) => {
    const newScore = Number(editScore);
    if (isNaN(newScore) || newScore < 0) { setEditingGradeId(null); return; }
    if (selectedExam && newScore > selectedExam.totalScore) {
      toast(`점수는 만점(${selectedExam.totalScore}점) 이하여야 합니다.`, 'error'); return;
    }
    const allScores = examGrades.map((g) => (g.id === gradeId ? newScore : g.score)).sort((a, b) => b - a);
    const newRank = allScores.indexOf(newScore) + 1;
    updateGrade(gradeId, { score: newScore, rank: newRank });
    examGrades.forEach((g) => {
      if (g.id === gradeId) return;
      updateGrade(g.id, { rank: allScores.indexOf(g.score) + 1 });
    });
    setEditingGradeId(null);
  };

  const saveMemo = (gradeId: string) => {
    updateGrade(gradeId, { memo: editMemo });
    setEditingMemoId(null);
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
              onClick={() => { setSelectedClassId(cls.id); setSelectedExam(null); }}
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
              {classExams.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-[#9ca3af]">시험 없음</div>
              ) : classExams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExam(exam.id)}
                  className={clsx(
                    'w-full px-4 py-3 text-left transition-colors cursor-pointer',
                    selectedExamId === exam.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                  )}
                >
                  <div className="text-[13px] font-medium text-[#111827]">{exam.name}</div>
                  <div className="text-[11.5px] text-[#6b7280] mt-0.5">
                    {formatKoreanDate(exam.date)} · 만점 {exam.totalScore}점
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 성적 상세 */}
          {selectedExam ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '응시 인원', value: `${examGrades.length}명` },
                  { label: '평균', value: `${avg}점` },
                  { label: '최고', value: `${max}점` },
                  { label: '최저', value: `${min}점` },
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
                      .sort((a, b) => b.score - a.score)
                      .map((g) => {
                        const pct = Math.round((g.score / selectedExam.totalScore) * 100);
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
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => startEditScore(g.id, g.score)}
                                  className="font-semibold text-[#111827] hover:text-[#4fc3a1] cursor-pointer"
                                  title="클릭하여 수정"
                                >
                                  {g.score}<span className="text-[#9ca3af] font-normal">/{selectedExam.totalScore}</span>
                                </button>
                              )}
                            </td>

                            <td className="px-4 py-2.5 text-center text-[#374151]">{g.rank}위</td>

                            <td className="px-4 py-2.5">
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
            <Button variant="dark" size="md" onClick={handleAddExam}>등록</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-[12px] text-[#6b7280] bg-[#f4f6f8] rounded-[8px] px-3 py-2">
            반: <span className="font-medium text-[#111827]">{selectedClass?.name ?? '-'}</span>
          </div>
          {[
            { label: '시험명 *', key: 'name', type: 'text', placeholder: '3월 월례테스트' },
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
