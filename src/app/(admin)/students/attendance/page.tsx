'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Badge from '@/components/shared/Badge';
import Avatar from '@/components/shared/Avatar';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useAttendanceStore } from '@/lib/stores/attendanceStore';
import { AttendanceStatus } from '@/lib/types/attendance';
import { StudentStatus } from '@/lib/types/student';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

export default function StudentAttendancePage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const { students, selectedStudentId, setSelectedStudent } = useStudentStore();
  const { getRecordsByStudent } = useAttendanceStore();

  const activeStudents = students.filter((s) => s.status === StudentStatus.ACTIVE);
  const selected = students.find((s) => s.id === selectedStudentId) ?? activeStudents[0];

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const records = selected ? getRecordsByStudent(selected.id, monthStr) : [];

  const recordMap: Record<string, AttendanceStatus> = {};
  records.forEach((r) => { recordMap[r.date] = r.status; });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=일

  const presentDays = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const totalDays = records.length;
  const rate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="출결 현황" badge="조회 전용" />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 학생 목록 */}
        <div className="w-48 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {activeStudents.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStudent(s.id)}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2.5 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer',
                selected?.id === s.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
              )}
            >
              <Avatar name={s.name} color={s.avatarColor} size="sm" />
              <div>
                <div className="text-[12.5px] font-medium text-[#111827]">{s.name}</div>
                <div className="text-[11px] text-[#9ca3af]">{s.school}</div>
              </div>
            </button>
          ))}
        </div>

        {/* 우측: 캘린더 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {selected && (
            <>
              {/* 통계 카드 */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '출석', value: `${records.filter(r => r.status === AttendanceStatus.PRESENT).length}일`, color: '#065f46', bg: '#D1FAE5' },
                  { label: '결석', value: `${records.filter(r => r.status === AttendanceStatus.ABSENT).length}일`, color: '#991B1B', bg: '#FEE2E2' },
                  { label: '지각', value: `${records.filter(r => r.status === AttendanceStatus.LATE).length}일`, color: '#92400E', bg: '#FEF3C7' },
                  { label: '출석률', value: `${rate}%`, color: '#0D9E7A', bg: '#E1F5EE' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                    <div className="text-[20px] font-bold" style={{ color: stat.color }}>{stat.value}</div>
                    <div className="text-[11.5px] text-[#6b7280] mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* 월 선택 + 캘린더 */}
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={prevMonth} className="p-1 hover:bg-[#f1f5f9] rounded cursor-pointer"><ChevronLeft size={16} /></button>
                  <span className="text-[14px] font-semibold text-[#111827]">{year}년 {month}월</span>
                  <button onClick={nextMonth} className="p-1 hover:bg-[#f1f5f9] rounded cursor-pointer"><ChevronRight size={16} /></button>
                </div>

                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 mb-2">
                  {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                    <div key={d} className="text-center text-[11.5px] text-[#9ca3af] py-1">{d}</div>
                  ))}
                </div>

                {/* 날짜 셀 */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const status = recordMap[dateStr];
                    return (
                      <div key={day} className="aspect-square flex flex-col items-center justify-center rounded-[6px] text-[11.5px]">
                        <span className="text-[#374151] font-medium">{day}</span>
                        {status && (
                          <span className={clsx('text-[9px] font-bold w-5 text-center rounded-full mt-0.5', STATUS_COLORS[status])}>
                            {STATUS_SHORT[status]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 범례 */}
                <div className="flex gap-4 mt-4 pt-3 border-t border-[#f1f5f9]">
                  {Object.entries(STATUS_SHORT).map(([s, short]) => (
                    <div key={s} className="flex items-center gap-1">
                      <span className={clsx('w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center', STATUS_COLORS[s])}>{short}</span>
                      <span className="text-[11.5px] text-[#6b7280]">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
