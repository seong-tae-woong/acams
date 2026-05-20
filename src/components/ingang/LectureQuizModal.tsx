'use client';
import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';

type Option = { id: string; text: string };
type Question = { id: string; text: string; score: number; options: Option[] };

type StartResp = {
  quizId: string;
  passScore: number;
  maxTries: number;
  attemptCount: number;
  questions: Question[];
};

type BlockedResp = {
  blocked: true;
  reason: 'WATCH_INSUFFICIENT' | 'TRIES_EXHAUSTED';
  detail?: { pct?: number; required?: number; attemptCount?: number; maxTries?: number };
};

type SubmitResp = {
  attemptId: string;
  score: number;
  isPassed: boolean;
  passScore: number;
  triesRemaining: number;
  usedRetryPerm: boolean;
};

type Props = {
  sessionId: string;
  lectureId: string;
  lectureTitle: string;
  onClose: () => void;
};

/**
 * 학생이 인강 시청 완료 후 시험을 응시하는 모달.
 *
 * 상태 흐름:
 *   LOADING → IN_PROGRESS → SUBMITTING → RESULT
 *                                      ↘ RESULT_RETRYABLE (불합격, 남은 횟수 있음)
 *
 *   LOADING → BLOCKED (WATCH_INSUFFICIENT / TRIES_EXHAUSTED)
 *   LOADING → ERROR
 */
export function LectureQuizModal({ sessionId, lectureId, lectureTitle, onClose }: Props) {
  const [phase, setPhase] = useState<'LOADING'|'IN_PROGRESS'|'SUBMITTING'|'RESULT'|'BLOCKED'|'ERROR'>('LOADING');
  const [quiz, setQuiz] = useState<StartResp | null>(null);
  const [blocked, setBlocked] = useState<BlockedResp | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResp | null>(null);

  // 시험 시작
  useEffect(() => {
    let alive = true;
    fetch('/api/ingang-tablet/quiz/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, lectureId }),
    })
      .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json() }))
      .then(({ ok, body }) => {
        if (!alive) return;
        if (body?.blocked) {
          setBlocked(body as BlockedResp);
          setPhase('BLOCKED');
          return;
        }
        if (!ok) {
          setErrorMsg(body?.error ?? '시험을 시작할 수 없습니다.');
          setPhase('ERROR');
          return;
        }
        setQuiz(body as StartResp);
        setPhase('IN_PROGRESS');
      })
      .catch(() => {
        if (alive) { setErrorMsg('네트워크 오류'); setPhase('ERROR'); }
      });
    return () => { alive = false; };
  }, [sessionId, lectureId]);

  const handleSubmit = async () => {
    if (!quiz || phase === 'SUBMITTING') return;
    setPhase('SUBMITTING');
    try {
      const r = await fetch('/api/ingang-tablet/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, lectureId, answers }),
      });
      const body = await r.json();
      if (!r.ok) {
        setErrorMsg(body?.error ?? '제출에 실패했습니다.');
        setPhase('ERROR');
        return;
      }
      setResult(body as SubmitResp);
      setPhase('RESULT');
    } catch {
      setErrorMsg('네트워크 오류');
      setPhase('ERROR');
    }
  };

  const handleRetry = () => {
    // 결과 닫고 모달을 처음부터 다시 (start API 재호출)
    setAnswers({});
    setIdx(0);
    setResult(null);
    setQuiz(null);
    setPhase('LOADING');
    // useEffect는 dep이 안 바뀌므로 수동 fetch
    fetch('/api/ingang-tablet/quiz/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, lectureId }),
    })
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (body?.blocked) { setBlocked(body as BlockedResp); setPhase('BLOCKED'); return; }
        if (!ok) { setErrorMsg(body?.error ?? ''); setPhase('ERROR'); return; }
        setQuiz(body as StartResp);
        setPhase('IN_PROGRESS');
      })
      .catch(() => { setErrorMsg('네트워크 오류'); setPhase('ERROR'); });
  };

  const totalQ = quiz?.questions.length ?? 0;
  const currentQ = quiz?.questions[idx];
  const answeredCount = quiz ? quiz.questions.filter((q) => answers[q.id]).length : 0;
  const allAnswered = quiz ? answeredCount === totalQ : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-[14px] w-full max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
          <div>
            <div className="text-[15px] font-semibold text-[#1a2535]">{lectureTitle} — 시험</div>
            {phase === 'IN_PROGRESS' && quiz && (
              <div className="text-[12px] text-[#6b7280] mt-0.5">
                {idx + 1} / {totalQ} 문항 · 답변 {answeredCount}/{totalQ}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase === 'LOADING' && (
            <div className="text-center text-[13px] text-[#6b7280] py-12">시험을 준비하고 있습니다...</div>
          )}

          {phase === 'BLOCKED' && blocked && (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <AlertCircle size={40} className="text-[#a78bfa]" />
              {blocked.reason === 'WATCH_INSUFFICIENT' && (
                <>
                  <div className="text-[14px] font-semibold text-[#1a2535]">아직 영상을 충분히 시청하지 않았어요</div>
                  <div className="text-[13px] text-[#6b7280] leading-relaxed">
                    현재 {blocked.detail?.pct ?? 0}% 시청 · 응시 가능 기준 {blocked.detail?.required ?? 100}%
                    <br />영상을 끝까지 본 뒤 다시 시험을 시작해 주세요.
                  </div>
                </>
              )}
              {blocked.reason === 'TRIES_EXHAUSTED' && (
                <>
                  <div className="text-[14px] font-semibold text-[#1a2535]">응시 횟수를 모두 사용했습니다</div>
                  <div className="text-[13px] text-[#6b7280] leading-relaxed">
                    {blocked.detail?.attemptCount ?? 0} / {blocked.detail?.maxTries ?? 0}회 응시 완료
                    <br />원장/강사 선생님께 재응시 권한을 요청해 주세요.
                  </div>
                </>
              )}
            </div>
          )}

          {phase === 'IN_PROGRESS' && currentQ && (
            <div className="flex flex-col gap-4">
              <div className="text-[14px] font-medium text-[#111827] leading-relaxed whitespace-pre-wrap">
                <span className="text-[#a78bfa] font-semibold mr-2">Q{idx + 1}.</span>
                {currentQ.text}
              </div>
              <div className="flex flex-col gap-2">
                {currentQ.options.map((o, oi) => {
                  const picked = answers[currentQ.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setAnswers((a) => ({ ...a, [currentQ.id]: o.id }))}
                      className="text-left text-[13px] px-3.5 py-2.5 rounded-[8px] border-[1.5px] transition-colors"
                      style={picked
                        ? { background: '#EEEDFE', color: '#1a2535', borderColor: '#a78bfa' }
                        : { background: '#fff', color: '#374151', borderColor: '#e2e8f0' }}
                    >
                      <span className="mr-2 font-semibold text-[#9ca3af]">{String.fromCharCode(65 + oi)}.</span>
                      {o.text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === 'SUBMITTING' && (
            <div className="text-center text-[13px] text-[#6b7280] py-12">채점 중...</div>
          )}

          {phase === 'RESULT' && result && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              {result.isPassed ? (
                <CheckCircle size={48} className="text-[#10b981]" />
              ) : (
                <AlertCircle size={48} className="text-[#ef4444]" />
              )}
              <div className="text-[16px] font-semibold text-[#1a2535]">
                {result.isPassed ? '합격했어요!' : '불합격입니다'}
              </div>
              <div className="text-[14px] text-[#374151]">
                점수: <span className="font-semibold">{result.score}점</span> / 합격 기준 {result.passScore}점
              </div>
              {!result.isPassed && (
                <div className="text-[12.5px] text-[#6b7280] leading-relaxed">
                  남은 응시 횟수: {result.triesRemaining}회
                  {result.triesRemaining === 0 && (
                    <><br />다음 시도는 원장/강사 재응시 권한 부여 후 가능합니다.</>
                  )}
                </div>
              )}
            </div>
          )}

          {phase === 'ERROR' && (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <AlertCircle size={36} className="text-[#ef4444]" />
              <div className="text-[13px] text-[#374151]">{errorMsg || '시험 진행 중 오류가 발생했습니다.'}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#e2e8f0] flex justify-between items-center gap-2">
          {phase === 'IN_PROGRESS' && quiz && (
            <>
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="text-[13px] px-3.5 py-2 rounded-[8px] border border-[#e2e8f0] bg-white text-[#374151] disabled:opacity-40"
              >
                이전
              </button>
              {idx < totalQ - 1 ? (
                <button
                  onClick={() => setIdx((i) => Math.min(totalQ - 1, i + 1))}
                  className="text-[13px] px-3.5 py-2 rounded-[8px] bg-[#5B4FBE] text-white font-medium flex items-center gap-1"
                >
                  다음 <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered || phase !== 'IN_PROGRESS'}
                  className="text-[13px] px-3.5 py-2 rounded-[8px] bg-[#5B4FBE] text-white font-medium disabled:opacity-40"
                >
                  {allAnswered ? '제출' : `답하지 않은 문항 ${totalQ - answeredCount}개`}
                </button>
              )}
            </>
          )}
          {phase === 'RESULT' && result && (
            <div className="w-full flex justify-end gap-2">
              {!result.isPassed && result.triesRemaining > 0 && (
                <button
                  onClick={handleRetry}
                  className="text-[13px] px-3.5 py-2 rounded-[8px] border border-[#a78bfa] bg-white text-[#5B4FBE] font-medium"
                >
                  다시 풀기
                </button>
              )}
              <button
                onClick={onClose}
                className="text-[13px] px-3.5 py-2 rounded-[8px] bg-[#5B4FBE] text-white font-medium"
              >
                닫기
              </button>
            </div>
          )}
          {(phase === 'BLOCKED' || phase === 'ERROR') && (
            <div className="w-full flex justify-end">
              <button onClick={onClose} className="text-[13px] px-3.5 py-2 rounded-[8px] bg-[#5B4FBE] text-white font-medium">
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
