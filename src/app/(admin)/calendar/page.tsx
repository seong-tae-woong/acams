'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { mockCalendarEvents } from '@/lib/mock/calendar';
import type { CalendarEvent } from '@/lib/types/calendar';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

const DAYS_OF_WEEK = ['월', '화', '수', '목', '금', '토', '일'];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  // Convert Sun=0 to Mon=0 index
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function CalendarPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3); // 0-indexed, 3 = April
  const [selectedDate, setSelectedDate] = useState<string | null>('2026-04-17');
  const [showPrivate, setShowPrivate] = useState(true);

  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  const totalCells = Math.ceil((firstDay + days) / 7) * 7;

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const eventsForDate = (dateStr: string) =>
    mockCalendarEvents.filter((e) => e.date === dateStr && (showPrivate || e.isPublic));

  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  const TYPE_COLOR: Record<string, string> = {
    '학원일정': '#4fc3a1',
    '상담일정': '#6366f1',
    '보강일정': '#8b5cf6',
  };

  const prev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="캘린더"
        actions={<Button variant="dark" size="sm" onClick={() => toast('일정 추가 기능은 추후 지원 예정입니다.', 'info')}><Plus size={13} /> 일정 추가</Button>}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 캘린더 */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 헤더 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={prev} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer">
                  <ChevronLeft size={16} className="text-[#6b7280]" />
                </button>
                <span className="text-[15px] font-bold text-[#111827]">{year}년 {month + 1}월</span>
                <button onClick={next} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer">
                  <ChevronRight size={16} className="text-[#6b7280]" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[12px] text-[#6b7280] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrivate}
                    onChange={(e) => setShowPrivate(e.target.checked)}
                    className="accent-[#4fc3a1]"
                  />
                  상담 일정 표시
                </label>
                {/* 범례 */}
                {Object.entries(TYPE_COLOR).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-1 text-[11.5px] text-[#6b7280]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {type}
                  </div>
                ))}
              </div>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-[#e2e8f0]">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className="py-2 text-center text-[11.5px] font-medium text-[#6b7280]">{d}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7">
              {Array.from({ length: totalCells }).map((_, i) => {
                const dayNum = i - firstDay + 1;
                const isValid = dayNum >= 1 && dayNum <= days;
                const dateStr = isValid ? getDateStr(dayNum) : '';
                const events = isValid ? eventsForDate(dateStr) : [];
                const isToday = dateStr === '2026-04-17';
                const isSelected = dateStr === selectedDate;
                const isWeekend = i % 7 >= 5;

                return (
                  <div
                    key={i}
                    onClick={() => isValid && setSelectedDate(dateStr)}
                    className={clsx(
                      'min-h-[90px] p-1.5 border-b border-r border-[#f1f5f9] transition-colors',
                      isValid ? 'cursor-pointer hover:bg-[#f9fafb]' : '',
                      isSelected ? 'bg-[#f0fdf9]' : '',
                    )}
                  >
                    {isValid && (
                      <>
                        <div className={clsx(
                          'w-7 h-7 flex items-center justify-center rounded-full text-[12.5px] font-medium mb-1',
                          isToday ? 'bg-[#4fc3a1] text-white' : isWeekend ? 'text-[#6366f1]' : 'text-[#374151]',
                        )}>
                          {dayNum}
                        </div>
                        <div className="space-y-0.5">
                          {events.slice(0, 3).map((ev) => (
                            <div
                              key={ev.id}
                              className="text-[10px] px-1.5 py-0.5 rounded-[4px] text-white truncate"
                              style={{ backgroundColor: ev.color }}
                            >
                              {ev.title}
                            </div>
                          ))}
                          {events.length > 3 && (
                            <div className="text-[10px] text-[#9ca3af] pl-1">+{events.length - 3}개</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측: 선택한 날 일정 */}
        <div className="w-64 shrink-0 border-l border-[#e2e8f0] bg-white overflow-y-auto">
          <div className="px-4 py-3 border-b border-[#e2e8f0]">
            <div className="text-[12.5px] font-semibold text-[#111827]">
              {selectedDate ? `${selectedDate.slice(5, 7)}월 ${selectedDate.slice(8)}일` : '날짜 선택'}
            </div>
          </div>
          {selectedEvents.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-[#9ca3af]">일정 없음</div>
          ) : (
            <div className="p-3 space-y-2">
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="p-3 rounded-[8px] border border-[#e2e8f0]" style={{ borderLeftColor: ev.color, borderLeftWidth: 3 }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10.5px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: ev.color }}>
                      {ev.type}
                    </span>
                    {!ev.isPublic && <span className="text-[10px] text-[#9ca3af]">비공개</span>}
                  </div>
                  <div className="text-[12.5px] font-medium text-[#111827]">{ev.title}</div>
                  {(ev.startTime || ev.endTime) && (
                    <div className="text-[11.5px] text-[#6b7280] mt-0.5">{ev.startTime} ~ {ev.endTime}</div>
                  )}
                  {ev.description && (
                    <div className="text-[11px] text-[#9ca3af] mt-1">{ev.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
