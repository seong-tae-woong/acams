'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import Modal from '@/components/shared/Modal';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { StudentStatus } from '@/lib/types/student';
import type { DayOfWeek, FeeType, CurriculumPalette } from '@/lib/types/class';
import { FEE_TYPE_LABELS, FEE_TYPE_NAMES, CURRICULUM_PALETTES } from '@/lib/types/class';
import { toast } from '@/lib/stores/toastStore';
import { Plus, ChevronLeft, ChevronRight, X, BookOpen, Minus, Pencil, Phone, Mail, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const FEE_TYPES: FeeType[] = ['monthly', 'per-lesson'];
const PRESET_COLORS = ['#4fc3a1', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#f97316', '#ec4899'];
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const CLASS_DETAIL_TABS = [
  { value: 'schedule', label: '시간표 / 수강생' },
  { value: 'teacher', label: '강사 정보' },
  { value: 'curriculum', label: '교재/커리큘럼' },
];

// ── 커리큘럼/교재 타입 ──────────────────────────────────
interface Textbook {
  id: string; classId: string; name: string; publisher: string;
  unit: string; totalUnits: number; price: number; currentUnit: number;
  isbn: string; purchaseDate: string; memo: string;
}
type CurriculumUnitType = 'MONTH' | 'WEEK' | 'SESSION';
interface CurriculumRow {
  id: string; unitType: CurriculumUnitType;
  startWeek: number; endWeek: number;
  topic: string; detail: string;
  color: string | null;
  done: boolean;
}
const UNIT_TYPE_OPTIONS: { value: CurriculumUnitType; label: string; suffix: string }[] = [
  { value: 'MONTH', label: '월별', suffix: '월' },
  { value: 'WEEK', label: '주차별', suffix: '주차' },
  { value: 'SESSION', label: '차수별', suffix: '차시' },
];
const unitSuffix = (t: CurriculumUnitType) => UNIT_TYPE_OPTIONS.find((u) => u.value === t)?.suffix ?? '주차';

// 팔레트 + 인덱스로 막대 색 자동 부여 (직접 지정된 color가 우선)
function resolveBarColor(row: CurriculumRow, indexInGroup: number, palette: CurriculumPalette): string {
  if (row.color) return row.color;
  const colors = CURRICULUM_PALETTES[palette]?.colors ?? CURRICULUM_PALETTES.green.colors;
  return colors[indexInGroup % colors.length];
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const PERMISSION_LABELS: Record<string, string> = {
  manageStudents: '학생 관리',
  manageClasses: '반 관리',
  manageAttendance: '출결 관리',
  manageGrades: '성적 관리',
  manageFinance: '재무 관리',
  manageNotifications: '알림/공지',
  viewReports: '리포트 조회',
  admin: '전체 관리자',
};

export default function ClassesPage() {
  const { classes, selectedClassId, loading, setSelectedClass, addClass, updateClass, classEvents, addClassEvent, fetchClasses } = useClassStore();
  const { students, addStudentToClass, removeStudentFromClass, fetchStudents } = useStudentStore();
  const { teachers, fetchTeachers } = useTeacherStore();

  useEffect(() => {
    fetchClasses();
    fetchStudents();
    fetchTeachers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = classes.find((c) => c.id === selectedClassId);

  // ── 반 상세 탭 ─────────────────────────────────────────
  const [classDetailTab, setClassDetailTab] = useState('schedule');

  // classDetailTab 변경 시 데이터 로드
  useEffect(() => {
    if (classDetailTab === 'teacher') fetchTeachers();
    if (classDetailTab === 'curriculum' && selectedClassId) {
      fetchTextbooks(selectedClassId);
      fetchCurriculumData(selectedClassId);
    }
  }, [classDetailTab, selectedClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 반 변경 시 탭 초기화 + 커리큘럼 리로드
  useEffect(() => {
    setClassDetailTab('schedule');
  }, [selectedClassId]);

  // ── 커리큘럼/교재 상태 ──────────────────────────────────
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumRow[]>([]);
  const [curriculumSubTab, setCurriculumSubTab] = useState<'curriculum' | 'textbook'>('curriculum');

  const fetchTextbooks = useCallback(async (classId: string) => {
    try {
      const res = await fetch(`/api/classes/${classId}/textbooks`);
      if (res.ok) setTextbooks(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchCurriculumData = useCallback(async (classId: string) => {
    try {
      const res = await fetch(`/api/classes/${classId}/curriculum`);
      if (res.ok) setCurriculum(await res.json());
    } catch { /* silent */ }
  }, []);

  const toggleCurriculumDone = async (row: CurriculumRow) => {
    if (!selectedClassId) return;
    const updated = { ...row, done: !row.done };
    setCurriculum((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    try {
      await fetch(`/api/classes/${selectedClassId}/curriculum/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: updated.done }),
      });
    } catch { /* silent */ }
  };

  // ── 커리큘럼 추가/수정 모달 ────────────────────────────
  const [currModalOpen, setCurrModalOpen] = useState(false);
  const [currEditId, setCurrEditId] = useState<string | null>(null);
  const [currForm, setCurrForm] = useState<{ unitType: CurriculumUnitType; startWeek: string; endWeek: string; topic: string; detail: string; color: string }>({ unitType: 'WEEK', startWeek: '1', endWeek: '1', topic: '', detail: '', color: '' });

  const openCurrAdd = () => {
    if (!selectedClassId) { toast('먼저 반을 선택해주세요.', 'error'); return; }
    setCurrEditId(null);
    setCurrForm({ unitType: 'WEEK', startWeek: '1', endWeek: '1', topic: '', detail: '', color: '' });
    setCurrModalOpen(true);
  };

  const openCurrEdit = (row: CurriculumRow) => {
    setCurrEditId(row.id);
    setCurrForm({
      unitType: row.unitType,
      startWeek: String(row.startWeek),
      endWeek: String(row.endWeek),
      topic: row.topic,
      detail: row.detail,
      color: row.color ?? '',
    });
    setCurrModalOpen(true);
  };

  const handleSaveCurriculum = async () => {
    if (!selectedClassId) return;
    if (!currForm.topic.trim()) { toast('단원명을 입력해주세요.', 'error'); return; }
    const start = parseInt(currForm.startWeek);
    let end = currForm.endWeek.trim() === '' ? start : parseInt(currForm.endWeek);
    if (isNaN(start) || start < 1) { toast('시작 차수는 1 이상이어야 합니다.', 'error'); return; }
    if (isNaN(end) || end < start) end = start;
    const payload = {
      unitType: currForm.unitType,
      startWeek: start,
      endWeek: end,
      topic: currForm.topic.trim(),
      detail: currForm.detail.trim(),
      color: currForm.color.trim() || null,
    };
    try {
      if (currEditId) {
        const res = await fetch(`/api/classes/${selectedClassId}/curriculum/${currEditId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || ''); }
        const updated: CurriculumRow = await res.json();
        setCurriculum((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        toast('커리큘럼이 수정되었습니다.', 'success');
      } else {
        const res = await fetch(`/api/classes/${selectedClassId}/curriculum`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || ''); }
        const newRow: CurriculumRow = await res.json();
        setCurriculum((prev) => [...prev, newRow]);
        toast(`'${newRow.topic}' 단원이 추가되었습니다.`, 'success');
      }
      setCurrModalOpen(false);
    } catch (err) {
      toast((err as Error).message || '저장에 실패했습니다.', 'error');
    }
  };

  const handleDeleteCurriculum = async (row: CurriculumRow) => {
    if (!selectedClassId) return;
    if (!confirm(`'${row.topic}' 단원을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/curriculum/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCurriculum((prev) => prev.filter((r) => r.id !== row.id));
      toast('삭제되었습니다.', 'info');
    } catch {
      toast('삭제에 실패했습니다.', 'error');
    }
  };

  // ── 팔레트 선택기 ─────────────────────────────────────
  const currentPalette: CurriculumPalette = (selected?.curriculumPalette as CurriculumPalette) ?? 'green';
  const handlePaletteChange = async (p: CurriculumPalette) => {
    if (!selected) return;
    if (p === currentPalette) return;
    try {
      await updateClass(selected.id, { curriculumPalette: p });
    } catch { /* store handles toast */ }
  };

  // ── 교재 추가/수정 모달 ────────────────────────────────
  const blankTbForm = { name: '', publisher: '', unit: '권', totalUnits: '1', price: '', currentUnit: '1', isbn: '', purchaseDate: '', memo: '' };
  const [tbModalOpen, setTbModalOpen] = useState(false);
  const [tbEditId, setTbEditId] = useState<string | null>(null);
  const [tbForm, setTbForm] = useState(blankTbForm);

  const openTbAdd = () => {
    if (!selectedClassId) { toast('먼저 반을 선택해주세요.', 'error'); return; }
    setTbEditId(null);
    setTbForm(blankTbForm);
    setTbModalOpen(true);
  };

  const openTbEdit = (tb: Textbook) => {
    setTbEditId(tb.id);
    setTbForm({
      name: tb.name, publisher: tb.publisher, unit: tb.unit || '권',
      totalUnits: String(tb.totalUnits), price: String(tb.price),
      currentUnit: String(tb.currentUnit), isbn: tb.isbn,
      purchaseDate: tb.purchaseDate || '', memo: tb.memo,
    });
    setTbModalOpen(true);
  };

  const handleSaveTextbook = async () => {
    if (!selectedClassId) return;
    if (!tbForm.name.trim()) { toast('교재명을 입력해주세요.', 'error'); return; }
    const payload = {
      name: tbForm.name.trim(),
      publisher: tbForm.publisher.trim(),
      unit: tbForm.unit.trim() || '권',
      totalUnits: parseInt(tbForm.totalUnits) || 1,
      currentUnit: parseInt(tbForm.currentUnit) || 1,
      price: parseInt(tbForm.price) || 0,
      isbn: tbForm.isbn.trim(),
      purchaseDate: tbForm.purchaseDate || null,
      memo: tbForm.memo.trim(),
    };
    try {
      if (tbEditId) {
        const res = await fetch(`/api/classes/${selectedClassId}/textbooks/${tbEditId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const updated: Textbook = await res.json();
        setTextbooks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        toast('교재 정보가 수정되었습니다.', 'success');
      } else {
        const res = await fetch(`/api/classes/${selectedClassId}/textbooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const newTb: Textbook = await res.json();
        setTextbooks((prev) => [...prev, newTb]);
        toast(`'${newTb.name}' 교재가 추가되었습니다.`, 'success');
      }
      setTbModalOpen(false);
    } catch {
      toast('저장에 실패했습니다.', 'error');
    }
  };

  const handleDeleteTextbook = async (tb: Textbook) => {
    if (!selectedClassId) return;
    if (!confirm(`'${tb.name}' 교재를 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/textbooks/${tb.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTextbooks((prev) => prev.filter((t) => t.id !== tb.id));
      toast('교재가 삭제되었습니다.', 'info');
    } catch {
      toast('삭제에 실패했습니다.', 'error');
    }
  };

  // ── 반 추가 ───────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const blankAddForm = { name: '', teacherId: '', fee: '', feeType: 'monthly' as FeeType, room: '', maxStudents: '', description: '' };
  const [addForm, setAddForm] = useState(blankAddForm);

  const handleAddClass = async () => {
    if (!addForm.name.trim()) { toast('반 이름을 입력해주세요.', 'error'); return; }
    const selectedTeacher = teachers.find((t) => t.id === addForm.teacherId);
    try {
      await addClass({
        name: addForm.name.trim(), subject: '',
        teacherId: addForm.teacherId,
        teacherName: selectedTeacher?.name ?? '',
        maxStudents: parseInt(addForm.maxStudents) || 0,
        schedule: [],
        color: PRESET_COLORS[classes.length % PRESET_COLORS.length],
        room: addForm.room.trim(), fee: parseInt(addForm.fee) || 0,
        feeType: addForm.feeType,
        description: addForm.description.trim(),
      });
      setAddForm(blankAddForm);
      setAddOpen(false);
    } catch { /* store handles error toast */ }
  };

  // ── 반 수정 ───────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', teacherId: '', fee: '', feeType: 'monthly' as FeeType, room: '', maxStudents: '', description: '' });

  const openEdit = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name, teacherId: selected.teacherId,
      fee: String(selected.fee), feeType: selected.feeType ?? 'monthly',
      room: selected.room, maxStudents: String(selected.maxStudents),
      description: selected.description ?? '',
    });
    setEditOpen(true);
  };

  const handleEditClass = async () => {
    if (!selected) return;
    if (!editForm.name.trim()) { toast('반 이름을 입력해주세요.', 'error'); return; }
    const selectedTeacher = teachers.find((t) => t.id === editForm.teacherId);
    try {
      await updateClass(selected.id, {
        name: editForm.name.trim(),
        teacherId: editForm.teacherId,
        teacherName: selectedTeacher?.name ?? '',
        fee: parseInt(editForm.fee) || 0,
        feeType: editForm.feeType,
        room: editForm.room.trim(),
        maxStudents: parseInt(editForm.maxStudents) || 0,
        description: editForm.description.trim(),
      });
      setEditOpen(false);
    } catch { /* store handles error toast */ }
  };

  // ── 학생 추가 ─────────────────────────────────────────
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const addableStudents = useMemo(() => {
    if (!selected) return [];
    return students.filter((s) => s.status === StudentStatus.ACTIVE && !s.classes.includes(selected.id) && (studentSearch === '' || s.name.includes(studentSearch)));
  }, [students, selected, studentSearch]);

  const toggleStudentSelect = (id: string) => {
    setSelectedStudentIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleAddStudents = () => {
    if (!selected || selectedStudentIds.length === 0) { toast('추가할 학생을 선택해주세요.', 'error'); return; }
    selectedStudentIds.forEach((id) => addStudentToClass(id, selected.id));
    toast(`${selectedStudentIds.length}명이 추가되었습니다.`, 'success');
    setSelectedStudentIds([]); setStudentSearch(''); setAddStudentOpen(false);
  };

  const openAddStudent = () => { setSelectedStudentIds([]); setStudentSearch(''); setAddStudentOpen(true); };

  // ── 캘린더 ────────────────────────────────────────────
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-based

  const prevMonth = () => { if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1); };

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
  const [scheduleForm, setScheduleForm] = useState({ date: '', classId: '', startTime: '16:00', endTime: '17:00', mode: 'once' as 'once' | 'weekly' });

  const openScheduleModal = (dateStr?: string) => {
    setScheduleForm({ date: dateStr ?? '', classId: selected?.id ?? (classes[0]?.id ?? ''), startTime: '16:00', endTime: '17:00', mode: 'once' });
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
      if (targetClass.schedule.some((s) => s.dayOfWeek === dow && s.startTime === startTime && s.endTime === endTime)) {
        toast('동일한 반복 일정이 이미 있습니다.', 'error'); return;
      }
      updateClass(classId, { schedule: [...targetClass.schedule, newSchedule] });
      const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
      toast(`매주 ${DAY_KO[jsDay]}요일 ${startTime}~${endTime} 일정이 추가되었습니다.`, 'success');
    }
    setScheduleOpen(false);
  };

  const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="반 편성 및 시간표" actions={<Button variant="dark" size="sm" onClick={() => setAddOpen(true)}><Plus size={13} /> 반 추가</Button>} />
      {loading ? <LoadingSpinner /> : <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 반 목록 */}
        <div className="w-56 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {classes.map((cls) => {
            const clsMembers = students.filter((s) => s.classes.includes(cls.id));
            const activeN = clsMembers.filter((s) => s.status === StudentStatus.ACTIVE).length;
            const onLeaveN = clsMembers.filter((s) => s.status === StudentStatus.ON_LEAVE).length;
            const pct = cls.maxStudents > 0 ? Math.round((activeN / cls.maxStudents) * 100) : 0;
            const isFull = cls.maxStudents > 0 && activeN >= cls.maxStudents;
            return (
              <button key={cls.id} onClick={() => setSelectedClass(cls.id)}
                className={clsx('w-full px-3 py-3 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer', selectedClassId === cls.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                  <span className="text-[12.5px] font-medium text-[#111827] truncate">{cls.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#6b7280]">{cls.teacherName}</span>
                  <span className={clsx('text-[11px] font-medium', isFull ? 'text-[#991B1B]' : 'text-[#065f46]')}>재원 {activeN}/{cls.maxStudents}</span>
                </div>
                {onLeaveN > 0 && <div className="text-[10.5px] text-[#92400E] mt-0.5">휴원 {onLeaveN}명</div>}
                <div className="mt-1.5 h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isFull ? '#ef4444' : '#4fc3a1' }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* 우측: 반 상세 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (() => {
            const classStudents = students.filter((s) => s.classes.includes(selected.id));
            const activeStudents = classStudents.filter((s) => s.status === StudentStatus.ACTIVE);
            const onLeaveStudents = classStudents.filter((s) => s.status === StudentStatus.ON_LEAVE);
            const activeCount = activeStudents.length;
            const onLeaveCount = onLeaveStudents.length;

            // 강사 탭: teacherId 우선 조회 → teacher.classes 기반 → 이름 기반 순으로 폴백
            const assignedTeacher = (selected.teacherId ? teachers.find((t) => t.id === selected.teacherId) : null)
              ?? teachers.find((t) => t.classes.includes(selected.id))
              ?? teachers.find((t) => t.name === selected.teacherName);

            // 커리큘럼 탭: 진행률
            const doneCurriculum = curriculum.filter((r) => r.done).length;

            return (
              <>
                {/* 반 정보 카드 */}
                <div className="p-5 pb-0 shrink-0">
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
                          {selected.maxStudents}명 · <span className="text-[#065f46]">재원 {activeCount}</span>
                          {onLeaveCount > 0 && <> · <span className="text-[#92400E]">휴원 {onLeaveCount}</span></>}
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
                </div>

                {/* 탭 네비게이션 */}
                <Tabs tabs={CLASS_DETAIL_TABS} value={classDetailTab} onChange={setClassDetailTab} className="bg-white px-5 mt-4 shrink-0" />

                {/* 탭 컨텐츠 */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                  {/* ── 시간표 / 수강생 탭 ── */}
                  {classDetailTab === 'schedule' && (
                    <>
                      {/* 월별 캘린더 */}
                      <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer"><ChevronLeft size={15} /></button>
                            <span className="text-[13px] font-semibold text-[#111827] w-24 text-center">{calYear}년 {calMonth + 1}월</span>
                            <button onClick={nextMonth} className="p-1 hover:bg-[#f4f6f8] rounded cursor-pointer"><ChevronRight size={15} /></button>
                          </div>
                          <Button variant="default" size="sm" onClick={() => openScheduleModal()}><Plus size={12} /> 일정 추가</Button>
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
                              const colIdx = idx % 7;
                              return (
                                <button key={dateStr} onClick={() => openScheduleModal(dateStr)}
                                  className="min-h-[70px] p-1 border border-[#f1f5f9] rounded-[6px] text-left hover:bg-[#f9fafb] transition-colors cursor-pointer"
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
                                  <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FEF3C7] rounded-[8px] opacity-75" title={s.memo || '휴원'}>
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
                    </>
                  )}

                  {/* ── 강사 정보 탭 ── */}
                  {classDetailTab === 'teacher' && (
                    <div className="space-y-4">
                      {assignedTeacher ? (
                        <>
                          {/* 강사 기본 정보 */}
                          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white shrink-0" style={{ backgroundColor: assignedTeacher.avatarColor }}>{assignedTeacher.name[0]}</span>
                              <div>
                                <div className="text-[14px] font-bold text-[#111827]">{assignedTeacher.name}</div>
                                <div className="text-[12px] text-[#6b7280]">{assignedTeacher.subject}</div>
                              </div>
                            </div>
                            <dl className="space-y-2">
                              <div className="flex">
                                <dt className="w-24 text-[12px] text-[#6b7280] shrink-0 flex items-center gap-1"><Phone size={11} /> 연락처</dt>
                                <dd className="text-[12.5px] text-[#111827]">{assignedTeacher.phone}</dd>
                              </div>
                              <div className="flex">
                                <dt className="w-24 text-[12px] text-[#6b7280] shrink-0 flex items-center gap-1"><Mail size={11} /> 이메일</dt>
                                <dd className="text-[12.5px] text-[#111827]">{assignedTeacher.email}</dd>
                              </div>
                            </dl>
                          </div>
                          {/* 권한 */}
                          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                            <div className="text-[12.5px] font-semibold text-[#111827] mb-3">권한 현황</div>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(assignedTeacher.permissions).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between px-3 py-2 bg-[#f4f6f8] rounded-[8px]">
                                  <span className="text-[12px] text-[#374151]">{PERMISSION_LABELS[key] ?? key}</span>
                                  {value
                                    ? <ToggleRight size={18} className="text-[#4fc3a1]" />
                                    : <ToggleLeft size={18} className="text-[#d1d5db]" />
                                  }
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* 담당 반 */}
                          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                            <div className="text-[12.5px] font-semibold text-[#111827] mb-3">담당 반</div>
                            <div className="flex flex-wrap gap-2">
                              {classes
                                .filter((c) => c.teacherId === assignedTeacher.id || assignedTeacher.classes.includes(c.id))
                                .map((c) => (
                                  <span key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] text-white font-medium" style={{ backgroundColor: c.color }}>{c.name}</span>
                                ))
                              }
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-8 text-center">
                          <p className="text-[13px] text-[#9ca3af]">배정된 강사가 없습니다.</p>
                          <p className="text-[12px] text-[#9ca3af] mt-1">반 수정에서 강사를 선택하거나, 계정 관리에서 강사를 먼저 등록하세요.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 교재/커리큘럼 탭 ── */}
                  {classDetailTab === 'curriculum' && (
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                      {/* 서브 탭 */}
                      <div className="flex border-b border-[#e2e8f0] items-center">
                        {[{ value: 'curriculum' as const, label: '커리큘럼' }, { value: 'textbook' as const, label: '교재 목록' }].map((t) => (
                          <button key={t.value} onClick={() => setCurriculumSubTab(t.value)}
                            className={clsx('px-5 py-3 text-[12.5px] font-medium border-b-2 transition-colors cursor-pointer',
                              curriculumSubTab === t.value ? 'border-[#4fc3a1] text-[#4fc3a1]' : 'border-transparent text-[#6b7280] hover:text-[#374151]'
                            )}
                          >{t.label}</button>
                        ))}
                        <div className="flex-1" />
                        {curriculumSubTab === 'curriculum' ? (
                          <>
                            <div className="flex items-center px-4 text-[11.5px] text-[#6b7280]">
                              진행 {doneCurriculum}/{curriculum.length}
                              {curriculum.length > 0 && (
                                <div className="ml-2 w-24 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden inline-block">
                                  <div className="h-full bg-[#4fc3a1] rounded-full" style={{ width: `${Math.round((doneCurriculum / curriculum.length) * 100)}%` }} />
                                </div>
                              )}
                            </div>
                            <div className="pr-4">
                              <Button variant="default" size="sm" onClick={openCurrAdd}><Plus size={12} /> 단원 추가</Button>
                            </div>
                          </>
                        ) : (
                          <div className="pr-4">
                            <Button variant="default" size="sm" onClick={openTbAdd}><Plus size={12} /> 교재 추가</Button>
                          </div>
                        )}
                      </div>
                      {curriculumSubTab === 'curriculum' && (
                        <>
                          {/* 팔레트 선택기 */}
                          <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center gap-3">
                            <span className="text-[11.5px] text-[#6b7280]">색상 테마</span>
                            <div className="flex gap-1.5">
                              {(['red', 'orange', 'green', 'custom'] as CurriculumPalette[]).map((p) => {
                                const swatches = CURRICULUM_PALETTES[p].colors.slice(0, 4);
                                const active = currentPalette === p;
                                return (
                                  <button key={p} onClick={() => handlePaletteChange(p)}
                                    className={clsx('px-2 py-1 rounded-[8px] border flex items-center gap-1.5 cursor-pointer transition-colors',
                                      active ? 'border-[#1a2535] bg-[#f4f6f8]' : 'border-[#e2e8f0] hover:border-[#1a2535]'
                                    )}
                                    title={CURRICULUM_PALETTES[p].label}
                                  >
                                    {p === 'custom' ? (
                                      <span className="text-[11px] text-[#374151]">직접</span>
                                    ) : (
                                      <span className="flex">
                                        {swatches.map((c, i) => (
                                          <span key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c, marginLeft: i === 0 ? 0 : -2 }} />
                                        ))}
                                      </span>
                                    )}
                                    <span className="text-[10.5px] text-[#374151]">{CURRICULUM_PALETTES[p].label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {curriculum.length === 0 ? (
                            <div className="p-8 text-center text-[12px] text-[#9ca3af]">등록된 커리큘럼이 없습니다.</div>
                          ) : (
                            <div className="p-4 space-y-5">
                              {(['MONTH', 'WEEK', 'SESSION'] as CurriculumUnitType[]).map((ut) => {
                                const groupRows = curriculum.filter((r) => r.unitType === ut);
                                if (groupRows.length === 0) return null;
                                const minWeek = Math.min(...groupRows.map((r) => r.startWeek));
                                const maxWeek = Math.max(...groupRows.map((r) => r.endWeek));
                                const cols = maxWeek - minWeek + 1;
                                return (
                                  <div key={ut} className="border border-[#e2e8f0] rounded-[10px] overflow-hidden">
                                    <div className="px-3 py-2 bg-[#f4f6f8] text-[11.5px] font-semibold text-[#374151]">
                                      {UNIT_TYPE_OPTIONS.find((u) => u.value === ut)?.label} 커리큘럼
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="border-collapse text-[11.5px]" style={{ minWidth: '100%' }}>
                                        <thead>
                                          <tr>
                                            <th className="sticky left-0 bg-white z-10 px-3 py-2 text-left font-medium text-[#6b7280] border-b border-[#e2e8f0] w-[180px] min-w-[180px]">단원</th>
                                            {Array.from({ length: cols }).map((_, i) => (
                                              <th key={i} className="px-2 py-2 text-center font-medium text-[#6b7280] border-b border-[#e2e8f0] min-w-[44px]">
                                                {minWeek + i}{unitSuffix(ut)}
                                              </th>
                                            ))}
                                            <th className="px-2 py-2 border-b border-[#e2e8f0] w-[60px]"></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {groupRows.map((row, idx) => {
                                            const barColor = resolveBarColor(row, idx, currentPalette);
                                            const startOffset = row.startWeek - minWeek;
                                            const span = row.endWeek - row.startWeek + 1;
                                            return (
                                              <tr key={row.id} className="border-t border-[#f1f5f9] hover:bg-[#f9fafb] group">
                                                <td className="sticky left-0 bg-white z-10 px-3 py-2 group-hover:bg-[#f9fafb]">
                                                  <div className="flex items-center gap-2">
                                                    <button onClick={() => toggleCurriculumDone(row)}
                                                      className={clsx('w-4 h-4 rounded border flex items-center justify-center text-[10px] cursor-pointer shrink-0',
                                                        row.done ? 'bg-[#4fc3a1] border-[#4fc3a1] text-white' : 'border-[#cbd5e1] hover:border-[#4fc3a1]'
                                                      )}
                                                      title={row.done ? '완료' : '예정'}
                                                    >{row.done ? '✓' : ''}</button>
                                                    <span className="font-medium text-[#111827] truncate" title={row.topic}>{row.topic}</span>
                                                  </div>
                                                  {row.detail && <div className="text-[10.5px] text-[#9ca3af] mt-0.5 ml-6 truncate" title={row.detail}>{row.detail}</div>}
                                                </td>
                                                {/* 빈 셀 + 막대 셀 + 빈 셀 */}
                                                {Array.from({ length: cols }).map((_, i) => {
                                                  if (i === startOffset) {
                                                    return (
                                                      <td key={i} colSpan={span} className="p-1 align-middle">
                                                        <div className="rounded-[6px] text-white text-[10.5px] font-medium px-2 py-1 truncate text-center"
                                                          style={{ backgroundColor: barColor, opacity: row.done ? 0.6 : 1 }}
                                                          title={`${row.topic} (${row.startWeek}${unitSuffix(ut)}~${row.endWeek}${unitSuffix(ut)})`}
                                                        >
                                                          {row.topic}
                                                        </div>
                                                      </td>
                                                    );
                                                  }
                                                  if (i > startOffset && i < startOffset + span) return null;
                                                  return <td key={i} className="border-l border-[#f8fafc]"></td>;
                                                })}
                                                <td className="px-2 py-1 text-right whitespace-nowrap">
                                                  <button onClick={() => openCurrEdit(row)} className="p-1 text-[#6b7280] hover:text-[#4fc3a1] cursor-pointer" title="수정"><Pencil size={13} /></button>
                                                  <button onClick={() => handleDeleteCurriculum(row)} className="p-1 ml-1 text-[#6b7280] hover:text-[#ef4444] cursor-pointer" title="삭제"><Trash2 size={13} /></button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                      {curriculumSubTab === 'textbook' && (
                        textbooks.length === 0 ? (
                          <div className="p-8 text-center text-[12px] text-[#9ca3af]">등록된 교재가 없습니다.</div>
                        ) : (
                          <div className="divide-y divide-[#f1f5f9]">
                            {textbooks.map((tb) => (
                              <div key={tb.id} className="px-4 py-3 flex items-center gap-3 group">
                                <div className="w-8 h-8 rounded-[6px] bg-[#EDE9FE] flex items-center justify-center shrink-0">
                                  <BookOpen size={14} className="text-[#5B4FBE]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12.5px] font-medium text-[#111827]">{tb.name}</div>
                                  <div className="text-[11px] text-[#6b7280]">
                                    {tb.publisher && `${tb.publisher} · `}{tb.price.toLocaleString()}원{tb.unit && ` / ${tb.unit}`}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[11.5px] text-[#374151]">{tb.currentUnit} / {tb.totalUnits}{tb.unit || '단원'}</div>
                                  <div className="w-20 h-1.5 bg-[#f1f5f9] rounded-full mt-1">
                                    <div className="h-full bg-[#4fc3a1] rounded-full" style={{ width: `${tb.totalUnits > 0 ? Math.round((tb.currentUnit / tb.totalUnits) * 100) : 0}%` }} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 ml-2 shrink-0">
                                  <button onClick={() => openTbEdit(tb)} className="p-1.5 text-[#6b7280] hover:text-[#4fc3a1] cursor-pointer" title="수정"><Pencil size={13} /></button>
                                  <button onClick={() => handleDeleteTextbook(tb)} className="p-1.5 text-[#6b7280] hover:text-[#ef4444] cursor-pointer" title="삭제"><Trash2 size={13} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })() : (
            <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
              <p className="text-[13px] text-[#9ca3af]">좌측에서 반을 선택하세요</p>
            </div>
          )}
        </div>
      </div>}

      {/* ── 반 추가 모달 ─────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="반 추가" size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setAddOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleAddClass}>등록</Button></>}
      >
        <div className="space-y-3">
          <div><label className="text-[11.5px] text-[#6b7280] block mb-1">반 이름 *</label><input className={fieldCls} value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 초등수학 기초반" /></div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">담당 강사</label>
            <select className={fieldCls} value={addForm.teacherId} onChange={(e) => setAddForm((f) => ({ ...f, teacherId: e.target.value }))}>
              <option value="">강사를 선택하세요</option>
              {teachers.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.subject ? ` (${t.subject})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">정원</label><input type="number" className={fieldCls} value={addForm.maxStudents} onChange={(e) => setAddForm((f) => ({ ...f, maxStudents: e.target.value }))} placeholder="예: 8" min={1} /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">강의실</label><input className={fieldCls} value={addForm.room} onChange={(e) => setAddForm((f) => ({ ...f, room: e.target.value }))} placeholder="예: A강의실" /></div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">수강료</label>
            <div className="flex gap-1.5 mb-2">
              {FEE_TYPES.map((ft) => (
                <button key={ft} type="button" onClick={() => setAddForm((f) => ({ ...f, feeType: ft }))}
                  className={clsx('flex-1 text-[11.5px] py-1.5 rounded-[8px] border transition-colors cursor-pointer', addForm.feeType === ft ? 'bg-[#1a2535] text-white border-[#1a2535]' : 'bg-[#f4f6f8] text-[#6b7280] border-[#e2e8f0] hover:border-[#1a2535]')}
                >{FEE_TYPE_NAMES[ft]}</button>
              ))}
            </div>
            <input type="number" className={fieldCls} value={addForm.fee} onChange={(e) => setAddForm((f) => ({ ...f, fee: e.target.value }))} placeholder={`예: 280000 (${FEE_TYPE_LABELS[addForm.feeType]})`} />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">반 소개글</label>
            <textarea className={fieldCls + ' resize-none'} rows={3} value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="공개 페이지에 노출되는 반 소개입니다. 예: 기초부터 차근차근 다지는 영어 입문반입니다." />
          </div>
        </div>
      </Modal>

      {/* ── 반 수정 모달 ─────────────────────────────────── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="반 수정" size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setEditOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleEditClass}>저장</Button></>}
      >
        <div className="space-y-3">
          <div><label className="text-[11.5px] text-[#6b7280] block mb-1">반 이름 *</label><input className={fieldCls} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">담당 강사</label>
            <select className={fieldCls} value={editForm.teacherId} onChange={(e) => setEditForm((f) => ({ ...f, teacherId: e.target.value }))}>
              <option value="">강사를 선택하세요</option>
              {teachers.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.subject ? ` (${t.subject})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">정원</label><input type="number" className={fieldCls} value={editForm.maxStudents} onChange={(e) => setEditForm((f) => ({ ...f, maxStudents: e.target.value }))} min={1} /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">강의실</label><input className={fieldCls} value={editForm.room} onChange={(e) => setEditForm((f) => ({ ...f, room: e.target.value }))} /></div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">수강료</label>
            <div className="flex gap-1.5 mb-2">
              {FEE_TYPES.map((ft) => (
                <button key={ft} type="button" onClick={() => setEditForm((f) => ({ ...f, feeType: ft }))}
                  className={clsx('flex-1 text-[11.5px] py-1.5 rounded-[8px] border transition-colors cursor-pointer', editForm.feeType === ft ? 'bg-[#1a2535] text-white border-[#1a2535]' : 'bg-[#f4f6f8] text-[#6b7280] border-[#e2e8f0] hover:border-[#1a2535]')}
                >{FEE_TYPE_NAMES[ft]}</button>
              ))}
            </div>
            <input type="number" className={fieldCls} value={editForm.fee} onChange={(e) => setEditForm((f) => ({ ...f, fee: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">반 소개글</label>
            <textarea className={fieldCls + ' resize-none'} rows={3} value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="공개 페이지에 노출되는 반 소개입니다." />
          </div>
        </div>
      </Modal>

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
            <select className={fieldCls} value={scheduleForm.classId} onChange={(e) => setScheduleForm((f) => ({ ...f, classId: e.target.value }))}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">시작 시간 *</label><input type="time" className={fieldCls} value={scheduleForm.startTime} onChange={(e) => setScheduleForm((f) => ({ ...f, startTime: e.target.value }))} /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">종료 시간 *</label><input type="time" className={fieldCls} value={scheduleForm.endTime} onChange={(e) => setScheduleForm((f) => ({ ...f, endTime: e.target.value }))} /></div>
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

      {/* ── 커리큘럼 추가/수정 모달 ───────────────────────── */}
      <Modal open={currModalOpen} onClose={() => setCurrModalOpen(false)}
        title={currEditId ? '단원 수정' : '단원 추가'} size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setCurrModalOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleSaveCurriculum}>{currEditId ? '저장' : '추가'}</Button></>}
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">구분 *</label>
            <div className="flex gap-1.5">
              {UNIT_TYPE_OPTIONS.map((u) => (
                <button key={u.value} type="button" onClick={() => setCurrForm((f) => ({ ...f, unitType: u.value }))}
                  className={clsx('flex-1 text-[11.5px] py-1.5 rounded-[8px] border transition-colors cursor-pointer',
                    currForm.unitType === u.value ? 'bg-[#1a2535] text-white border-[#1a2535]' : 'bg-[#f4f6f8] text-[#6b7280] border-[#e2e8f0] hover:border-[#1a2535]'
                  )}
                >{u.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">시작 {unitSuffix(currForm.unitType)} *</label>
              <input type="number" min={1} className={fieldCls} value={currForm.startWeek}
                onChange={(e) => setCurrForm((f) => ({ ...f, startWeek: e.target.value }))}
                placeholder={`예: 1`} />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">끝 {unitSuffix(currForm.unitType)}</label>
              <input type="number" min={1} className={fieldCls} value={currForm.endWeek}
                onChange={(e) => setCurrForm((f) => ({ ...f, endWeek: e.target.value }))}
                placeholder="비워두면 시작과 동일" />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">단원명 *</label>
            <input className={fieldCls} value={currForm.topic}
              onChange={(e) => setCurrForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="예: 기초입문" />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">세부 내용</label>
            <textarea className={fieldCls + ' resize-none'} rows={2} value={currForm.detail}
              onChange={(e) => setCurrForm((f) => ({ ...f, detail: e.target.value }))}
              placeholder="예: 시험에 꼭 나오는 핵심이론을 이해/암기" />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">막대 색상 (선택)</label>
            <div className="flex items-center gap-2">
              <input type="color" className="w-9 h-9 border border-[#e2e8f0] rounded-[8px] cursor-pointer"
                value={currForm.color || '#4fc3a1'}
                onChange={(e) => setCurrForm((f) => ({ ...f, color: e.target.value }))} />
              <input type="text" className={fieldCls} value={currForm.color}
                onChange={(e) => setCurrForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="비워두면 팔레트에서 자동 부여" />
              {currForm.color && (
                <button type="button" onClick={() => setCurrForm((f) => ({ ...f, color: '' }))}
                  className="text-[11px] text-[#6b7280] hover:text-[#ef4444] px-2 cursor-pointer">초기화</button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── 교재 추가/수정 모달 ───────────────────────────── */}
      <Modal open={tbModalOpen} onClose={() => setTbModalOpen(false)}
        title={tbEditId ? '교재 수정' : '교재 추가'} size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setTbModalOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleSaveTextbook}>{tbEditId ? '저장' : '추가'}</Button></>}
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">교재명 *</label>
            <input className={fieldCls} value={tbForm.name} onChange={(e) => setTbForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 개념수학 5학년" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">출판사</label><input className={fieldCls} value={tbForm.publisher} onChange={(e) => setTbForm((f) => ({ ...f, publisher: e.target.value }))} placeholder="예: 천재교육" /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">가격 (원)</label><input type="number" className={fieldCls} value={tbForm.price} onChange={(e) => setTbForm((f) => ({ ...f, price: e.target.value }))} placeholder="예: 18000" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">단위</label><input className={fieldCls} value={tbForm.unit} onChange={(e) => setTbForm((f) => ({ ...f, unit: e.target.value }))} placeholder="권" /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">총 권수</label><input type="number" className={fieldCls} value={tbForm.totalUnits} onChange={(e) => setTbForm((f) => ({ ...f, totalUnits: e.target.value }))} min={1} /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">현재 권</label><input type="number" className={fieldCls} value={tbForm.currentUnit} onChange={(e) => setTbForm((f) => ({ ...f, currentUnit: e.target.value }))} min={1} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">ISBN</label><input className={fieldCls} value={tbForm.isbn} onChange={(e) => setTbForm((f) => ({ ...f, isbn: e.target.value }))} placeholder="978-..." /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">구입일</label><input type="date" className={fieldCls} value={tbForm.purchaseDate} onChange={(e) => setTbForm((f) => ({ ...f, purchaseDate: e.target.value }))} /></div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">메모</label>
            <input className={fieldCls} value={tbForm.memo} onChange={(e) => setTbForm((f) => ({ ...f, memo: e.target.value }))} placeholder="예: 상·하 2권 세트" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
