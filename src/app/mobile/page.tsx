'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import { ChevronRight, Calendar, BookOpen, CreditCard, ChevronLeft, ChevronDown, X, QrCode } from 'lucide-react';
import clsx from 'clsx';
import { useMobileChild } from '@/contexts/MobileChildContext';

type StudentInfo = { id: string; name: string; avatarColor: string };
type ClassInfo = {
  id: string; name: string; color: string;
  schedule: { dayOfWeek: number; startTime: string; endTime: string }[];
};
type BillInfo = { id: string; className: string; amount: number; paidAmount: number; status: string };
type AnnouncementInfo = { id: string; title: string; pinned: boolean };
type CalendarEventItem = {
  id: string; title: string; date: string;
  startTime: string | null; endTime: string | null;
  type: string; description: string; color: string;
  classId: string | null; className: string | null;
};

const DAY_NAMES: Record<number, string> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 7: '일' };
const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOfMonth(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

export default function MobileHomePage() {
  const { role, allChildren, selectedChild, selectedChildId, setSelectedChildId } = useMobileChild();

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [unpaid, setUnpaid] = useState<BillInfo[]>([]);
  const [pinned, setPinned] = useState<AnnouncementInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChildModal, setShowChildModal] = useState(false);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const sid = selectedChildId ? `&studentId=${selectedChildId}` : '';

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/mobile/me?studentId=${selectedChildId}`).then((r) => r.json()),
      fetch(`/api/mobile/payments?studentId=${selectedChildId}`).then((r) => r.json()),
      fetch(`/api/mobile/announcements?studentId=${selectedChildId}`).then((r) => r.json()),
    ]).then(([me, pay, ann]) => {
      if (me.student) { setStudent(me.student); setClasses(me.classes ?? []); }
      if (pay.bills) setUnpaid(pay.bills.filter((b: BillInfo) => b.status !== 'PAID'));
      if (ann.announcements) setPinned(ann.announcements.find((a: AnnouncementInfo) => a.pinned) ?? null);
    }).finally(() => setLoading(false));
  }, [selectedChildId]);

  useEffect(() => {
    if (!selectedChildId) return;
    fetch(`/api/mobile/calendar?year=${calYear}&month=${calMonth + 1}${sid}`)
      .then((r) => r.json())
      .then((data) => { if (data.events) setEvents(data.events); });
  }, [calYear, calMonth, selectedChildId]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevMonth = () => {
    setSelectedDate(null);
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelectedDate(null);
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  const todayDow = new Date().getDay() || 7;
  const todayClasses = classes.filter((c) => c.schedule.some((s) => s.dayOfWeek === todayDow));

  const isParent = role === 'parent';
  const hasMultipleChildren = allChildren.length > 1;
  const displayName = selectedChild?.name ?? student?.name ?? '학생';
  const greeting = isParent ? `${displayName} 부모님` : `${displayName}님`;

  return (
    <div className="flex flex-col pb-20">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[13px] text-[#4fc3a1] font-medium">AcaMS</div>
            {/* 이름 + 자녀 전환 버튼 */}
            <button
              onClick={() => hasMultipleChildren && setShowChildModal(true)}
              className={clsx(
                'flex items-center gap-1 mt-0.5',
                hasMultipleChildren ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span className="text-[20px] font-bold text-white">
                안녕하세요, {greeting} 👋
              </span>
              {hasMultipleChildren && (
                <ChevronDown size={18} className="text-white/70 mt-1" />
              )}
            </button>
          </div>
          <Link href="/mobile/profile">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-bold text-white"
              style={{ backgroundColor: selectedChild?.avatarColor ?? student?.avatarColor ?? '#4fc3a1' }}
            >
              {displayName[0] ?? 'S'}
            </div>
          </Link>
        </div>
        {/* 오늘 수업 */}
        <div className="bg-white/10 rounded-[12px] p-3">
          <div className="text-[11.5px] text-white/60 mb-1.5">오늘({DAY_NAMES[todayDow]}) 수업</div>
          {todayClasses.length === 0 ? (
            <div className="text-[13px] text-white/70">오늘 수업 없음</div>
          ) : (
            todayClasses.map((c) => {
              const s = c.schedule.find((s) => s.dayOfWeek === todayDow);
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-[13px] font-medium text-white">{c.name}</span>
                  <span className="text-[12px] text-white/60">{s?.startTime}~{s?.endTime}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <MobileContentLoader loading={loading}>
      <div className="px-4 py-4 space-y-3">
        {/* 핀 공지 */}
        {pinned && (
          <div className="bg-[#E1F5EE] border border-[#4fc3a1]/30 rounded-[12px] p-3.5">
            <div className="text-[11px] text-[#0D9E7A] font-semibold mb-1">📌 공지사항</div>
            <div className="text-[12.5px] font-medium text-[#111827]">{pinned.title}</div>
          </div>
        )}

        {/* 학원 일정 미니 캘린더 */}
        {(() => {
          const days = daysInMonth(calYear, calMonth);
          const first = firstDayOfMonth(calYear, calMonth);
          const totalCells = Math.ceil((first + days) / 7) * 7;
          const getDateStr = (d: number) =>
            `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const eventsFor = (ds: string) => events.filter((e) => e.date === ds);
          const selectedEvents = selectedDate ? eventsFor(selectedDate) : [];

          return (
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
              {/* 캘린더 헤더 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#f1f5f9]">
                <div className="text-[13px] font-semibold text-[#111827]">
                  학원 일정
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={prevMonth} className="p-1 text-[#6b7280] active:text-[#111827] cursor-pointer">
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-[12px] font-medium text-[#374151] w-16 text-center">
                    {calYear}년 {calMonth + 1}월
                  </span>
                  <button onClick={nextMonth} className="p-1 text-[#6b7280] active:text-[#111827] cursor-pointer">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              <div className="px-2 pt-1 pb-2">
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 mb-1">
                  {DOW_LABELS.map((d) => (
                    <div key={d} className="py-1 text-center text-[10.5px] font-medium text-[#9ca3af]">{d}</div>
                  ))}
                </div>

                {/* 날짜 그리드 */}
                <div className="grid grid-cols-7">
                  {Array.from({ length: totalCells }).map((_, i) => {
                    const dayNum = i - first + 1;
                    const isValid = dayNum >= 1 && dayNum <= days;
                    const dateStr = isValid ? getDateStr(dayNum) : '';
                    const dayEvents = isValid ? eventsFor(dateStr) : [];
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;
                    const isWeekend = i % 7 >= 5;

                    return (
                      <div
                        key={i}
                        onClick={() => isValid && setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                        className={clsx(
                          'min-h-[42px] flex flex-col items-center pt-1 pb-0.5 rounded-[8px]',
                          isValid ? 'cursor-pointer' : '',
                          isSelected ? 'bg-[#f0fdf9]' : '',
                        )}
                      >
                        {isValid && (
                          <>
                            <div className={clsx(
                              'w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-medium',
                              isToday ? 'bg-[#4fc3a1] text-white' : isWeekend ? 'text-[#6366f1]' : 'text-[#374151]',
                            )}>
                              {dayNum}
                            </div>
                            <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                              {dayEvents.slice(0, 3).map((ev) => (
                                <span
                                  key={ev.id}
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: ev.color }}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 선택한 날 일정 상세 */}
              {selectedDate && (
                <div className="border-t border-[#f1f5f9] px-4 py-3">
                  <div className="text-[12px] font-semibold text-[#374151] mb-2">
                    {selectedDate.slice(5, 7)}월 {selectedDate.slice(8)}일
                  </div>
                  {selectedEvents.length === 0 ? (
                    <div className="text-[11.5px] text-[#9ca3af]">일정 없음</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedEvents.map((ev) => (
                        <div key={ev.id} className="flex items-start gap-2">
                          <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: ev.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] font-medium text-[#111827]">{ev.title}</div>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              {ev.startTime && (
                                <span className="text-[11px] text-[#6b7280]">
                                  {ev.startTime}{ev.endTime ? `~${ev.endTime}` : ''}
                                </span>
                              )}
                              {ev.className && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#DBEAFE] text-[#1d4ed8]">
                                  {ev.className}
                                </span>
                              )}
                            </div>
                            {ev.description && (
                              <div className="text-[11px] text-[#6b7280] mt-0.5">{ev.description}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* 학생 전용: QR 출석 체크 */}
        {!isParent && (
          <Link
            href="/mobile/attendance-check"
            className="bg-[#4fc3a1] rounded-[12px] p-4 flex items-center gap-3 active:opacity-80"
          >
            <div className="w-9 h-9 rounded-[10px] bg-white/20 flex items-center justify-center shrink-0">
              <QrCode size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-white">출석 체크</div>
              <div className="text-[11.5px] text-white/80">QR 코드로 출석 확인</div>
            </div>
            <ChevronRight size={18} className="text-white/70" />
          </Link>
        )}

        {/* 바로가기 메뉴 */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/mobile/attendance', label: '출결 확인', sub: '이번 달 출석현황', icon: Calendar, color: '#4fc3a1' },
            { href: '/mobile/grades', label: '성적 조회', sub: '최근 시험 결과', icon: BookOpen, color: '#6366f1' },
            {
              href: '/mobile/payments', label: '수납 내역',
              sub: unpaid.length > 0 ? `미납 ${unpaid.length}건` : '전액 납부',
              icon: CreditCard, color: unpaid.length > 0 ? '#991B1B' : '#0D9E7A',
            },
            { href: '/mobile/schedule', label: '시간표', sub: `수강 ${classes.length}개 반`, icon: Calendar, color: '#f59e0b' },
          ].map(({ href, label, sub, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="bg-white rounded-[12px] border border-[#e2e8f0] p-4 flex flex-col gap-2 active:bg-[#f4f6f8]"
            >
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#111827]">{label}</div>
                <div className="text-[11.5px]" style={{ color }}>{sub}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* 수강 중인 반 */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="text-[13px] font-semibold text-[#111827] mb-3">수강 중인 반</div>
          <div className="space-y-2">
            {classes.length === 0 ? (
              <div className="text-[12px] text-[#9ca3af]">수강 중인 반 없음</div>
            ) : classes.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <div className="flex-1">
                  <div className="text-[12.5px] font-medium text-[#111827]">{c.name}</div>
                  <div className="text-[11.5px] text-[#6b7280]">
                    {c.schedule.map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}~${s.endTime}`).join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </MobileContentLoader>
      <BottomTabBar />

      {/* 자녀 선택 모달 */}
      {showChildModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setShowChildModal(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-[430px] bg-white rounded-t-[20px] pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#e2e8f0]" />
            </div>
            <div className="flex items-center justify-between px-5 pb-4 border-b border-[#f1f5f9]">
              <span className="text-[15px] font-bold text-[#111827]">자녀 선택</span>
              <button onClick={() => setShowChildModal(false)}>
                <X size={20} className="text-[#6b7280]" />
              </button>
            </div>
            <div className="px-4 pt-3 space-y-2">
              {allChildren.map((child) => {
                const isSelected = child.id === selectedChildId;
                return (
                  <button
                    key={child.id}
                    onClick={() => {
                      setSelectedChildId(child.id);
                      setShowChildModal(false);
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-[12px] border transition-colors',
                      isSelected
                        ? 'border-[#4fc3a1] bg-[#f0fdf9]'
                        : 'border-[#e2e8f0] bg-white active:bg-[#f4f6f8]',
                    )}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold text-white shrink-0"
                      style={{ backgroundColor: child.avatarColor }}
                    >
                      {child.name[0]}
                    </div>
                    <span className="flex-1 text-left text-[14px] font-medium text-[#111827]">
                      {child.name}
                    </span>
                    {isSelected && (
                      <span className="text-[12px] font-semibold text-[#4fc3a1]">선택됨</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
