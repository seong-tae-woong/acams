'use client';
import { useEffect, useState, useCallback } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

type CalendarEventItem = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  type: string;
  isPublic: boolean;
  description: string;
  color: string;
  classId: string | null;
  className: string | null;
};

const DAYS_OF_WEEK = ['월', '화', '수', '목', '금', '토', '일'];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDay(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function MobileCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvents = useCallback(() => {
    setLoading(true);
    fetch(`/api/mobile/calendar?year=${year}&month=${month + 1}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setEvents(data.events);
      })
      .catch(() => setError('데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const days = daysInMonth(year, month);
  const first = firstDay(year, month);
  const totalCells = Math.ceil((first + days) / 7) * 7;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const eventsForDate = (d: string) => events.filter((e) => e.date === d);
  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  const prev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
  };
  const next = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDate(null);
  };

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

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-[13px] text-red-400">{error}</div>
      ) : (
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
                const dayEvents = isValid ? eventsForDate(dateStr) : [];
                const isToday = dateStr === todayStr;
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
                          {dayEvents.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              className="text-[8px] px-1 py-0.5 rounded text-white truncate"
                              style={{ backgroundColor: ev.color }}
                            >
                              {ev.title.slice(0, 5)}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[8px] text-[#9ca3af] pl-0.5">+{dayEvents.length - 2}</div>
                          )}
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
                      <span
                        className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: ev.color }}
                      />
                      <div>
                        <div className="text-[12.5px] font-medium text-[#111827]">{ev.title}</div>
                        {ev.startTime && (
                          <div className="text-[11.5px] text-[#6b7280]">
                            {ev.startTime}{ev.endTime ? `~${ev.endTime}` : ''}
                          </div>
                        )}
                        {ev.className && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#DBEAFE] text-[#1d4ed8]">
                            {ev.className}
                          </span>
                        )}
                        {ev.description && (
                          <div className="text-[11.5px] text-[#6b7280] mt-0.5">{ev.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <BottomTabBar />
    </div>
  );
}
