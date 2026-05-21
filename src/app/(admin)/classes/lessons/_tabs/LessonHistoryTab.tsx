'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import { useClassStore } from '@/lib/stores/classStore';
import { useLessonStore } from '@/lib/stores/lessonStore';
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import { type MainTab, TAB_OPTIONS } from '../_shared';
import SessionDetailModal from '../_components/SessionDetailModal';
import ClinicTemplateModal from '../_components/ClinicTemplateModal';
import type { LessonSession } from '@/lib/types/lesson';

interface LessonHistoryTabProps {
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  mainTab: MainTab;
  setMainTab: (t: MainTab) => void;
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function LessonHistoryTab({
  selectedClassId,
  setSelectedClassId,
  mainTab,
  setMainTab,
}: LessonHistoryTabProps) {
  const { classes } = useClassStore();
  const { sessions, fetchSessions, fetchTemplates } = useLessonStore();

  // 캘린더 현재 월
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-based

  // 선택된 수업 (모달 오픈 시)
  const [selectedSession, setSelectedSession] = useState<LessonSession | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else setCalMonth((m) => m + 1);
  };

  // 월 변경 또는 반 변경 시 수업 일정 fetch
  const loadSessions = useCallback(() => {
    const first = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
    const last = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    fetchSessions({
      classId: selectedClassId || undefined,
      from: first,
      to: last,
    }).catch(() => {});
  }, [calYear, calMonth, selectedClassId, fetchSessions]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    fetchTemplates().catch(() => {});
  }, [fetchTemplates]);

  // 날짜별 수업 그룹화
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, LessonSession[]>();
    for (const s of sessions) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [sessions]);

  // 캘린더 그리드 계산
  const firstDayOfMonth = new Date(calYear, calMonth, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(calYear, calMonth, d) });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null });

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <>
      <Topbar
        title="수업 관리"
        actions={
          <Button variant="default" size="sm" onClick={() => setTemplateModalOpen(true)}>
            <Settings2 size={13} /> Clinic 양식 관리
          </Button>
        }
      />
      <div className="px-5 pt-3 bg-white">
        <Tabs
          tabs={TAB_OPTIONS}
          value={mainTab}
          onChange={(v) => setMainTab(v as MainTab)}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 반 선택 */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedClassId('')}
            className={clsx(
              'px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium border transition-colors cursor-pointer',
              selectedClassId === ''
                ? 'text-white border-transparent bg-[#1a2535]'
                : 'text-[#374151] border-[#e2e8f0] bg-white hover:bg-[#f4f6f8]',
            )}
          >
            전체
          </button>
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={clsx(
                'px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium border transition-colors cursor-pointer',
                selectedClassId === cls.id
                  ? 'text-white border-transparent'
                  : 'text-[#374151] border-[#e2e8f0] bg-white hover:bg-[#f4f6f8]',
              )}
              style={selectedClassId === cls.id ? { backgroundColor: cls.color } : {}}
            >
              {cls.name}
            </button>
          ))}
        </div>

        {/* 캘린더 */}
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
            <span className="text-[13px] font-semibold text-[#111827]">
              {calYear}년 {calMonth + 1}월
            </span>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="p-1 rounded hover:bg-[#f4f6f8] cursor-pointer">
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => {
                  setCalYear(today.getFullYear());
                  setCalMonth(today.getMonth());
                }}
                className="px-2 text-[11.5px] text-[#6b7280] hover:text-[#111827] cursor-pointer"
              >
                오늘
              </button>
              <button onClick={nextMonth} className="p-1 rounded hover:bg-[#f4f6f8] cursor-pointer">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-[#e2e8f0] bg-[#f9fafb]">
            {DAY_LABELS.map((d, i) => (
              <div
                key={d}
                className={clsx(
                  'px-2 py-2 text-center text-[11px] font-semibold',
                  i === 0 ? 'text-[#ef4444]' : i === 6 ? 'text-[#3b82f6]' : 'text-[#6b7280]',
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              const dayOfWeek = idx % 7;
              const cellSessions = cell.dateStr ? sessionsByDate.get(cell.dateStr) ?? [] : [];
              const isToday = cell.dateStr === todayStr;
              return (
                <div
                  key={idx}
                  className={clsx(
                    'min-h-[90px] border-r border-b border-[#e2e8f0] p-1.5',
                    cell.day === null && 'bg-[#f9fafb]',
                    isToday && 'bg-[#eef2ff]',
                  )}
                >
                  {cell.day !== null && (
                    <>
                      <div
                        className={clsx(
                          'text-[11px] font-medium mb-1',
                          dayOfWeek === 0 ? 'text-[#ef4444]' : dayOfWeek === 6 ? 'text-[#3b82f6]' : 'text-[#374151]',
                        )}
                      >
                        {cell.day}
                      </div>
                      <div className="space-y-1">
                        {cellSessions.map((s, i) => (
                          <button
                            key={`${s.classId}-${s.startTime}-${i}`}
                            onClick={() => setSelectedSession(s)}
                            className="w-full text-left text-[10.5px] px-1.5 py-1 rounded text-white hover:opacity-80 cursor-pointer truncate"
                            style={{ backgroundColor: s.color }}
                            title={`${s.className} ${s.startTime}~${s.endTime}${s.isOneTime ? ' (보강)' : ''}`}
                          >
                            {s.startTime} {s.className}
                            {s.isOneTime && <span className="ml-1 opacity-80">(보강)</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] text-[#9ca3af]">
          ※ 수업 블록을 클릭하면 학생별 코멘트와 Clinic 체크리스트를 입력할 수 있습니다.
        </div>
      </div>

      {/* 수업 상세 모달 */}
      {selectedSession && (
        <SessionDetailModal
          open={!!selectedSession}
          onClose={() => setSelectedSession(null)}
          session={selectedSession}
        />
      )}

      {/* Clinic 양식 관리 모달 */}
      <ClinicTemplateModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} />
    </>
  );
}
