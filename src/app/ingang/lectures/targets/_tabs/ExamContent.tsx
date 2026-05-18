'use client';
import { useState, useEffect } from 'react';
import { type Lecture, type QuizData, type QuizOption, type QuizQuestion } from '../_shared';

// 시험 출제 보기 번호
const NUMS = ['①','②','③','④','⑤'];

// ─── Tab: 시험 출제 ───────────────────────────────────────────
export function ExamContent({ lectures, loading }: { lectures: Lecture[]; loading: boolean }) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [quiz,       setQuiz]       = useState<QuizData>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [saving,     setSaving]     = useState(false);

  // 강의 목록이 로드되면 첫 번째 강의 선택
  useEffect(() => {
    if (lectures.length > 0 && !selectedId) setSelectedId(lectures[0].id);
  }, [lectures, selectedId]);

  // 강의 선택 시 해당 퀴즈 로드
  useEffect(() => {
    if (!selectedId) return;
    setQuizLoading(true);
    fetch(`/api/ingang/quizzes/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data) {
          setQuiz({ passScore: 70, maxTries: 3, examCond: 'after100', questions: [] });
        } else {
          // DB 필드명 → 내부 타입으로 매핑
          setQuiz({
            passScore: data.passScore,
            maxTries:  data.maxTries,
            examCond:  data.examCond,
            questions: (data.questions ?? []).map((q: { text: string; score: number; options: { text: string; isCorrect: boolean }[] }) => ({
              text:    q.text,
              score:   q.score,
              options: q.options.map((o: { text: string; isCorrect: boolean }) => ({ text: o.text, isCorrect: o.isCorrect })),
            })),
          });
        }
      })
      .catch(() => setQuiz({ passScore: 70, maxTries: 3, examCond: 'after100', questions: [] }))
      .finally(() => setQuizLoading(false));
  }, [selectedId]);

  const setQ = (qi: number, fn: (q: QuizQuestion) => QuizQuestion) =>
    setQuiz((prev) => prev ? { ...prev, questions: prev.questions.map((q, i) => (i === qi ? fn(q) : q)) } : prev);

  const setOpt = (qi: number, oi: number, fn: (o: QuizOption) => QuizOption) =>
    setQ(qi, (q) => ({ ...q, options: q.options.map((o, i) => (i === oi ? fn(o) : o)) }));

  const markCorrect = (qi: number, oi: number) =>
    setQ(qi, (q) => ({ ...q, options: q.options.map((o, i) => ({ ...o, isCorrect: i === oi })) }));

  const addQuestion = () =>
    setQuiz((prev) => prev ? {
      ...prev,
      questions: [...prev.questions, {
        text: '', score: 20,
        options: [
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
        ],
      }],
    } : prev);

  const deleteQ = (qi: number) =>
    setQuiz((prev) => prev ? { ...prev, questions: prev.questions.filter((_, i) => i !== qi) } : prev);

  const handleSave = async () => {
    if (!selectedId || !quiz) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ingang/quizzes/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quiz),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setQuiz({
        passScore: saved.passScore,
        maxTries:  saved.maxTries,
        examCond:  saved.examCond,
        questions: (saved.questions ?? []).map((q: { text: string; score: number; options: { text: string; isCorrect: boolean }[] }) => ({
          text: q.text, score: q.score,
          options: q.options.map((o: { text: string; isCorrect: boolean }) => ({ text: o.text, isCorrect: o.isCorrect })),
        })),
      });
      alert('저장 완료!');
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const selectedLec = lectures.find((l) => l.id === selectedId);
  const questions   = quiz?.questions ?? [];

  return (
    <div className="flex-1 overflow-hidden flex gap-4">
      {/* Left: lecture list */}
      <div className="w-[220px] shrink-0 bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex flex-col">
        <div className="px-3.5 py-2.5 border-b border-[#f1f5f9] text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">강의 목록</div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
          ) : lectures.length === 0 ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-6">등록된 강의가 없습니다</p>
          ) : (
            lectures.map((l) => (
              <div
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className="px-3.5 py-2.5 border-b border-[#f1f5f9] cursor-pointer hover:bg-gray-50 last:border-none"
                style={selectedId === l.id ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 11 } : {}}
              >
                <p className="text-[12.5px] font-semibold text-[#111827] truncate">{l.title}</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">{[...l.subjects, ...l.levels].join(' · ') || '—'}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: exam editor */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f6f8] rounded-[10px]">
        {quizLoading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">불러오는 중...</div>
        ) : !selectedLec ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">강의를 선택해주세요</div>
        ) : (
          <>
            <div className="px-4 py-3 bg-white border-b border-[#e2e8f0] flex items-center justify-between shrink-0 rounded-t-[10px]">
              <span className="text-[13px] font-semibold text-[#1a2535]">{selectedLec.title} — 시험 출제</span>
              <div className="flex items-center gap-3 text-[12px] text-[#6b7280]">
                <span>총 {questions.length}문제</span>
                <span className="flex items-center gap-1.5">
                  합격 기준
                  <input
                    type="number" value={quiz?.passScore ?? 70}
                    onChange={(e) => setQuiz((p) => p ? { ...p, passScore: +e.target.value } : p)}
                    className="w-14 text-center text-[12.5px] px-2 py-1 border border-[#e2e8f0] rounded-[6px] bg-[#f9fafb] outline-none"
                  />
                  점 이상
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3.5">
              {questions.map((q, qi) => (
                <div key={qi} className="bg-white border border-[#e2e8f0] rounded-[10px] p-4 mb-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[12px] font-bold" style={{ background: '#EEEDFE', color: '#a78bfa' }}>{qi + 1}번</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#6b7280] flex items-center gap-1.5">
                        배점
                        <input
                          type="number" value={q.score}
                          onChange={(e) => setQ(qi, (x) => ({ ...x, score: +e.target.value }))}
                          className="w-10 text-center text-[12px] px-1.5 py-0.5 border border-[#e2e8f0] rounded bg-[#f9fafb] outline-none"
                        />
                      </span>
                      <button onClick={() => deleteQ(qi)} className="text-[12px] text-[#f87171] cursor-pointer">삭제</button>
                    </div>
                  </div>
                  <input
                    type="text" value={q.text}
                    onChange={(e) => setQ(qi, (x) => ({ ...x, text: e.target.value }))}
                    className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white mb-2.5 font-semibold text-[#111827]"
                    placeholder="문제를 입력하세요"
                  />
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <div
                          onClick={() => markCorrect(qi, oi)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer shrink-0 transition-all select-none"
                          style={opt.isCorrect ? { background: '#a78bfa', color: '#fff' } : { background: '#f1f5f9', color: '#6b7280' }}
                        >
                          {NUMS[oi]}
                        </div>
                        <input
                          type="text" value={opt.text}
                          onChange={(e) => setOpt(qi, oi, (o) => ({ ...o, text: e.target.value }))}
                          className="flex-1 text-[12.5px] px-2.5 py-1.5 border rounded-[7px] bg-[#f9fafb] outline-none focus:bg-white"
                          style={opt.isCorrect ? { borderColor: '#a78bfa', background: '#EEEDFE' } : { borderColor: '#e2e8f0' }}
                          placeholder={`보기 ${oi + 1}`}
                        />
                        {opt.isCorrect && <span className="text-[11px] font-semibold text-[#a78bfa] shrink-0">정답</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={addQuestion}
                className="w-full border-[1.5px] border-dashed border-[#e2e8f0] rounded-[10px] py-3.5 text-[13px] text-[#9ca3af] font-medium hover:border-[#a78bfa] hover:text-[#a78bfa] transition-colors"
              >
                + 문제 추가
              </button>
            </div>
            <div className="px-4 py-3 bg-white border-t border-[#e2e8f0] flex justify-end gap-2 shrink-0 rounded-b-[10px]">
              <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50">임시저장</button>
              <button
                onClick={handleSave} disabled={saving}
                className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white disabled:opacity-60"
                style={{ background: '#5B4FBE' }}
              >
                {saving ? '저장 중...' : '저장 완료'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
