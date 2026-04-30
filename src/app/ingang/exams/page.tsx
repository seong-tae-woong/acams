'use client';
import { useState } from 'react';

type Option = { text: string; correct: boolean };
type Question = { text: string; score: number; options: Option[] };
type Lecture = { id: number; name: string; teacher: string; qCount: number | null; editing?: boolean };

const LECTURES: Lecture[] = [
  { id: 1, name: '초등수학 기초 1강', teacher: '박선생', qCount: 5 },
  { id: 2, name: '초등수학 기초 2강', teacher: '박선생', qCount: 4 },
  { id: 3, name: '초등수학 기초 3강', teacher: '박선생', qCount: 2, editing: true },
  { id: 4, name: '영어 파닉스 1강',  teacher: '이선생', qCount: 5 },
  { id: 5, name: '영어 파닉스 2강',  teacher: '이선생', qCount: null },
];

const INITIAL_QUESTIONS: Question[] = [
  {
    text: '3 × 4의 값은 얼마인가요?',
    score: 50,
    options: [
      { text: '10', correct: false },
      { text: '11', correct: false },
      { text: '12', correct: true },
      { text: '13', correct: false },
    ],
  },
  {
    text: '5 × 7의 값은 얼마인가요?',
    score: 50,
    options: [
      { text: '30', correct: false },
      { text: '35', correct: true },
      { text: '40', correct: false },
      { text: '45', correct: false },
    ],
  },
];

const NUMS = ['①','②','③','④','⑤'];

export default function ExamsPage() {
  const [selectedLec, setSelectedLec] = useState(3);
  const [passScore,   setPassScore]   = useState(70);
  const [questions,   setQuestions]   = useState<Question[]>(INITIAL_QUESTIONS);

  const setQ = (qi: number, fn: (q: Question) => Question) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? fn(q) : q)));

  const setOpt = (qi: number, oi: number, fn: (o: Option) => Option) =>
    setQ(qi, (q) => ({ ...q, options: q.options.map((o, i) => (i === oi ? fn(o) : o)) }));

  const markCorrect = (qi: number, oi: number) =>
    setQ(qi, (q) => ({
      ...q,
      options: q.options.map((o, i) => ({ ...o, correct: i === oi })),
    }));

  const addQuestion = () =>
    setQuestions((qs) => [
      ...qs,
      { text: '', score: 20, options: [{ text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }] },
    ]);

  const deleteQ = (qi: number) => setQuestions((qs) => qs.filter((_, i) => i !== qi));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">시험 출제</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강 · 시험 관리</span>
        <div className="ml-auto flex gap-2">
          <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50">미리보기</button>
          <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white" style={{ background: '#5B4FBE' }}>저장</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Lecture list */}
        <div className="w-[220px] border-r border-[#e2e8f0] bg-white shrink-0 flex flex-col">
          <div className="px-3.5 py-2.5 border-b border-[#f1f5f9] text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">강의 목록</div>
          <div className="flex-1 overflow-y-auto">
            {LECTURES.map((l) => (
              <div
                key={l.id}
                onClick={() => setSelectedLec(l.id)}
                className="px-3.5 py-2.5 border-b border-[#f1f5f9] cursor-pointer hover:bg-gray-50 last:border-none"
                style={selectedLec === l.id ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 11 } : {}}
              >
                <p className="text-[12.5px] font-semibold text-[#111827]">{l.name}</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">{l.teacher}</p>
                {l.qCount !== null ? (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold" style={{ background: '#EEEDFE', color: '#534AB7' }}>
                    문제 {l.qCount}개{l.editing ? ' (편집 중)' : ''}
                  </span>
                ) : (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10.5px]" style={{ background: '#f1f5f9', color: '#9ca3af' }}>시험 없음</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Exam editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f6f8]">
          {/* Editor header */}
          <div className="px-4 py-3 bg-white border-b border-[#e2e8f0] flex items-center justify-between shrink-0">
            <span className="text-[13px] font-semibold text-[#1a2535]">
              {LECTURES.find((l) => l.id === selectedLec)?.name} — 시험 출제
            </span>
            <div className="flex items-center gap-3 text-[12px] text-[#6b7280]">
              <span>총 {questions.length}문제</span>
              <span className="flex items-center gap-1.5">
                합격 기준
                <input
                  type="number" value={passScore} onChange={(e) => setPassScore(+e.target.value)}
                  className="w-14 text-center text-[12.5px] px-2 py-1 border border-[#e2e8f0] rounded-[6px] bg-[#f9fafb] outline-none"
                />
                점 이상
              </span>
            </div>
          </div>

          {/* Questions */}
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
                        style={opt.correct
                          ? { background: '#a78bfa', color: '#fff' }
                          : { background: '#f1f5f9', color: '#6b7280' }}
                      >
                        {NUMS[oi]}
                      </div>
                      <input
                        type="text" value={opt.text}
                        onChange={(e) => setOpt(qi, oi, (o) => ({ ...o, text: e.target.value }))}
                        className="flex-1 text-[12.5px] px-2.5 py-1.5 border rounded-[7px] bg-[#f9fafb] outline-none focus:bg-white"
                        style={opt.correct ? { borderColor: '#a78bfa', background: '#EEEDFE' } : { borderColor: '#e2e8f0' }}
                        placeholder={`보기 ${oi + 1}`}
                      />
                      {opt.correct && <span className="text-[11px] font-semibold text-[#a78bfa] shrink-0">정답</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Add question */}
            <button
              onClick={addQuestion}
              className="w-full border-[1.5px] border-dashed border-[#e2e8f0] rounded-[10px] py-3.5 text-[13px] text-[#9ca3af] font-medium hover:border-[#a78bfa] hover:text-[#a78bfa] transition-colors"
            >
              + 문제 추가
            </button>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-white border-t border-[#e2e8f0] flex justify-end gap-2 shrink-0">
            <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50">임시저장</button>
            <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white" style={{ background: '#5B4FBE' }}>저장 완료</button>
          </div>
        </div>
      </div>
    </div>
  );
}
