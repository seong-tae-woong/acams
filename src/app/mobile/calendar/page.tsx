'use client';
import { useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import { mockCalendarEvents } from '@/lib/mock/calendar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

const DAYS_OF_WEEK = ['월', '화', '수', '목', '금', '토', '일'];

function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function firstDay(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function MobileCalendarPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = daysInMonth(year, month);
  const first = firstDay(year, month);
  const totalCells = Math.ceil((first + days) / 7) * 7;
  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const publicEvents = mockCalendarEvents.filter((e) => e.isPublic);
  const eventsForDate = (d: string) => publicEvents.filter((e) => e.date === d);
  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  return (
    <div className="flex flex-col pb-20">
      <div className="bg-[#1a2535] px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
            <span className="text-[17px] font-bold text-white">{year}년 {month + 1}월</span>
          </div>
          <div className="flex gap-2">
            <button onClick={prev} className="p-1 text-white cursor-pointer"><ChevronLeft size={18} /></button>
            <button onClick={next} className="p-1 text-white cursor-pointer"><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      <div className="px-3 py-3">
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-[#f1f5f9]">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="py-2 text-center text-[11px] font-medium text-[#6b7280]">{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, i) => {
              const dayNum = i - first + 1;
              const isValid = dayNum >= 1 && dayNum <= days;
              const dateStr = isValid ? getDateStr(dayNum) : '';
              const events = isValid ? eventsForDate(dateStr) : [];
              const isToday = dateStr === '2026-04-18';
              const isSelected = dateStr === selectedDate;
              const isWeekend = i % 7 >= 5;

              return (
                <div
                  key={i}
                  onClick={() => isValid && setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                  className={clsx(
                    'min-h-[52px] p-1 border-b border-r border-[#f9fafb]',
                    isValid ? 'cursor-pointer' : '',
                    isSelected ? 'bg-[#f0fdf9]' : '',
                  )}
                >
                  {isValid && (
                    <>
                      <div className={clsx(
                        'w-6 h-6 flex items-center justify-center rounded-full text-[11.5px] font-medium mx-auto mb-0.5',
                        isToday ? 'bg-[#4fc3a1] text-white' : isWeekend ? 'text-[#6366f1]' : 'text-[#374151]',
                      )}>
                        {dayNum}
                      </div>
                      <div className="space-y-0.5">
                        {events.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className="text-[8px] px-1 py-0.5 rounded text-white truncate"
                            style={{ backgroundColor: ev.color }}
                          >
                            {ev.title.slice(0, 5)}
                          </div>
                        ))}
                        {events.length > 2 && <div className="text-[8px] text-[#9ca3af] pl-0.5">+{events.length - 2}</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 선택한 날 일정 */}
        {selectedDate && (
          <div className="mt-3 bg-white rounded-[12px] border border-[#e2e8f0] p-4">
            <div className="text-[12.5px] font-semibold text-[#111827] mb-2">
              {selectedDate.slice(5, 7)}월 {selectedDate.slice(8)}일 일정
            </div>
            {selectedEvents.length === 0 ? (
              <div className="text-[12px] text-[#9ca3af]">일정 없음</div>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: ev.color }} />
                    <div>
                      <div className="text-[12.5px] font-medium text-[#111827]">{ev.title}</div>
                      {ev.startTime && <div className="text-[11.5px] text-[#6b7280]">{ev.startTime}~{ev.endTime}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <BottomTabBar />
    </div>
  );
}
