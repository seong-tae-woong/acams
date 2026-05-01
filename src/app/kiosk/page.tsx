'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, QrCode, Wifi, WifiOff, Settings } from 'lucide-react';

interface CheckIn {
  id: string;
  studentName: string;
  className: string;
  checkInTime: string | null;
  status: string;
}

const DAY_NAMES: Record<number, string> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 7: '일' };

function todayLabel() {
  const d = new Date();
  const dow = d.getDay() || 7;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[dow]})`;
}

export default function KioskPage() {
  const [academyParam, setAcademyParam] = useState('');
  const [setupInput, setSetupInput] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [connected, setConnected] = useState(true);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [flashCheckIn, setFlashCheckIn] = useState<CheckIn | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // URL 파라미터 또는 localStorage에서 학원 ID 로드
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    const fromUrl = url.get('academy') ?? url.get('academyId');
    const stored = localStorage.getItem('kiosk_academy');
    const param = fromUrl ?? stored ?? '';
    if (param) {
      setAcademyParam(param);
      if (fromUrl) localStorage.setItem('kiosk_academy', fromUrl);
    }
  }, []);

  const fetchSession = useCallback(async (param: string) => {
    try {
      const res = await fetch(`/api/kiosk/session?academy=${encodeURIComponent(param)}`);
      if (!res.ok) throw new Error('session error');
      const data = await res.json();
      setQrDataUrl(data.qrDataUrl);
      setExpiresAt(new Date(data.expiresAt));
      setAcademyName(data.academyName);
      setCountdown(300);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!academyParam) return;
    fetchSession(academyParam);
  }, [academyParam, fetchSession]);

  // 4분 50초마다 QR 자동 갱신
  useEffect(() => {
    if (!academyParam) return;
    const interval = setInterval(() => fetchSession(academyParam), 290_000);
    return () => clearInterval(interval);
  }, [academyParam, fetchSession]);

  // 카운트다운 타이머
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0 && academyParam) fetchSession(academyParam);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, academyParam, fetchSession]);

  // 최근 체크인 3초 폴링
  useEffect(() => {
    if (!academyParam) return;
    const poll = async () => {
      try {
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const res = await fetch(
          `/api/kiosk/recent?academyId=${encodeURIComponent(academyParam)}&since=${encodeURIComponent(since)}`
        );
        const data = await res.json();
        if (!data.checkIns) return;

        const newOnes: CheckIn[] = data.checkIns.filter((c: CheckIn) => !seenIdsRef.current.has(c.id));
        if (newOnes.length > 0) {
          newOnes.forEach((c) => seenIdsRef.current.add(c.id));
          setFlashCheckIn(newOnes[0]);
          setTimeout(() => setFlashCheckIn(null), 4000);
          setRecentCheckIns((prev) => {
            const combined = [...newOnes, ...prev];
            const seen = new Set<string>();
            return combined.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; }).slice(0, 5);
          });
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [academyParam]);

  const handleSetup = () => {
    const val = setupInput.trim();
    if (!val) return;
    localStorage.setItem('kiosk_academy', val);
    setAcademyParam(val);
  };

  const resetKiosk = () => {
    localStorage.removeItem('kiosk_academy');
    setAcademyParam('');
    setSetupInput('');
    setQrDataUrl('');
    setRecentCheckIns([]);
    seenIdsRef.current.clear();
  };

  // ── 설정 화면 ──────────────────────────────────────────────
  if (!academyParam) {
    return (
      <div className="min-h-screen bg-[#0f1a2b] flex flex-col items-center justify-center p-8">
        <QrCode size={56} className="text-[#4fc3a1] mb-6" />
        <div className="text-white text-[28px] font-bold mb-2">키오스크 설정</div>
        <div className="text-white/50 text-[15px] mb-8 text-center">
          관리자 페이지 설정에서 확인한 학원 ID 또는 슬러그를 입력하세요
        </div>
        <div className="w-full max-w-sm space-y-3">
          <input
            type="text"
            value={setupInput}
            onChange={(e) => setSetupInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
            placeholder="학원 ID 또는 슬러그"
            className="w-full bg-white/10 text-white placeholder-white/30 rounded-[12px] px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-[#4fc3a1]"
          />
          <button
            onClick={handleSetup}
            className="w-full bg-[#4fc3a1] text-white rounded-[12px] py-3 text-[16px] font-semibold cursor-pointer"
          >
            시작하기
          </button>
          <p className="text-white/25 text-[12px] text-center">
            또는 URL에 <code className="text-white/40">?academy=슬러그</code> 파라미터를 추가하세요
          </p>
        </div>
      </div>
    );
  }

  // ── 메인 키오스크 화면 ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f1a2b] flex flex-col items-center justify-between p-8 relative">
      {/* 체크인 알림 플래시 */}
      {flashCheckIn && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#4fc3a1] text-white px-6 py-3 rounded-[16px] shadow-xl flex items-center gap-3">
          <CheckCircle size={20} />
          <span className="font-bold text-[16px]">{flashCheckIn.studentName}</span>
          <span className="text-white/80 text-[13px]">{flashCheckIn.className} 출석</span>
        </div>
      )}

      {/* 연결 상태 + 재설정 */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {connected ? <Wifi size={16} className="text-[#4fc3a1]" /> : <WifiOff size={16} className="text-red-400" />}
        <button onClick={resetKiosk} title="키오스크 재설정" className="text-white/20 hover:text-white/50 cursor-pointer">
          <Settings size={16} />
        </button>
      </div>

      {/* 상단 */}
      <div className="w-full text-center pt-4">
        <div className="text-[#4fc3a1] text-[20px] font-bold mb-1">{academyName}</div>
        <div className="text-white/40 text-[14px]">{todayLabel()} · 출결 체크 키오스크</div>
      </div>

      {/* 중앙: QR */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-white text-[28px] font-bold mb-2">QR 코드를 스캔하세요</div>
        <div className="text-white/50 text-[14px] mb-6">모바일 앱 → 출석 체크에서 카메라로 스캔</div>

        <div className="bg-white p-4 rounded-[20px] shadow-2xl mb-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="출석 QR" width={260} height={260} />
          ) : (
            <div className="w-[260px] h-[260px] flex items-center justify-center">
              {connected
                ? <div className="w-10 h-10 border-4 border-[#4fc3a1] border-t-transparent rounded-full animate-spin" />
                : <WifiOff size={40} className="text-red-400" />
              }
            </div>
          )}
        </div>

        <div className="text-white/40 text-[13px] mb-8">
          QR 갱신까지{' '}
          <span className="text-[#4fc3a1] font-semibold tabular-nums">
            {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
          </span>
        </div>

        {recentCheckIns.length > 0 && (
          <div className="bg-white/5 rounded-[16px] px-6 py-4 w-[320px]">
            <div className="text-white/40 text-[12px] mb-3">최근 출석</div>
            <div className="space-y-2">
              {recentCheckIns.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <CheckCircle size={14} className="text-[#4fc3a1] shrink-0" />
                  <span className="text-white text-[14px] font-medium flex-1">{c.studentName}</span>
                  <span className="text-white/50 text-[12px]">{c.checkInTime}</span>
                  {c.status === 'LATE' && (
                    <span className="text-[10px] text-yellow-400 font-semibold">지각</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-white/20 text-[12px] pb-2">{academyName} 출결 키오스크 v2.0</div>
    </div>
  );
}
