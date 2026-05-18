'use client';
import { useState, useEffect } from 'react';
import { useAttendanceStore } from '@/lib/stores/attendanceStore';
import { AttendanceStatus } from '@/lib/types/attendance';
import type { Student } from '@/lib/types/student';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const ATT_STATUS_COLORS: Record<string, string> = {
  [AttendanceStatus.PRESENT]: 'bg-[#D1FAE5] text-[#065f46]',
  [AttendanceStatus.ABSENT]: 'bg-[#FEE2E2] text-[#991B1B]',
  [AttendanceStatus.LATE]: 'bg-[#FEF3C7] text-[#92400E]',
  [AttendanceStatus.EARLY_LEAVE]: 'bg-[#DBEAFE] text-[#1d4ed8]',
};
const ATT_STATUS_SHORT: Record<string, string> = {
  [AttendanceStatus.PRESENT]: '출',
  [AttendanceStatus.ABSENT]: '결',
  [AttendanceStatus.LATE]: '지',
  [AttendanceStatus.EARLY_LEAVE]: '조',
};

export default function AttendanceTab({ student }: { student: Student }) {
  const { getRecordsByStudent, fetchByStudentMonth } = useAttendanceStore();
  const [attYear, setAttYear] = useState(() => new Date().getFullYear());
  const [attMonth, setAttMonth] = useState(() => new Date().getMonth() + 1);

  const attMonthStr = `${attYear}-${String(attMonth).padStart(2, '0')}`;
  useEffect(() => {
    fetchByStudentMonth(student.id, attMonthStr);
  }, [student.id, attMonthStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const attRecords = getRecordsByStudent(student.id, attMonthStr);
  const attRecordMap: Record<string, AttendanceStatus> = {};
  attRecords.forEach((r) => { attRecordMap[r.date] = r.status; });
  const attDaysInMonth = new Date(attYear, attMonth, 0).getDate();
  const attFirstDay = new Date(attYear, attMonth - 1, 1).getDay();
  const attPresentDays = attRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const attTotalDays = attRecords.length;
  const attRate = attTotalDays > 0 ? Math.round((attPresentDays / attTotalDays) * 100) : 0;

  const attCells: (number | null)[] = [
    ...Array.from({ length: attFirstDay }, () => null),
    ...Array.from({ length: attDaysInMonth }, (_, i) => i + 1),
  ];
  while (attCells.length < 42) attCells.push(null);
  const attWeeks: (number | null)[][] = Array.from({ length: 6 }, (_, i) => attCells.slice(i * 7, (i + 1) * 7));

  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: '출석', value: `${attPresentDays}일`, color: '#065f46' },
          { label: '결석', value: `${attRecords.filter((r) => r.status === AttendanceStatus.ABSENT).length}일`, color: '#991B1B' },
          { label: '지각', value: `${attRecords.filter((r) => r.status === AttendanceStatus.LATE).length}일`, color: '#92400E' },
          { label: '출석률', value: `${attRate}%`, color: '#0D9E7A' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#f4f6f8] rounded-[8px] p-3 text-center">
            <div className="text-[16px] font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[11.5px] text-[#6b7280] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
      {/* 월 선택 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { if (attMonth === 1) { setAttMonth(12); setAttYear((y) => y - 1); } else setAttMonth((m) => m - 1); }} className="p-1 hover:bg-[#f1f5f9] rounded cursor-pointer"><ChevronLeft size={16} /></button>
        <span className="text-[14px] font-semibold text-[#111827]">{attYear}년 {attMonth}월</span>
        <button onClick={() => { if (attMonth === 12) { setAttMonth(1); setAttYear((y) => y + 1); } else setAttMonth((m) => m + 1); }} className="p-1 hover:bg-[#f1f5f9] rounded cursor-pointer"><ChevronRight size={16} /></button>
      </div>
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="text-center text-[11.5px] text-[#9ca3af] py-0.5">{d}</div>
        ))}
      </div>
      {/* 날짜 셀 */}
      <div className="flex flex-col gap-1">
        {attWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (day === null) return <div key={di} className="h-10" />;
              const dateStr = `${attYear}-${String(attMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const status = attRecordMap[dateStr];
              return (
                <div key={di} className="h-10 flex flex-col items-center justify-center rounded-[6px] border border-[#f1f5f9] bg-white hover:bg-[#f9fafb]">
                  <span className="text-[12px] text-[#374151] font-semibold leading-none">{day}</span>
                  {status && (
                    <span className={clsx('text-[9px] font-bold px-1 py-0.5 rounded-full mt-1', ATT_STATUS_COLORS[status])}>
                      {ATT_STATUS_SHORT[status]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* 범례 */}
      <div className="flex gap-4 mt-3 pt-3 border-t border-[#f1f5f9]">
        {Object.entries(ATT_STATUS_SHORT).map(([s, short]) => (
          <div key={s} className="flex items-center gap-1">
            <span className={clsx('w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center', ATT_STATUS_COLORS[s])}>{short}</span>
            <span className="text-[11.5px] text-[#6b7280]">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
