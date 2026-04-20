'use client';
import { useState, useMemo } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { StudentStatus } from '@/lib/types/student';
import type { DayOfWeek, FeeType } from '@/lib/types/class';
import { FEE_TYPE_LABELS, FEE_TYPE_NAMES } from '@/lib/types/class';
import { toast } from '@/lib/stores/toastStore';
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';

const FEE_TYPES: FeeType[] = ['monthly', 'weekly', 'per-lesson'];

const PRESET_COLORS = ['#4fc3a1', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#f97316', '#ec4899'];
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// YYYY-MM-DD 형식으로 날짜 문자열 생성
function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function ClassesPage() {
  const { classes, selectedClassId, setSelectedClass, addClass, updateClass, classEvents, addClassEvent } = useClassStore();
  const { students, addStudentToClass, removeStudentFromClass } = useStudentStore();
  const selected = classes.find((c) => c.id === selectedClassId);

  // ── 반 추가 ───────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', teacher: '', fee: '', feeType: 'monthly' as FeeType, room: '', maxStudents: '' });

  const handleAddClass = () => {
    if (!addForm.name.trim()) { toast('반 이름을 입력해주세요.', 'error'); return; }
    addClass({
      name: addForm.name.trim(),
      subject: '',
      teacherId: '',
      teacherName: addForm.teacher.trim(),
      maxStudents: parseInt(addForm.maxStudents) || 0,
      schedule: [],
      color: PRESET_COLORS[classes.length % PRESET_COLORS.length],
      room: addForm.room.trim(),
      fee: parseInt(addForm.fee) || 0,
      feeType: addForm.feeType,
      description: '',
    });
    toast(`'${addForm.name}' 반이 등록되었습니다.`, 'success');
    setAddForm({ name: '', teacher: '', fee: '', feeType: 'monthly', room: '', maxStudents: '' });
    setAddOpen(false);
  };

  // ── 반 수정 ───────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', teacher: '', fee: '', feeType: 'monthly' as FeeType, room: '', maxStudents: '' });

  const openEdit = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name,
      teacher: selected.teacherName,
      fee: String(selected.fee),
      feeType: selected.feeType ?? 'monthly',
      room: selected.room,
      maxStudents: String(selected.maxStudents),
    });
    setEditOpen(true);
  };

  const handleEditClass = () => {
    if (!selected) return;
    if (!editForm.name.trim()) { toast('반 이름을 입력해주세요.', 'error'); return; }
    updateClass(selected.id, {
      name: editForm.name.trim(),
      teacherName: editForm.teacher.trim(),
      fee: parseInt(editForm.fee) || 0,
      feeType: editForm.feeType,
      room: editForm.room.trim(),
      maxStudents: parseInt(editForm.maxStudents) || 0,
    });
    toast('반 정보가 수정되었습니다.', 'success');
    setEditOpen(false);
  };

  // ── 학생 추가 ─────────────────────────────────────────
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const addableStudents = useMemo(() => {
    if (!selected) return [];
    return students.filter(
      (s) =>
        s.status === StudentStatus.ACTIVE &&
        !s.classes.includes(selected.id) &&
        (studentSearch === '' || s.name.includes(studentSearch)),
    );
  }, [students, selected, studentSearch]);

  const toggleStudentSelect = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAddStudents = () => {
    if (!selected || selectedStudentIds.length === 0) {
      toast('추가할 학생을 선택해주세요.', 'error');
      return;
    }
    selectedStudentIds.forEach((id) => addStudentToClass(id, selected.id));
    toast(`${selectedStudentIds.length}명이 추가되었습니다.`, 'success');
    setSelectedStudentIds([]);
    setStudentSearch('');
    setAddStudentOpen(false);
  };

  const openAddStudent = () => {
    setSelectedStudentIds([]);
    setStudentSearch('');
    setAddStudentOpen(true);
  };

  // ── 캘린더 ────────────────────────────────────────────
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-based

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  // 해당 날짜에 수업이 있는 반 목록 계산
  const getClassesForDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const jsDay = d.getDay(); // 0=일 ~ 6=토
    const dow: DayOfWeek = jsDay === 0 ? 7 : (jsDay as DayOfWeek);

    const recurring = classes.filter((c) => c.schedule.some((s) => s.dayOfWeek === dow));
    const oneTime = classEvents
      .filter((e) => e.date === dateStr)
      .map((e) => classes.find((c) => c.id === e.classId))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    // 중복 제거
    const merged = new Map<string, (typeof classes)[0]>();
    [...recurring, ...oneTime].forEach((c) => merged.set(c.id, c));
    return [...merged.values()];
  };

  // 캘린더 날짜 배열 계산
  const calDates = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=일
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calYear, calMonth]);

  // ── 일정 추가 모달 ────────────────────────────────────
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    date: '',
    classId: '',
    startTime: '16:00',
    endTime: '17:00',
    mode: 'once' as 'once' | 'weekly',
  });

  const openScheduleModal = (dateStr?: string) => {
    setScheduleForm({
      date: dateStr ?? '',
      classId: selected?.id ?? (classes[0]?.id ?? ''),
      startTime: '16:00',
      endTime: '17:00',
      mode: 'once',
    });
    setScheduleOpen(true);
  };

  const handleAddSchedule = () => {
    const { date, classId, startTime, endTime, mode } = scheduleForm;
    if (!date) { toast('날짜를 선택해주세요.', 'error'); return; }
    if (!classId) { toast('반을 선택해주세요.', 'error'); return; }
    if (!startTime || !endTime) { toast('시간을 입력해주세요.', 'error'); return; }
    if (startTime >= endTime) { toast('종료 시간이 시작 시간보다 늦어야 합니다.', 'error'); return; }

    const targetClass = classes.find((c) => c.id === classId);
    if (!targetClass) return;

    if (mode === 'once') {
      addClassEvent({ classId, date, startTime, endTime });
      toast(`${targetClass.name} 일정이 추가되었습니다.`, 'success');
    } else {
      const d = new Date(date + 'T00:00:00');
      const jsDay = d.getDay();
      const dow: DayOfWeek = jsDay === 0 ? 7 : (jsDay as DayOfWeek);
      const newSchedule = { dayOfWeek: dow, startTime, endTime };
      const alreadyExists = targetClass.schedule.some(
        (s) => s.dayOfWeek === dow && s.startTime === startTime && s.endTime === endTime,
      );
      if (alreadyExists) { toast('동일한 반복 일정이 이미 있습니다.', 'error'); return; }
      updateClass(classId, { schedule: [...targetClass.schedule, newSchedule] });
      const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
      toast(`매주 ${DAY_KO[jsDay]}요일 ${startTime}~${endTime} 일정이 추가되었습니다.`, 'success');
    }
    setScheduleOpen(false);
  };

  const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="반 편성 및 시간표"
        actions={<Button variant="dark" size="sm" onClick={() => setAddOpen(true)}><Plus size={13} /> 반 추가</Button>}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 반 목록 */}
        <div className="w-56 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {classes.map((cls) => {
            const clsMembers = students.filter((s) => s.classes.includes(cls.id));
            const activeN = clsMembers.filter((s) => s.status === StudentStatus.ACTIVE).length;
            const onLeaveN = clsMembers.filter((s) => s.status === StudentStatus.ON_LEAVE).length;
            const pct = cls.maxStudents > 0 ? Math.round((activeN / cls.maxStudents) * 100) : 0;
            const isFull = cls.maxStudents > 0 && activeN >= cls.maxStudents;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={clsx(
                  'w-full px-3 py-3 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer',
                  selectedClassId === cls.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                  <span className="text-[12.5px] font-medium text-[#111827] truncate">{cls.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#6b7280]">{cls.teacherName}</span>
                  <span className={clsx('text-[11px] font-medium', isFull ? 'text-[#991B1B]' : 'text-[#065f46]')}>
                    재원 {activeN}/{cls.maxStudents}
                  </span>
                </div>
                {onLeaveN > 0 && (
                  <div className="text-[10.5px] text-[#92400E] mt-0.5">휴원 {onLeaveN}명</div>
                )}
                <div className="mt-1.5 h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: isFull ? '#ef4444' : '#4fc3a1' }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* 우측: 반 상세 + 캘린더 + 수강생 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {selected && (() => {
            const classStudents = students.filter((s) => s.classes.includes(selected.id));
            const activeCount = classStudents.filter((s) => s.status === StudentStatus.ACTIVE).length;
            const onLeaveCount = classStudents.filter((s) => s.status === StudentStatus.ON_LEAVE).length;
            const activeStudents = classStudents.filter((s) => s.status === StudentStatus.ACTIVE);
            const onLeaveStudents = classStudents.filter((s) => s.status === StudentStatus.ON_LEAVE);
            return (
              <>
                {/* 반 정보 카드 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selected.color }} />
                      <span className="text-[15px] font-bold text-[#111827]">{selected.name}</span>
                    </div>
                    <Button variant="default" size="sm" onClick={openEdit}>반 수정</Button>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-[12px]">
                    <div>
                      <div className="text-[#6b7280] mb-0.5">강사</div>
                      <div className="font-medium text-[#111827]">{selected.teacherName}</div>
                    </div>
                    <div>
                      <div className="text-[#6b7280] mb-0.5">정원 / 재원 / 휴원</div>
                      <div className="font-medium text-[#111827]">
                        {selected.maxStudents}명 ·{' '}
                        <span className="text-[#065f46]">재원 {activeCount}</span>
                        {onLeaveCount > 0 && (
                          <> · <span className="text-[#92400E]">휴원 {onLeaveCount}</span></>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#6b7280] mb-0.5">수강료</div>
                      <div className="font-medium text-[#111827]">{selected.fee.toLocaleString()}{FEE_TYPE_LABELS[selected.feeType ?? 'monthly']}</div>
                    </div>
                    <div>
                      <div className="text-[#6b7280] mb-0.5">강의실</div>
                      <div className="font-medium text-[#111827]">{selected.room}</div>
                    </div>
                  </div>
                </div>

                {/* 월별 캘린더 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={prevMonth} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer">
                        <ChevronLeft size={15} />
                      </button>
                      <span className="text-[13px] font-semibold text-[#111827] w-24 text-center">
                        {calYear}년 {calMonth + 1}월
                      </span>
                      <button onClick={nextMonth} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer">
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    <Button variant="default" size="sm" onClick={() => openScheduleModal()}>
                      <Plus size={12} /> 일정 추가
                    </Button>
                  </div>
                  <div className="p-4">
                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 mb-1">
                      {DAY_LABELS.map((label, i) => (
                        <div
                          key={label}
                          className={clsx('text-center text-[11px] font-medium py-1', {
                            'text-[#ef4444]': i === 0,
                            'text-[#3b82f6]': i === 6,
                            'text-[#6b7280]': i !== 0 && i !== 6,
                          })}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                    {/* 날짜 그리드 */}
                    <div className="grid grid-cols-7 gap-1">
                      {calDates.map((day, idx) => {
                        if (day === null) {
                          return <div key={`empty-${idx}`} className="min-h-[70px]" />;
                        }
                        const dateStr = toDateStr(calYear, calMonth, day);
                        const dayClasses = getClassesForDate(dateStr);
                        const isToday =
                          day === today.getDate() &&
                          calMonth === today.getMonth() &&
                          calYear === today.getFullYear();
                        const colIdx = idx % 7;
                        return (
                          <button
                            key={dateStr}
                            onClick={() => openScheduleModal(dateStr)}
                            className="min-h-[70px] p-1 border border-[#f1f5f9] rounded-[6px] text-left hover:bg-[#f9fafb] transition-colors cursor-pointer"
                          >
                            <div
                              className={clsx('text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full mb-1', {
                                'bg-[#1a2535] text-white': isToday,
                                'text-[#ef4444]': !isToday && colIdx === 0,
                                'text-[#3b82f6]': !isToday && colIdx === 6,
                                'text-[#374151]': !isToday && colIdx !== 0 && colIdx !== 6,
                              })}
                            >
                              {day}
                            </div>
                            <div className="space-y-0.5">
                              {dayClasses.map((cls) => (
                                <div
                                  key={cls.id}
                                  className={clsx(
                                    'text-[9.5px] px-1 rounded truncate',
                                    cls.id === selected.id
                                      ? 'text-white font-medium'
                                      : 'opacity-50',
                                  )}
                                  style={{
                                    backgroundColor: cls.color,
                                    color: cls.id === selected.id ? 'white' : cls.color,
                                    opacity: cls.id === selected.id ? 1 : 0.4,
                                  }}
                                >
                                  {cls.id === selected.id ? cls.name.slice(0, 5) : '●'}
                                </div>
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* 범례 */}
                    <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[#f1f5f9]">
                      {classes.map((cls) => (
                        <div key={cls.id} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                          <span className={clsx('text-[10.5px]', cls.id === selected.id ? 'font-semibold text-[#111827]' : 'text-[#9ca3af]')}>
                            {cls.name}
                          </span>
                        </div>
                      ))}
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
                              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ backgroundColor: s.avatarColor }}>
                                {s.name[0]}
                              </span>
                              <span className="text-[12px] text-[#374151]">{s.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  removeStudentFromClass(s.id, selected.id);
                                  toast(`${s.name} 학생이 반에서 제외되었습니다.`, 'info');
                                }}
                                className="ml-0.5 text-[#9ca3af] hover:text-[#ef4444] transition-colors cursor-pointer"
                                title="반에서 제외"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11.5px] text-[#9ca3af]">재원생 없음</div>
                      )}
                    </div>
                    {onLeaveStudents.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold text-[#92400E] mb-1.5">휴원 · {onLeaveStudents.length}명</div>
                        <div className="flex flex-wrap gap-2">
                          {onLeaveStudents.map((s) => (
                            <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FEF3C7] rounded-[8px] opacity-75" title={s.memo || '휴원'}>
                              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ backgroundColor: s.avatarColor }}>
                                {s.name[0]}
                              </span>
                              <span className="text-[12px] text-[#92400E]">{s.name}</span>
                              <span className="text-[9.5px] px-1 rounded bg-[#FEF3C7] text-[#92400E] border border-[#fcd34d]">휴원</span>
                              <button
                                type="button"
                                onClick={() => {
                                  removeStudentFromClass(s.id, selected.id);
                                  toast(`${s.name} 학생이 반에서 제외되었습니다.`, 'info');
                                }}
                                className="ml-0.5 text-[#b45309] hover:text-[#ef4444] transition-colors cursor-pointer"
                                title="반에서 제외"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── 반 추가 모달 ─────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="반 추가"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setAddOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAddClass}>등록</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">반 이름 *</label>
            <input className={fieldCls} value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 초등수학 기초반" />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">담당 강사</label>
            <input className={fieldCls} value={addForm.teacher} onChange={(e) => setAddForm((f) => ({ ...f, teacher: e.target.value }))} placeholder="예: 김선생" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">정원</label>
              <input type="number" className={fieldCls} value={addForm.maxStudents} onChange={(e) => setAddForm((f) => ({ ...f, maxStudents: e.target.value }))} placeholder="예: 8" min={1} />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">강의실</label>
              <input className={fieldCls} value={addForm.room} onChange={(e) => setAddForm((f) => ({ ...f, room: e.target.value }))} placeholder="예: A강의실" />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">수강료</label>
            <div className="flex gap-1.5 mb-2">
              {FEE_TYPES.map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setAddForm((f) => ({ ...f, feeType: ft }))}
                  className={clsx(
                    'flex-1 text-[11.5px] py-1.5 rounded-[8px] border transition-colors cursor-pointer',
                    addForm.feeType === ft
                      ? 'bg-[#1a2535] text-white border-[#1a2535]'
                      : 'bg-[#f4f6f8] text-[#6b7280] border-[#e2e8f0] hover:border-[#1a2535]',
                  )}
                >
                  {FEE_TYPE_NAMES[ft]}
                </button>
              ))}
            </div>
            <input type="number" className={fieldCls} value={addForm.fee} onChange={(e) => setAddForm((f) => ({ ...f, fee: e.target.value }))} placeholder={`예: 280000 (${FEE_TYPE_LABELS[addForm.feeType]})`} />
          </div>
        </div>
      </Modal>

      {/* ── 반 수정 모달 ─────────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="반 수정"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setEditOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleEditClass}>저장</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">반 이름 *</label>
            <input className={fieldCls} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">담당 강사</label>
            <input className={fieldCls} value={editForm.teacher} onChange={(e) => setEditForm((f) => ({ ...f, teacher: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">정원</label>
              <input type="number" className={fieldCls} value={editForm.maxStudents} onChange={(e) => setEditForm((f) => ({ ...f, maxStudents: e.target.value }))} min={1} />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">강의실</label>
              <input className={fieldCls} value={editForm.room} onChange={(e) => setEditForm((f) => ({ ...f, room: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">수강료</label>
            <div className="flex gap-1.5 mb-2">
              {FEE_TYPES.map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, feeType: ft }))}
                  className={clsx(
                    'flex-1 text-[11.5px] py-1.5 rounded-[8px] border transition-colors cursor-pointer',
                    editForm.feeType === ft
                      ? 'bg-[#1a2535] text-white border-[#1a2535]'
                      : 'bg-[#f4f6f8] text-[#6b7280] border-[#e2e8f0] hover:border-[#1a2535]',
                  )}
                >
                  {FEE_TYPE_NAMES[ft]}
                </button>
              ))}
            </div>
            <input type="number" className={fieldCls} value={editForm.fee} onChange={(e) => setEditForm((f) => ({ ...f, fee: e.target.value }))} placeholder={`${FEE_TYPE_LABELS[editForm.feeType]}`} />
          </div>
        </div>
      </Modal>

      {/* ── 학생 추가 모달 ───────────────────────────────── */}
      <Modal
        open={addStudentOpen}
        onClose={() => setAddStudentOpen(false)}
        title="학생 추가"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setAddStudentOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAddStudents}>
              추가 {selectedStudentIds.length > 0 && `(${selectedStudentIds.length}명)`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <input
            className={fieldCls}
            placeholder="이름으로 검색"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {addableStudents.length === 0 ? (
              <div className="text-[12px] text-[#9ca3af] text-center py-6">
                {studentSearch ? '검색 결과가 없습니다.' : '추가 가능한 학생이 없습니다.'}
              </div>
            ) : (
              addableStudents.map((s) => {
                const isSelected = selectedStudentIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStudentSelect(s.id)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-left transition-colors cursor-pointer',
                      isSelected ? 'bg-[#E1F5EE] border border-[#4fc3a1]' : 'hover:bg-[#f4f6f8] border border-transparent',
                    )}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                      style={{ backgroundColor: s.avatarColor }}
                    >
                      {s.name[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-[#111827]">{s.name}</div>
                      <div className="text-[11px] text-[#6b7280]">{s.school} · {s.grade}학년</div>
                    </div>
                    {isSelected && (
                      <span className="text-[10.5px] text-[#4fc3a1] font-semibold shrink-0">선택됨</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* ── 일정 추가 모달 ───────────────────────────────── */}
      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="일정 추가"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setScheduleOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAddSchedule}>추가</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">날짜 *</label>
            <input
              type="date"
              className={fieldCls}
              value={scheduleForm.date}
              onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">반 *</label>
            <select
              className={fieldCls}
              value={scheduleForm.classId}
              onChange={(e) => setScheduleForm((f) => ({ ...f, classId: e.target.value }))}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">시작 시간 *</label>
              <input
                type="time"
                className={fieldCls}
                value={scheduleForm.startTime}
                onChange={(e) => setScheduleForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">종료 시간 *</label>
              <input
                type="time"
                className={fieldCls}
                value={scheduleForm.endTime}
                onChange={(e) => setScheduleForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">반복</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-[12.5px]">
                <input
                  type="radio"
                  name="scheduleMode"
                  value="once"
                  checked={scheduleForm.mode === 'once'}
                  onChange={() => setScheduleForm((f) => ({ ...f, mode: 'once' }))}
                  className="accent-[#4fc3a1]"
                />
                이 날만
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[12.5px]">
                <input
                  type="radio"
                  name="scheduleMode"
                  value="weekly"
                  checked={scheduleForm.mode === 'weekly'}
                  onChange={() => setScheduleForm((f) => ({ ...f, mode: 'weekly' }))}
                  className="accent-[#4fc3a1]"
                />
                매주 반복
              </label>
            </div>
            {scheduleForm.mode === 'weekly' && scheduleForm.date && (
              <div className="mt-2 text-[11.5px] text-[#4fc3a1] bg-[#f0fdf9] px-3 py-2 rounded-[8px]">
                매주 {DAY_LABELS[new Date(scheduleForm.date + 'T00:00:00').getDay()]}요일
                {' '}{scheduleForm.startTime}~{scheduleForm.endTime}에 반복 등록됩니다.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
