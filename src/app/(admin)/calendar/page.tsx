'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import AddScheduleModal from '@/components/calendar/AddScheduleModal';
import { useCalendarStore } from '@/lib/stores/calendarStore';
import type { CalendarEvent, CalendarEventType } from '@/lib/types/calendar';
import { ChevronLeft, ChevronRight, Plus, Pencil } from 'lucide-react';
import clsx from 'clsx';

const DAYS_OF_WEEK = ['월', '화', '수', '목', '금', '토', '일'];

const TYPE_COLOR: Record<CalendarEventType, string> = {
  '학원일정': '#4fc3a1',
  '상담일정': '#6366f1',
  '보강일정': '#8b5cf6',
  '수업': '#3b82f6',
};

const ALL_TYPES: CalendarEventType[] = ['학원일정', '상담일정', '보강일정', '수업'];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const today = todayStr();
  const [year, setYear] = useState(() => parseInt(today.slice(0, 4)));
  const [month, setMonth] = useState(() => parseInt(today.slice(5, 7)) - 1); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

  // 종류별 체크박스 상태
  const [visibleTypes, setVisibleTypes] = useState<Record<CalendarEventType, boolean>>({
    '학원일정': true,
    '상담일정': true,
    '보강일정': true,
    '수업': true,
  });

  const { events, loading, fetchEvents } = useCalendarStore();

  // 월이 바뀔 때마다 DB에서 새로 조회
  useEffect(() => {
    fetchEvents(year, month + 1); // API는 1-indexed month
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const totalCells = Math.ceil((firstDay + days) / 7) * 7;

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const eventsForDate = (dateStr: string) =>
    events.filter((e) => e.date === dateStr && visibleTypes[e.type]);

  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  const toggleType = (t: CalendarEventType) =>
    setVisibleTypes((prev) => ({ ...prev, [t]: !prev[t] }));

  const prev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="캘린더"
        actions={
          <Button variant="dark" size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus size={13} /> 일정 추가
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* 캘린더 */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
            {/* 헤더 */}
            <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={prev} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer">
                  <ChevronLeft size={16} className="text-[#6b7280]" />
                </button>
                <span className="text-[15px] font-bold text-[#111827]">{year}년 {month + 1}월</span>
                <button onClick={next} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer">
                  <ChevronRight size={16} className="text-[#6b7280]" />
                </button>
                {loading && (
                  <span className="text-[11px] text-[#9ca3af]">불러오는 중...</span>
                )}
              </div>

              {/* 종류별 체크박스 (필터 겸 범례) */}
              <div className="flex items-center gap-3">
                {ALL_TYPES.map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-1.5 text-[12px] text-[#6b7280] cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={visibleTypes[t]}
                      onChange={() => toggleType(t)}
                      className="cursor-pointer"
                      style={{ accentColor: TYPE_COLOR[t] }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: TYPE_COLOR[t] }}
                    />
                    {t}
                  </label>
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
                const evs = isValid ? eventsForDate(dateStr) : [];
                const isToday = dateStr === today;
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
                          {evs.slice(0, 3).map((ev) => (
                            <div
                              key={ev.id}
                              className="text-[10px] px-1.5 py-0.5 rounded-[4px] text-white truncate"
                              style={{ backgroundColor: ev.color }}
                            >
                              {ev.title}
                            </div>
                          ))}
                          {evs.length > 3 && (
                            <div className="text-[10px] text-[#9ca3af] pl-1">+{evs.length - 3}개</div>
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
              {selectedDate
                ? `${selectedDate.slice(5, 7)}월 ${selectedDate.slice(8)}일`
                : '날짜 선택'}
            </div>
          </div>
          {selectedEvents.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-[#9ca3af]">일정 없음</div>
          ) : (
            <div className="p-3 space-y-2">
              {selectedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-[8px] border border-[#e2e8f0] group"
                  style={{ borderLeftColor: ev.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="text-[10.5px] px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: ev.color }}
                      >
                        {ev.type}
                      </span>
                      {ev.className && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#DBEAFE] text-[#1d4ed8]">
                          {ev.className}
                        </span>
                      )}
                      {!ev.isPublic && (
                        <span className="text-[10px] text-[#9ca3af]">비공개</span>
                      )}
                    </div>
                    {(!ev.source || ev.source === 'event') && (
                      <button
                        onClick={() => { setEditEvent(ev); setIsAddOpen(true); }}
                        className="shrink-0 p-1 rounded hover:bg-[#f4f6f8] text-[#9ca3af] hover:text-[#6b7280] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </div>
                  <div className="text-[12.5px] font-medium text-[#111827]">{ev.title}</div>
                  {(ev.startTime || ev.endTime) && (
                    <div className="text-[11.5px] text-[#6b7280] mt-0.5">
                      {ev.startTime} ~ {ev.endTime}
                    </div>
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

      {/* 일정 추가/수정 모달 */}
      <AddScheduleModal
        open={isAddOpen}
        onClose={() => { setIsAddOpen(false); setEditEvent(null); }}
        defaultDate={selectedDate ?? today}
        editEvent={editEvent}
      />
    </div>
  );
}
