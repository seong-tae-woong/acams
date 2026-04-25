'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import { useAttendanceStore } from '@/lib/stores/attendanceStore';
import { AttendanceStatus } from '@/lib/types/attendance';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const STATUS_COLORS: Record<string, string> = {
  [AttendanceStatus.PRESENT]: 'bg-[#D1FAE5] text-[#065f46]',
  [AttendanceStatus.ABSENT]: 'bg-[#FEE2E2] text-[#991B1B]',
  [AttendanceStatus.LATE]: 'bg-[#FEF3C7] text-[#92400E]',
  [AttendanceStatus.EARLY_LEAVE]: 'bg-[#DBEAFE] text-[#1d4ed8]',
};
const STATUS_SHORT: Record<string, string> = {
  [AttendanceStatus.PRESENT]: '출',
  [AttendanceStatus.ABSENT]: '결',
  [AttendanceStatus.LATE]: '지',
  [AttendanceStatus.EARLY_LEAVE]: '조',
};

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}

export default function AttendanceCalendarModal({ open, onClose, studentId, studentName }: Props) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const { getRecordsByStudent, fetchByStudentMonth } = useAttendanceStore();

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    if (open && studentId) {
      fetchByStudentMonth(studentId, monthStr);
    }
  }, [open, studentId, monthStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const records = studentId ? getRecordsByStudent(studentId, monthStr) : [];
  const recordMap: Record<string, AttendanceStatus> = {};
  records.forEach((r) => { recordMap[r.date] = r.status; });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  const presentDays = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const totalDays = records.length;
  const rate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i * 7, (i + 1) * 7));

  return (
    <Modal open={open} onClose={onClose} title={`${studentName} — 출결 현황`} size="lg">
      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: '출석', value: `${records.filter((r) => r.status === AttendanceStatus.PRESENT).length}일`, color: '#065f46' },
          { label: '결석', value: `${records.filter((r) => r.status === AttendanceStatus.ABSENT).length}일`, color: '#991B1B' },
          { label: '지각', value: `${records.filter((r) => r.status === AttendanceStatus.LATE).length}일`, color: '#92400E' },
          { label: '출석률', value: `${rate}%`, color: '#0D9E7A' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#f4f6f8] rounded-[10px] p-3 text-center">
            <div className="text-[18px] font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[11.5px] text-[#6b7280] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* 월 선택 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 hover:bg-[#f1f5f9] rounded cursor-pointer">
          <ChevronLeft size={16} />
        </button>
        <span className="text-[14px] font-semibold text-[#111827]">{year}년 {month}월</span>
        <button onClick={nextMonth} className="p-1 hover:bg-[#f1f5f9] rounded cursor-pointer">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="text-center text-[11.5px] text-[#9ca3af] py-0.5">{d}</div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="flex flex-col gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (day === null) return <div key={di} className="h-12" />;
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const status = recordMap[dateStr];
              return (
                <div
                  key={di}
                  className="h-12 flex flex-col items-center justify-center rounded-[6px] border border-[#f1f5f9] text-[12.5px] bg-white hover:bg-[#f9fafb] transition-colors"
                >
                  <span className="text-[#374151] font-semibold leading-none">{day}</span>
                  {status && (
                    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1.5', STATUS_COLORS[status])}>
                      {STATUS_SHORT[status]}
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
        {Object.entries(STATUS_SHORT).map(([s, short]) => (
          <div key={s} className="flex items-center gap-1">
            <span className={clsx('w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center', STATUS_COLORS[s])}>
              {short}
            </span>
            <span className="text-[11.5px] text-[#6b7280]">{s}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
