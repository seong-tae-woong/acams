'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import { Delete, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, LogOut, Eye, EyeOff, X, Play } from 'lucide-react';
import { LectureQuizModal } from '@/components/ingang/LectureQuizModal';

// ────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────
type LectureInfo = { lectureId: string; title: string; duration: string; note: string | null };
type ClassInfo = { classId: string; className: string; subject: string; color: string; lectures: LectureInfo[] };
type StudentInfo = { id: string; name: string; attendanceNumber: string; avatarColor: string };
type FullLecture = LectureInfo & { description: string; cfVideoId: string | null; videoUrl: string | null; teacherName: string | null };

type Phase = 'IDLE' | 'LOOKING_UP' | 'LOOKED_UP' | 'APPROVING' | 'LOADING_LECTURES' | 'PLAYING';

// Cloudflare Stream Player SDK 타입 (https://developers.cloudflare.com/stream/uploading-videos/player-api/)
type StreamPlayer = {
  addEventListener: (ev: string, cb: () => void) => void;
  removeEventListener: (ev: string, cb: () => void) => void;
  currentTime: number;
  duration?: number;
};
declare global {
  interface Window {
    Stream?: (el: HTMLIFrameElement) => StreamPlayer;
  }
}

type LectureProgress = { watchedSeconds: number; pct: number; completed: boolean; durationUnknown?: boolean };

// ────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;  // LOOKED_UP 상태에서 5분 무동작 → IDLE
const PROGRESS_FLUSH_MS = 5_000;        // 진도 보고 throttle
const PROGRESS_QUEUE_MAX = 24;          // 메모리 큐 상한 (2분치)
const DAY_KO: Record<number, string> = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };

function todayLabel() {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_KO[d.getDay()]})`;
}

// ────────────────────────────────────────────
// 키패드 컴포넌트
// ────────────────────────────────────────────
function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mx-auto">
      {KEYS.map((k, i) => (
        k === '' ? <div key={i} /> :
        k === '⌫' ? (
          <button key={i}
            onClick={() => onChange(value.slice(0, -1))}
            className="flex items-center justify-center h-14 rounded-[12px] bg-white/10 hover:bg-white/20 active:bg-white/25 text-white transition-colors cursor-pointer"
          >
            <Delete size={18} />
          </button>
        ) : (
          <button key={i}
            onClick={() => value.length < 10 && onChange(value + k)}
            className="h-14 rounded-[12px] bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-[20px] font-semibold transition-colors cursor-pointer"
          >
            {k}
          </button>
        )
      ))}
    </div>
  );
}

// ────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────
export default function IngangTabletPage() {
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [attendanceInput, setAttendanceInput] = useState('');
  const [lookupError, setLookupError] = useState('');

  // LOOKED_UP 데이터
  const [sessionId, setSessionId] = useState('');
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  // APPROVING 데이터
  const [codeInput, setCodeInput] = useState('');
  const [codeVisible, setCodeVisible] = useState(false);
  const [approveError, setApproveError] = useState('');

  // PLAYING 데이터
  const [lectures, setLectures] = useState<FullLecture[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // 인강 시청 진도 (lectureId → progress)
  const [progressByLec, setProgressByLec] = useState<Record<string, LectureProgress>>({});
  const [showQuiz, setShowQuiz] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  // Player + 진도 보고 refs
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<StreamPlayer | null>(null);
  const queueRef = useRef<Array<{ positionSec: number; ts: number }>>([]);
  const lastFlushRef = useRef<number>(0);
  const lastReportedPosRef = useRef<number>(-1);
  const flushInFlightRef = useRef<boolean>(false);

  // 무동작 타임아웃
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetToIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setPhase('IDLE');
    setAttendanceInput('');
    setLookupError('');
    setSessionId('');
    setStudent(null);
    setClasses([]);
    setSelectedClassId('');
    setCodeInput('');
    setCodeVisible(false);
    setApproveError('');
    setLectures([]);
    setCurrentIdx(0);
    setProgressByLec({});
    setShowQuiz(false);
    queueRef.current = [];
    playerRef.current = null;
    lastReportedPosRef.current = -1;
  }, []);

  // LOOKED_UP/APPROVING 상태에서 무동작 5분 → IDLE
  useEffect(() => {
    if (phase === 'LOOKED_UP' || phase === 'APPROVING') {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(resetToIdle, IDLE_TIMEOUT_MS);
    }
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [phase, resetToIdle]);

  // 선택된 반의 강의 목록
  const selectedClass = classes.find((c) => c.classId === selectedClassId);

  // ── 출결번호 조회 ──────────────────────────
  const handleLookup = async () => {
    if (!attendanceInput.trim()) return;
    setPhase('LOOKING_UP');
    setLookupError('');
    try {
      const res = await fetch('/api/ingang-tablet/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceNumber: attendanceInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setLookupError(data.error ?? '오류가 발생했습니다.'); setPhase('IDLE'); return; }

      setSessionId(data.sessionId);
      setStudent(data.student);
      setClasses(data.classes);
      // 반이 1개면 자동 선택
      if (data.classes.length === 1) setSelectedClassId(data.classes[0].classId);
      else setSelectedClassId('');
      setPhase('LOOKED_UP');
    } catch {
      setLookupError('서버 연결에 실패했습니다. 다시 시도해주세요.');
      setPhase('IDLE');
    }
  };

  // ── 강사 코드 승인 ──────────────────────────
  const handleApprove = async () => {
    if (!codeInput.trim() || !selectedClassId) return;
    setPhase('APPROVING');
    setApproveError('');
    try {
      const res = await fetch('/api/ingang-tablet/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, dailyCode: codeInput.trim(), classId: selectedClassId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApproveError(data.error ?? '인증에 실패했습니다.');
        setPhase('LOOKED_UP');
        return;
      }
      // 승인 성공 → 강의 목록 로드
      setPhase('LOADING_LECTURES');
      const lRes = await fetch(`/api/ingang-tablet/lectures?sessionId=${sessionId}&classId=${selectedClassId}`);
      const lData = await lRes.json();
      if (!lRes.ok || !lData.lectures?.length) {
        setApproveError('수강 가능한 강의가 없습니다.');
        setPhase('LOOKED_UP');
        return;
      }
      setLectures(lData.lectures);
      setCurrentIdx(0);
      setPhase('PLAYING');
    } catch {
      setApproveError('서버 오류가 발생했습니다.');
      setPhase('LOOKED_UP');
    }
  };

  // ── 시청 종료 ──────────────────────────────
  const handleEnd = async () => {
    if (sessionId) {
      await fetch('/api/ingang-tablet/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
    resetToIdle();
  };

  const currentLecture = lectures[currentIdx] ?? null;

  // ────────────────────────────────────────────
  // 진도 보고 (서버에서 권위 있게 delta 계산)
  // 클라이언트는 currentPositionSec과 보고 시각만 전송. 네트워크 실패 시 큐 보존 후 재전송.
  // ────────────────────────────────────────────
  const flushProgress = useCallback(async (lectureId: string, cfVideoId: string, isUnload = false) => {
    if (!sessionId || !lectureId || !cfVideoId) return;
    if (flushInFlightRef.current && !isUnload) return;
    const batch = queueRef.current.slice();
    if (batch.length === 0) return;
    flushInFlightRef.current = true;
    queueRef.current = [];
    const lastPos = batch[batch.length - 1].positionSec;
    try {
      const res = await fetch('/api/ingang-tablet/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, lectureId, cfVideoId, currentPositionSec: lastPos, batch }),
        keepalive: isUnload,
      });
      if (!res.ok) {
        // 409 = 영상 교체: 큐 버리고 다음 progress가 새 영상으로 진행
        if (res.status === 409) {
          queueRef.current = [];
          return;
        }
        throw new Error(`progress ${res.status}`);
      }
      const data = await res.json();
      setProgressByLec((prev) => ({
        ...prev,
        [lectureId]: {
          watchedSeconds: data.watchedSeconds ?? 0,
          pct: data.pct ?? 0,
          completed: !!data.completed,
          durationUnknown: !!data.durationUnknown,
        },
      }));
    } catch {
      // 큐 복구 + 최대 길이 cap
      queueRef.current = [...batch, ...queueRef.current].slice(-PROGRESS_QUEUE_MAX);
    } finally {
      flushInFlightRef.current = false;
    }
  }, [sessionId]);

  // ────────────────────────────────────────────
  // 강의 변경 시 Stream Player SDK 연결 + timeupdate 리스너
  // ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    if (!currentLecture?.cfVideoId) return;
    if (!sdkReady) return;
    if (!iframeRef.current) return;
    if (typeof window === 'undefined' || !window.Stream) return;

    const lecId = currentLecture.lectureId;
    const cfId = currentLecture.cfVideoId;
    const iframeEl = iframeRef.current;

    let player: StreamPlayer | null = null;
    try {
      player = window.Stream(iframeEl);
      playerRef.current = player;
    } catch (err) {
      console.warn('[Stream SDK] init fail', err);
      return;
    }

    queueRef.current = [];
    lastReportedPosRef.current = -1;
    lastFlushRef.current = Date.now();

    const onTimeUpdate = () => {
      const p = playerRef.current;
      if (!p) return;
      const t = Math.floor(p.currentTime || 0);
      if (t === lastReportedPosRef.current) return; // 0.25초 단위 폭격 중 중복 제거
      lastReportedPosRef.current = t;
      queueRef.current.push({ positionSec: t, ts: Date.now() });
      if (queueRef.current.length > PROGRESS_QUEUE_MAX) {
        queueRef.current = queueRef.current.slice(-PROGRESS_QUEUE_MAX);
      }
      const now = Date.now();
      if (now - lastFlushRef.current >= PROGRESS_FLUSH_MS) {
        lastFlushRef.current = now;
        void flushProgress(lecId, cfId);
      }
    };

    const onEnded = () => {
      void flushProgress(lecId, cfId);
    };

    player.addEventListener('timeupdate', onTimeUpdate);
    player.addEventListener('ended', onEnded);

    const onBeforeUnload = () => {
      void flushProgress(lecId, cfId, true);
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      try {
        player?.removeEventListener('timeupdate', onTimeUpdate);
        player?.removeEventListener('ended', onEnded);
      } catch {}
      window.removeEventListener('beforeunload', onBeforeUnload);
      void flushProgress(lecId, cfId, true);
      playerRef.current = null;
    };
  }, [phase, currentLecture?.lectureId, currentLecture?.cfVideoId, sdkReady, flushProgress]);

  // ────────────────────────────────────────────
  // IDLE 화면
  // ────────────────────────────────────────────
  if (phase === 'IDLE' || phase === 'LOOKING_UP') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-between p-8 bg-[#0f1a2b]">
        {/* 상단 */}
        <div className="w-full text-center pt-2">
          <p className="text-[#4fc3a1] text-[16px] font-bold">인강 시청</p>
          <p className="text-white/40 text-[12px] mt-1">{todayLabel()}</p>
        </div>

        {/* 중앙 */}
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          <p className="text-white text-[24px] font-bold">출결번호를 입력하세요</p>

          {/* 입력 표시 */}
          <div className="w-full bg-white/10 rounded-[14px] px-5 py-4 text-center">
            <span className="text-white text-[32px] font-mono tracking-[0.2em] font-bold">
              {attendanceInput || <span className="text-white/20">_ _ _ _ _ _ _</span>}
            </span>
          </div>

          <Numpad value={attendanceInput} onChange={setAttendanceInput} />

          {lookupError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-[10px] px-4 py-3 w-full">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span className="text-red-400 text-[13px]">{lookupError}</span>
            </div>
          )}

          <button
            onClick={handleLookup}
            disabled={!attendanceInput.trim() || phase === 'LOOKING_UP'}
            className="w-full bg-[#4fc3a1] text-white text-[16px] font-semibold py-4 rounded-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3db38f] active:bg-[#33a080] transition-colors cursor-pointer"
          >
            {phase === 'LOOKING_UP' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                조회 중...
              </span>
            ) : '강의 시청 요청'}
          </button>
        </div>

        {/* 하단 */}
        <p className="text-white/20 text-[11px] pb-2">인강 전용 태블릿</p>
      </div>
    );
  }

  // ────────────────────────────────────────────
  // LOOKED_UP / APPROVING 화면 (강사 확인)
  // ────────────────────────────────────────────
  if ((phase === 'LOOKED_UP' || phase === 'APPROVING' || phase === 'LOADING_LECTURES') && student) {
    const isProcessing = phase === 'APPROVING' || phase === 'LOADING_LECTURES';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f1a2b]">
        <div className="w-full max-w-md bg-[#1a2535] rounded-[24px] overflow-hidden shadow-2xl">

          {/* 학생 헤더 */}
          <div className="px-6 pt-6 pb-4 flex items-center gap-4 border-b border-white/10">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[18px] font-bold shrink-0"
              style={{ backgroundColor: student.avatarColor }}
            >
              {student.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[18px] font-bold">{student.name}</p>
              <p className="text-white/50 text-[12px] font-mono mt-0.5">출결번호 {student.attendanceNumber}</p>
            </div>
            <button onClick={resetToIdle} className="text-white/30 hover:text-white/60 cursor-pointer transition-colors">
              <X size={20} />
            </button>
          </div>

          {classes.length === 0 ? (
            <div className="px-6 py-8 flex flex-col items-center text-center gap-3">
              <AlertCircle size={32} className="text-amber-400" />
              <p className="text-white text-[15px] font-semibold">수강 중인 반이 없습니다</p>
              <p className="text-white/45 text-[12.5px] leading-relaxed">
                {student.name} 학생은 배정된 반이 없어 인강을 시청할 수 없습니다.<br />
                관리자에게 반 배정을 문의해주세요.
              </p>
              <button
                onClick={resetToIdle}
                className="mt-2 w-full bg-white/10 text-white/70 rounded-[12px] py-3.5 text-[14px] font-medium cursor-pointer hover:bg-white/15 transition-colors"
              >
                닫기
              </button>
            </div>
          ) : (
            <>

          {/* 반 선택 (2개 이상인 경우) */}
          {classes.length > 1 && (
            <div className="px-6 py-4 border-b border-white/10">
              <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-3">오늘 들을 강의 선택</p>
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => (
                  <button
                    key={c.classId}
                    onClick={() => !isProcessing && setSelectedClassId(c.classId)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-medium cursor-pointer transition-all"
                    style={selectedClassId === c.classId
                      ? { backgroundColor: c.color + '30', color: c.color, border: `2px solid ${c.color}` }
                      : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: '2px solid transparent' }
                    }
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.className}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 오늘 들을 인강 목록 */}
          {selectedClass && (
            <div className="px-6 py-4 border-b border-white/10 max-h-52 overflow-y-auto">
              <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-3">
                오늘의 인강 — {selectedClass.className}
              </p>
              {selectedClass.lectures.length === 0 ? (
                <p className="text-white/30 text-[12.5px]">배정된 강의가 없습니다.</p>
              ) : (
                <div className="space-y-2.5">
                  {selectedClass.lectures.map((l, i) => (
                    <div key={l.lectureId} className="flex items-start gap-3">
                      <span className="text-white/30 text-[12px] w-4 shrink-0 mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[13px] font-medium truncate">{l.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-white/40 text-[11px]">{l.duration}</span>
                          {l.note && (
                            <span className="text-[#a78bfa] text-[11px]">💬 {l.note}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 강사 인증 코드 입력 */}
          <div className="px-6 py-5">
            <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-3">강사 인증 코드</p>
            <div className="relative mb-3">
              <input
                type={codeVisible ? 'text' : 'password'}
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value); setApproveError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && !isProcessing && selectedClassId && handleApprove()}
                placeholder="6자리 코드 입력"
                disabled={isProcessing}
                maxLength={10}
                className="w-full bg-white/10 text-white placeholder-white/20 rounded-[10px] px-4 py-3 pr-12 text-[18px] font-mono tracking-widest text-center outline-none focus:ring-2 focus:ring-[#a78bfa] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setCodeVisible((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 cursor-pointer transition-colors"
              >
                {codeVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {approveError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-[10px] px-3 py-2.5 mb-3">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span className="text-red-400 text-[12.5px]">{approveError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={resetToIdle}
                disabled={isProcessing}
                className="flex-1 bg-white/10 text-white/60 rounded-[12px] py-3.5 text-[14px] font-medium cursor-pointer hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing || !codeInput.trim() || !selectedClassId}
                className="flex-2 flex-1 bg-[#a78bfa] text-white rounded-[12px] py-3.5 text-[14px] font-semibold cursor-pointer hover:bg-[#9370e8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {phase === 'LOADING_LECTURES' ? '강의 로딩 중...' : '인증 중...'}
                  </span>
                ) : '승인하고 시청'}
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────
  // PLAYING 화면 (강의 플레이어)
  // ────────────────────────────────────────────
  if (phase === 'PLAYING' && currentLecture) {
    const hasPrev = currentIdx > 0;
    const hasNext = currentIdx < lectures.length - 1;
    const iframeUrl = currentLecture.cfVideoId
      ? `https://iframe.videodelivery.net/${currentLecture.cfVideoId}`
      : currentLecture.videoUrl ?? '';
    const lecProgress = progressByLec[currentLecture.lectureId];
    const pct = lecProgress?.pct ?? 0;
    const completed = lecProgress?.completed ?? false;

    return (
      <div className="min-h-screen flex flex-col bg-[#0f1a2b]">
        {/* Cloudflare Stream Player SDK — iframe과 별개로 부모 페이지에서도 timeupdate 이벤트 수신 가능 */}
        <Script
          src="https://embed.cloudflarestream.com/embed/sdk.latest.js"
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onReady={() => setSdkReady(true)}
        />
        {/* 플레이어 헤더 */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-white/10 shrink-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
            style={{ backgroundColor: student?.avatarColor ?? '#4fc3a1' }}
          >
            {student?.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold truncate">{currentLecture.title}</p>
            <p className="text-white/40 text-[11px]">{student?.name} · {currentIdx + 1}/{lectures.length}</p>
          </div>
          <button
            onClick={() => setShowQuiz(true)}
            className="flex items-center gap-1.5 text-[12px] cursor-pointer transition-colors rounded-[8px] px-3 py-1.5"
            style={completed
              ? { background: '#a78bfa', color: 'white', boxShadow: '0 0 0 2px rgba(167,139,250,0.25)' }
              : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.15)' }
            }
            title={completed ? '완강하셨습니다 — 시험 보기' : '시험 응시 (영상 완강 후 활성화)'}
          >
            <CheckCircle size={13} />
            {completed ? '시험 응시' : '시험'}
          </button>
          <button
            onClick={handleEnd}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-[12px] cursor-pointer transition-colors border border-white/15 rounded-[8px] px-3 py-1.5"
          >
            <LogOut size={13} />
            시청 종료
          </button>
        </div>

        {/* 영상 영역 */}
        <div className="flex-1 relative bg-black">
          {iframeUrl ? (
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              className="w-full h-full absolute inset-0"
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title={currentLecture.title}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/40">
              <p className="text-[14px]">영상이 준비되지 않았습니다.</p>
            </div>
          )}
          {/* 진도 바 (영상 위 하단 오버레이) */}
          {currentLecture.cfVideoId && (
            <div className="absolute left-0 right-0 bottom-0 pointer-events-none">
              <div className="bg-gradient-to-t from-black/60 to-transparent px-5 pt-6 pb-2 flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-[width] duration-300"
                    style={{ width: `${Math.min(100, pct)}%`, background: completed ? '#10b981' : '#a78bfa' }}
                  />
                </div>
                <div className="text-white/80 text-[11.5px] font-medium tabular-nums">
                  {lecProgress?.durationUnknown ? '영상 준비 중' : `${pct}%`}
                  {completed && <span className="ml-1.5 text-[#10b981]">완강</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 시험 모달 */}
        {showQuiz && (
          <LectureQuizModal
            sessionId={sessionId}
            lectureId={currentLecture.lectureId}
            lectureTitle={currentLecture.title}
            onClose={() => setShowQuiz(false)}
          />
        )}

        {/* 하단 네비게이션 */}
        <div className="shrink-0 border-t border-white/10 bg-[#1a2535]">
          {/* 코멘트 */}
          {currentLecture.note && (
            <div className="px-5 py-2.5 border-b border-white/10 flex items-start gap-2">
              <span className="text-[#a78bfa] text-[13px] shrink-0">💬</span>
              <p className="text-[#a78bfa] text-[12.5px] leading-relaxed">{currentLecture.note}</p>
            </div>
          )}

          {/* 강의 목록 */}
          <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto">
            {hasPrev && (
              <button
                onClick={() => setCurrentIdx((i) => i - 1)}
                className="flex items-center gap-1 text-white/50 hover:text-white text-[12px] cursor-pointer transition-colors shrink-0"
              >
                <ChevronLeft size={16} /> 이전
              </button>
            )}
            <div className="flex gap-2 flex-1 overflow-x-auto">
              {lectures.map((l, i) => (
                <button
                  key={l.lectureId}
                  onClick={() => setCurrentIdx(i)}
                  className="shrink-0 px-3 py-1.5 rounded-[8px] text-[11.5px] font-medium cursor-pointer transition-all"
                  style={i === currentIdx
                    ? { backgroundColor: '#a78bfa', color: 'white' }
                    : { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
                  }
                >
                  {i + 1}. {l.title}
                </button>
              ))}
            </div>
            {hasNext && (
              <button
                onClick={() => setCurrentIdx((i) => i + 1)}
                className="flex items-center gap-1 text-white/50 hover:text-white text-[12px] cursor-pointer transition-colors shrink-0"
              >
                다음 <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // fallback (phase 매칭 안 되는 경우)
  return null;
}
