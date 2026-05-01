'use client';
import { useEffect, useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useMobileChild } from '@/contexts/MobileChildContext';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE';
type AttendanceRecord = { id: string; date: string; status: AttendanceStatus; className: string; classId: string };

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: '출', ABSENT: '결', LATE: '지', EARLY_LEAVE: '조',
};
const STATUS_STYLE: Record<AttendanceStatus, { bg: string; text: string }> = {
  PRESENT:     { bg: '#D1FAE5', text: '#065f46' },
  ABSENT:      { bg: '#FEE2E2', text: '#991B1B' },
  LATE:        { bg: '#FEF3C7', text: '#92400E' },
  EARLY_LEAVE: { bg: '#DBEAFE', text: '#1d4ed8' },
};
const DAYS = ['월', '화', '수', '목', '금'];

export default function MobileAttendancePage() {
  const { selectedChildId } = useMobileChild();
  const today = new Date();
  const [year] = useState(today.getFullYear());
  const [month] = useState(today.getMonth() + 1);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChildId) return;
    const m = `${year}-${String(month).padStart(2, '0')}`;
    setLoading(true);
    fetch(`/api/mobile/attendance?month=${m}&studentId=${selectedChildId}`)
      .then((r) => r.json())
      .then((data) => { if (data.records) setRecords(data.records); })
      .finally(() => setLoading(false));
  }, [year, month, selectedChildId]);

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const absent  = records.filter((r) => r.status === 'ABSENT').length;
  const late    = records.filter((r) => r.status === 'LATE').length;
  const rate    = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  const byDate = records.reduce<Record<string, AttendanceRecord>>((acc, r) => { acc[r.date] = r; return acc; }, {});

  // 월별 주차 생성
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: string[][] = [];
  let currentWeek: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dow = new Date(year, month - 1, i).getDay();
    if (dow === 1 || currentWeek.length === 0) {
      if (currentWeek.length > 0) weeks.push(currentWeek);
      currentWeek = [];
    }
    if (dow >= 1 && dow <= 5) {
      currentWeek.push(`${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return (
    <div className="flex flex-col pb-20">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">출결 현황</span>
        </div>
        <div className="text-[13px] text-white/60">{year}년 {month}월</div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: '출석률', value: `${rate}%`, color: '#4fc3a1' },
            { label: '출석',   value: `${present}회`, color: '#065f46' },
            { label: '결석',   value: `${absent}회`,  color: '#ef4444' },
            { label: '지각',   value: `${late}회`,    color: '#f59e0b' },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 rounded-[10px] p-2 text-center">
              <div className="text-[15px] font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10.5px] text-white/60 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <MobileContentLoader loading={loading}>
        <div className="px-4 py-4 space-y-3">
          {/* 달력 */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
            <div className="grid grid-cols-5 mb-2">
              {DAYS.map((d) => <div key={d} className="text-center text-[11.5px] font-medium text-[#6b7280]">{d}</div>)}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-5 gap-1 mb-1">
                {week.map((dateStr) => {
                  const day = parseInt(dateStr.slice(8));
                  const rec = byDate[dateStr];
                  const style = rec ? STATUS_STYLE[rec.status] : null;
                  return (
                    <div key={dateStr} className="flex flex-col items-center gap-0.5 py-1">
                      <span className="text-[11px] text-[#9ca3af]">{day}</span>
                      {style ? (
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                          style={{ backgroundColor: style.bg, color: style.text }}>
                          {STATUS_LABEL[rec.status]}
                        </span>
                      ) : <span className="w-7 h-7 rounded-full bg-[#f4f6f8]" />}
                    </div>
                  );
                })}
                {Array.from({ length: 5 - week.length }).map((_, i) => <div key={`e-${i}`} />)}
              </div>
            ))}
          </div>

          {/* 상세 목록 */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0]">
            <div className="px-4 py-3 border-b border-[#f1f5f9]">
              <span className="text-[13px] font-semibold text-[#111827]">출결 상세</span>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {records.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-[#9ca3af]">출결 기록 없음</div>
              ) : [...records].sort((a, b) => b.date.localeCompare(a.date)).map((r) => {
                const style = STATUS_STYLE[r.status];
                return (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[12.5px] text-[#374151]">{r.date.slice(5).replace('-', '/')} ({r.className})</span>
                    <span className="px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold"
                      style={{ backgroundColor: style.bg, color: style.text }}>
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </MobileContentLoader>
      <BottomTabBar />
    </div>
  );
}
