'use client';
import { useState, useMemo } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { StudentStatus } from '@/lib/types/student';
import type { DayOfWeek, ClassInfo } from '@/lib/types/class';
import { DAY_NAMES } from '@/lib/types/class';
import { toast } from '@/lib/stores/toastStore';
import { Plus, ChevronLeft, ChevronRight, X, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { DAY_LABELS, toDateStr } from '../_shared';

// 우측 패널의 일정 항목 (반복 슬롯 + 일회성 이벤트 통합)
type ScheduleItem = {
  key: string;
  cls: ClassInfo;
  startTime: string;
  endTime: string;
  recurring: boolean;
  teacherId: string | null;
  dayOfWeek: DayOfWeek;
  eventId?: string; // 일회성(ClassEvent)만
};

export default function ScheduleTab({ selected }: { selected: ClassInfo }) {
  const { classes, updateClass, classEvents, addClassEvent, updateClassEvent, deleteClassEvent } = useClassStore();
  const { students, addStudentToClass, removeStudentFromClass } = useStudentStore();
  const { teachers } = useTeacherStore();
  const activeTeachers = useMemo(() => teachers.filter((t) => t.isActive), [teachers]);

  // 일정 항목의 표시용 강사명 — 지정 강사 없으면 반 대표 강사
  const teacherNameFor = (item: { teacherId: string | null; cls: ClassInfo }): string => {
    if (item.teacherId) {
      const t = teachers.find((x) => x.id === item.teacherId);
      if (t) return t.name;
    }
    return item.cls.teacherName;
  };

  const classStudents = students.filter((s) => s.classes.includes(selected.id));
  const activeStudents = classStudents.filter((s) => s.status === StudentStatus.ACTIVE);
  const onLeaveStudents = classStudents.filter((s) => s.status === StudentStatus.ON_LEAVE);

  // ── 학생 추가 ─────────────────────────────────────────
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const addableStudents = useMemo(() => {
    return students.filter((s) => s.status === StudentStatus.ACTIVE && !s.classes.includes(selected.id) && (studentSearch === '' || s.name.includes(studentSearch)));
  }, [students, selected, studentSearch]);

  const toggleStudentSelect = (id: string) => {
    setSelectedStudentIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleAddStudents = () => {
    if (selectedStudentIds.length === 0) { toast('추가할 학생을 선택해주세요.', 'error'); return; }
    selectedStudentIds.forEach((id) => addStudentToClass(id, selected.id));
    toast(`${selectedStudentIds.length}명이 추가되었습니다.`, 'success');
    setSelectedStudentIds([]); setStudentSearch(''); setAddStudentOpen(false);
  };

  const openAddStudent = () => { setSelectedStudentIds([]); setStudentSearch(''); setAddStudentOpen(true); };

  // ── 캘린더 ────────────────────────────────────────────
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-based
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const prevMonth = () => { setSelectedDate(null); if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1); };
  const nextMonth = () => { setSelectedDate(null); if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1); };

  const getClassesForDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const jsDay = d.getDay();
    const dow: DayOfWeek = jsDay === 0 ? 7 : (jsDay as DayOfWeek);
    const recurring = classes.filter((c) => c.schedule.some((s) => s.dayOfWeek === dow));
    const oneTime = classEvents.filter((e) => e.date === dateStr).map((e) => classes.find((c) => c.id === e.classId)).filter((c): c is NonNullable<typeof c> => Boolean(c));
    const merged = new Map<string, (typeof classes)[0]>();
    [...recurring, ...oneTime].forEach((c) => merged.set(c.id, c));
    return [...merged.values()];
  };

  const getScheduleItemsForDate = (dateStr: string): ScheduleItem[] => {
    const jsDay = new Date(dateStr + 'T00:00:00').getDay();
    const dow: DayOfWeek = jsDay === 0 ? 7 : (jsDay as DayOfWeek);
    const items: ScheduleItem[] = [];
    classes.forEach((c) => {
      c.schedule.filter((s) => s.dayOfWeek === dow).forEach((s, i) => {
        items.push({ key: `r-${c.id}-${i}`, cls: c, startTime: s.startTime, endTime: s.endTime, recurring: true, teacherId: s.teacherId ?? null, dayOfWeek: dow });
      });
    });
    classEvents.filter((e) => e.date === dateStr).forEach((e) => {
      const cls = classes.find((c) => c.id === e.classId);
      if (cls) items.push({ key: `e-${e.id}`, cls, startTime: e.startTime, endTime: e.endTime, recurring: false, teacherId: e.teacherId ?? null, dayOfWeek: dow, eventId: e.id });
    });
    return items.sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const calDates = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calYear, calMonth]);

  // ── 일정 추가 모달 ────────────────────────────────────
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: '', classId: '', startTime: '16:00', endTime: '17:00', mode: 'once' as 'once' | 'weekly', teacherId: '' });

  const openScheduleModal = (dateStr?: string) => {
    const target = selected ?? classes[0];
    setScheduleForm({ date: dateStr ?? todayStr, classId: target?.id ?? '', startTime: '16:00', endTime: '17:00', mode: 'once', teacherId: target?.teacherId ?? '' });
    setScheduleOpen(true);
  };

  // 반 변경 시 담당 강사 기본값을 새 반의 대표 강사로 갱신
  const handleScheduleClassChange = (classId: string) => {
    const c = classes.find((x) => x.id === classId);
    setScheduleForm((f) => ({ ...f, classId, teacherId: c?.teacherId ?? '' }));
  };

  const handleAddSchedule = async () => {
    const { date, classId, startTime, endTime, mode, teacherId } = scheduleForm;
    if (!date) { toast('날짜를 선택해주세요.', 'error'); return; }
    if (!classId) { toast('반을 선택해주세요.', 'error'); return; }
    if (!startTime || !endTime) { toast('시간을 입력해주세요.', 'error'); return; }
    if (startTime >= endTime) { toast('종료 시간이 시작 시간보다 늦어야 합니다.', 'error'); return; }
    const targetClass = classes.find((c) => c.id === classId);
    if (!targetClass) return;
    if (mode === 'once') {
      try {
        await addClassEvent({ classId, date, startTime, endTime, teacherId: teacherId || null });
      } catch {
        return;
      }
      toast(`${targetClass.name} 일정이 추가되었습니다.`, 'success');
    } else {
      const d = new Date(date + 'T00:00:00');
      const jsDay = d.getDay();
      const dow: DayOfWeek = jsDay === 0 ? 7 : (jsDay as DayOfWeek);
      const newSchedule = { dayOfWeek: dow, startTime, endTime, teacherId: teacherId || null };
      if (targetClass.schedule.some((s) => s.dayOfWeek === dow && s.startTime === startTime && s.endTime === endTime)) {
        toast('동일한 반복 일정이 이미 있습니다.', 'error'); return;
      }
      try {
        await updateClass(classId, { schedule: [...targetClass.schedule, newSchedule] });
      } catch {
        return;
      }
      const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
      toast(`매주 ${DAY_KO[jsDay]}요일 ${startTime}~${endTime} 일정이 추가되었습니다.`, 'success');
    }
    setScheduleOpen(false);
  };

  // ── 일정 수정/삭제 ────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduleItem | null>(null);
  const [editForm, setEditForm] = useState({ date: '', startTime: '', endTime: '', teacherId: '' });

  const openEditSchedule = (item: ScheduleItem) => {
    setEditTarget(item);
    setEditForm({ date: selectedDate ?? todayStr, startTime: item.startTime, endTime: item.endTime, teacherId: item.teacherId ?? '' });
    setEditOpen(true);
  };

  const handleEditSchedule = async () => {
    if (!editTarget) return;
    const { date, startTime, endTime, teacherId } = editForm;
    if (!startTime || !endTime) { toast('시간을 입력해주세요.', 'error'); return; }
    if (startTime >= endTime) { toast('종료 시간이 시작 시간보다 늦어야 합니다.', 'error'); return; }

    if (!editTarget.recurring && editTarget.eventId) {
      if (!date) { toast('날짜를 선택해주세요.', 'error'); return; }
      try {
        await updateClassEvent(editTarget.eventId, { date, startTime, endTime, teacherId: teacherId || null });
      } catch { return; }
      toast('일정이 수정되었습니다.', 'success');
    } else {
      const cls = classes.find((c) => c.id === editTarget.cls.id);
      if (!cls) return;
      // 같은 요일에 동일 시간 슬롯이 이미 있으면(자기 자신 제외) 차단
      const collides = cls.schedule.some((s) =>
        s.dayOfWeek === editTarget.dayOfWeek && s.startTime === startTime && s.endTime === endTime &&
        !(s.startTime === editTarget.startTime && s.endTime === editTarget.endTime),
      );
      if (collides) { toast('같은 요일에 동일한 시간 일정이 이미 있습니다.', 'error'); return; }
      const nextSchedule = cls.schedule.map((s) =>
        s.dayOfWeek === editTarget.dayOfWeek && s.startTime === editTarget.startTime && s.endTime === editTarget.endTime
          ? { dayOfWeek: editTarget.dayOfWeek, startTime, endTime, teacherId: teacherId || null }
          : s,
      );
      try {
        await updateClass(cls.id, { schedule: nextSchedule });
      } catch { return; }
    }
    setEditOpen(false);
    setEditTarget(null);
  };

  const handleDeleteSchedule = async (item: ScheduleItem) => {
    const msg = item.recurring
      ? `매주 ${DAY_NAMES[item.dayOfWeek]}요일 ${item.startTime}~${item.endTime} 반복 일정을 삭제하시겠습니까?`
      : `${item.cls.name} ${item.startTime}~${item.endTime} 일정을 삭제하시겠습니까?`;
    if (!confirm(msg)) return;
    if (!item.recurring && item.eventId) {
      try {
        await deleteClassEvent(item.eventId);
      } catch { return; }
      toast('일정이 삭제되었습니다.', 'info');
    } else {
      const cls = classes.find((c) => c.id === item.cls.id);
      if (!cls) return;
      const nextSchedule = cls.schedule.filter((s) =>
        !(s.dayOfWeek === item.dayOfWeek && s.startTime === item.startTime && s.endTime === item.endTime),
      );
      try {
        await updateClass(cls.id, { schedule: nextSchedule });
      } catch { return; }
    }
  };

  const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

  return (
    <>
      {/* 월별 캘린더 + 선택 날짜 일정 */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer"><ChevronLeft size={15} /></button>
              <span className="text-[13px] font-semibold text-[#111827] w-24 text-center">{calYear}년 {calMonth + 1}월</span>
              <button onClick={nextMonth} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer"><ChevronRight size={15} /></button>
            </div>
            <Button variant="default" size="sm" onClick={() => openScheduleModal(selectedDate ?? undefined)}><Plus size={12} /> 일정 추가</Button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((label, i) => (
                <div key={label} className={clsx('text-center text-[11px] font-medium py-1', { 'text-[#ef4444]': i === 0, 'text-[#3b82f6]': i === 6, 'text-[#6b7280]': i !== 0 && i !== 6 })}>{label}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calDates.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="min-h-[70px]" />;
                const dateStr = toDateStr(calYear, calMonth, day);
                const dayClasses = getClassesForDate(dateStr);
                const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                const isSelected = dateStr === selectedDate;
                const colIdx = idx % 7;
                return (
                  <button key={dateStr} onClick={() => setSelectedDate((prev) => (prev === dateStr ? null : dateStr))}
                    className={clsx('min-h-[70px] p-1 border rounded-[6px] text-left transition-colors cursor-pointer', isSelected ? 'border-[#4fc3a1] bg-[#f0fdf9]' : 'border-[#f1f5f9] hover:bg-[#f9fafb]')}
                  >
                    <div className={clsx('text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full mb-1', { 'bg-[#1a2535] text-white': isToday, 'text-[#ef4444]': !isToday && colIdx === 0, 'text-[#3b82f6]': !isToday && colIdx === 6, 'text-[#374151]': !isToday && colIdx !== 0 && colIdx !== 6 })}>{day}</div>
                    <div className="space-y-0.5">
                      {dayClasses.map((cls) => (
                        <div key={cls.id} className="text-[9.5px] px-1 rounded truncate"
                          style={{ backgroundColor: cls.color, color: cls.id === selected.id ? 'white' : cls.color, opacity: cls.id === selected.id ? 1 : 0.4 }}
                        >
                          {cls.id === selected.id ? cls.name.slice(0, 5) : '●'}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[#f1f5f9]">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                  <span className={clsx('text-[10.5px]', cls.id === selected.id ? 'font-semibold text-[#111827]' : 'text-[#9ca3af]')}>{cls.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 선택한 날짜의 일정 */}
        <div className="w-60 shrink-0 bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0]">
            <span className="text-[12.5px] font-semibold text-[#111827]">
              {selectedDate ? `${Number(selectedDate.slice(5, 7))}월 ${Number(selectedDate.slice(8))}일 일정` : '날짜 선택'}
            </span>
          </div>
          <div className="p-3">
            {!selectedDate ? (
              <div className="text-[11.5px] text-[#9ca3af] text-center py-8">캘린더에서 날짜를<br />선택하세요</div>
            ) : (() => {
              const items = getScheduleItemsForDate(selectedDate);
              if (items.length === 0) return <div className="text-[11.5px] text-[#9ca3af] text-center py-8">일정 없음</div>;
              return (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.key} className="group relative p-2.5 rounded-[8px] border border-[#e2e8f0]" style={{ borderLeftColor: item.cls.color, borderLeftWidth: 3 }}>
                      <div className="flex items-center gap-1.5 mb-0.5 pr-14">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.cls.color }} />
                        <span className="text-[12px] font-medium text-[#111827] truncate">{item.cls.name}</span>
                        {!item.recurring && <span className="text-[9px] px-1 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] shrink-0">이 날만</span>}
                      </div>
                      <div className="text-[11px] text-[#6b7280]">{item.startTime} ~ {item.endTime}</div>
                      <div className="text-[10.5px] text-[#9ca3af] mt-0.5">{teacherNameFor(item)} 강사</div>
                      {/* hover 시 수정/삭제 */}
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => openEditSchedule(item)} title="일정 수정"
                          className="p-1 rounded bg-white border border-[#e2e8f0] text-[#6b7280] hover:text-[#1a2535] hover:border-[#1a2535] transition-colors cursor-pointer">
                          <Pencil size={12} />
                        </button>
                        <button type="button" onClick={() => handleDeleteSchedule(item)} title="일정 삭제"
                          className="p-1 rounded bg-white border border-[#e2e8f0] text-[#6b7280] hover:text-[#ef4444] hover:border-[#ef4444] transition-colors cursor-pointer">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      {/* 수강생 목록 */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0]">
        <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-[#111827]">수강생 목록</span>
          <Button variant="default" size="sm" onClick={openAddStudent}>학생 추가</Button>
        </div>
        <div className="p-3 space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-[#065f46] mb-1.5">재원 · {activeStudents.length}명</div>
            {activeStudents.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeStudents.map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f4f6f8] rounded-[8px] group">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ backgroundColor: s.avatarColor }}>{s.name[0]}</span>
                    <span className="text-[12px] text-[#374151]">{s.name}</span>
                    <button type="button" onClick={() => { removeStudentFromClass(s.id, selected.id); toast(`${s.name} 학생이 반에서 제외되었습니다.`, 'info'); }} className="ml-0.5 text-[#9ca3af] hover:text-[#ef4444] transition-colors cursor-pointer" title="반에서 제외"><X size={12} /></button>
                  </div>
                ))}
              </div>
            ) : <div className="text-[11.5px] text-[#9ca3af]">재원생 없음</div>}
          </div>
          {onLeaveStudents.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#92400E] mb-1.5">휴원 · {onLeaveStudents.length}명</div>
              <div className="flex flex-wrap gap-2">
                {onLeaveStudents.map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FEF3C7] rounded-[8px] opacity-75" title="휴원">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ backgroundColor: s.avatarColor }}>{s.name[0]}</span>
                    <span className="text-[12px] text-[#92400E]">{s.name}</span>
                    <span className="text-[9.5px] px-1 rounded bg-[#FEF3C7] text-[#92400E] border border-[#fcd34d]">휴원</span>
                    <button type="button" onClick={() => { removeStudentFromClass(s.id, selected.id); toast(`${s.name} 학생이 반에서 제외되었습니다.`, 'info'); }} className="ml-0.5 text-[#b45309] hover:text-[#ef4444] transition-colors cursor-pointer" title="반에서 제외"><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 학생 추가 모달 ───────────────────────────────── */}
      <Modal open={addStudentOpen} onClose={() => setAddStudentOpen(false)} title="학생 추가" size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setAddStudentOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleAddStudents}>추가 {selectedStudentIds.length > 0 && `(${selectedStudentIds.length}명)`}</Button></>}
      >
        <div className="space-y-3">
          <input className={fieldCls} placeholder="이름으로 검색" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {addableStudents.length === 0 ? (
              <div className="text-[12px] text-[#9ca3af] text-center py-6">{studentSearch ? '검색 결과가 없습니다.' : '추가 가능한 학생이 없습니다.'}</div>
            ) : addableStudents.map((s) => {
              const isSelected = selectedStudentIds.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggleStudentSelect(s.id)}
                  className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-left transition-colors cursor-pointer', isSelected ? 'bg-[#E1F5EE] border border-[#4fc3a1]' : 'hover:bg-[#f4f6f8] border border-transparent')}
                >
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ backgroundColor: s.avatarColor }}>{s.name[0]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[#111827]">{s.name}</div>
                    <div className="text-[11px] text-[#6b7280]">{s.school} · {s.grade}학년</div>
                  </div>
                  {isSelected && <span className="text-[10.5px] text-[#4fc3a1] font-semibold shrink-0">선택됨</span>}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* ── 일정 추가 모달 ───────────────────────────────── */}
      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="일정 추가" size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setScheduleOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleAddSchedule}>추가</Button></>}
      >
        <div className="space-y-3">
          <div><label className="text-[11.5px] text-[#6b7280] block mb-1">날짜 *</label><input type="date" className={fieldCls} value={scheduleForm.date} onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))} /></div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">반 *</label>
            <select className={fieldCls} value={scheduleForm.classId} onChange={(e) => handleScheduleClassChange(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">시작 시간 *</label><input type="time" className={fieldCls} value={scheduleForm.startTime} onChange={(e) => setScheduleForm((f) => ({ ...f, startTime: e.target.value }))} /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">종료 시간 *</label><input type="time" className={fieldCls} value={scheduleForm.endTime} onChange={(e) => setScheduleForm((f) => ({ ...f, endTime: e.target.value }))} /></div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">담당 강사</label>
            <select className={fieldCls} value={scheduleForm.teacherId} onChange={(e) => setScheduleForm((f) => ({ ...f, teacherId: e.target.value }))}>
              <option value="">미지정 (반 대표 강사)</option>
              {activeTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.subject ? ` (${t.subject})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">반복</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-[12.5px]"><input type="radio" name="scheduleMode" value="once" checked={scheduleForm.mode === 'once'} onChange={() => setScheduleForm((f) => ({ ...f, mode: 'once' }))} className="accent-[#4fc3a1]" />이 날만</label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[12.5px]"><input type="radio" name="scheduleMode" value="weekly" checked={scheduleForm.mode === 'weekly'} onChange={() => setScheduleForm((f) => ({ ...f, mode: 'weekly' }))} className="accent-[#4fc3a1]" />매주 반복</label>
            </div>
            {scheduleForm.mode === 'weekly' && scheduleForm.date && (
              <div className="mt-2 text-[11.5px] text-[#4fc3a1] bg-[#f0fdf9] px-3 py-2 rounded-[8px]">
                매주 {DAY_LABELS[new Date(scheduleForm.date + 'T00:00:00').getDay()]}요일 {scheduleForm.startTime}~{scheduleForm.endTime}에 반복 등록됩니다.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ── 일정 수정 모달 ───────────────────────────────── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="일정 수정" size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setEditOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleEditSchedule}>저장</Button></>}
      >
        {editTarget && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-[12.5px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: editTarget.cls.color }} />
              <span className="font-medium text-[#111827] truncate">{editTarget.cls.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#6b7280] shrink-0">
                {editTarget.recurring ? `매주 ${DAY_NAMES[editTarget.dayOfWeek]}요일` : '이 날만'}
              </span>
            </div>
            {!editTarget.recurring && (
              <div><label className="text-[11.5px] text-[#6b7280] block mb-1">날짜 *</label><input type="date" className={fieldCls} value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} /></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[11.5px] text-[#6b7280] block mb-1">시작 시간 *</label><input type="time" className={fieldCls} value={editForm.startTime} onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))} /></div>
              <div><label className="text-[11.5px] text-[#6b7280] block mb-1">종료 시간 *</label><input type="time" className={fieldCls} value={editForm.endTime} onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))} /></div>
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">담당 강사</label>
              <select className={fieldCls} value={editForm.teacherId} onChange={(e) => setEditForm((f) => ({ ...f, teacherId: e.target.value }))}>
                <option value="">미지정 (반 대표 강사)</option>
                {activeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.subject ? ` (${t.subject})` : ''}</option>
                ))}
              </select>
            </div>
            {editTarget.recurring && (
              <div className="text-[11px] text-[#92400E] bg-[#FEF3C7] px-3 py-2 rounded-[8px]">
                매주 반복되는 일정입니다. 변경 사항이 모든 주에 적용됩니다.
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
