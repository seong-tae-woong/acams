'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import Badge from '@/components/shared/Badge';
import SearchInput from '@/components/shared/SearchInput';
import FilterTags from '@/components/shared/FilterTags';
import Tabs from '@/components/shared/Tabs';
import Modal from '@/components/shared/Modal';
import AttendanceCalendarModal from '@/components/admin/AttendanceCalendarModal';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useAttendanceStore } from '@/lib/stores/attendanceStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { AttendanceStatus } from '@/lib/types/attendance';
import { StudentStatus } from '@/lib/types/student';
import type { ConsultationType } from '@/lib/types/notification';
import type { Bill } from '@/lib/types/finance';
import type { CalendarEvent } from '@/lib/types/calendar';
import { formatKoreanDate, formatPhone } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Phone, School, Calendar, StickyNote, Users, KeyRound, X, CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import StudentReportTab from '@/components/admin/StudentReportTab';
import clsx from 'clsx';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: StudentStatus.ACTIVE, label: '재원' },
  { value: StudentStatus.ON_LEAVE, label: '휴원' },
  { value: StudentStatus.WITHDRAWN, label: '퇴원' },
  { value: StudentStatus.WAITING, label: '대기' },
];

const DETAIL_TABS = [
  { value: 'info', label: '기본정보' },
  { value: 'class', label: '수강정보' },
  { value: 'attendance', label: '출결정보' },
  { value: 'grade', label: '성적정보' },
  { value: 'payment', label: '결제정보' },
  { value: 'consult', label: '상담정보' },
  { value: 'report', label: '리포트' },
];

const AVATAR_COLORS = ['#4A90D9','#7B68EE','#20B2AA','#FF6B6B','#FFD93D','#6BCB77','#F4A261','#A78BFA','#34D399','#FB7185'];

const ATT_STATUS_COLORS: Record<string, string> = {
  [AttendanceStatus.PRESENT]: 'bg-[#D1FAE5] text-[#065f46]',
  [AttendanceStatus.ABSENT]: 'bg-[#FEE2E2] text-[#991B1B]',
  [AttendanceStatus.LATE]: 'bg-[#FEF3C7] text-[#92400E]',
  [AttendanceStatus.EARLY_LEAVE]: 'bg-[#DBEAFE] text-[#1d4ed8]',
};
const ATT_STATUS_SHORT: Record<string, string> = {
  [AttendanceStatus.PRESENT]: '출',
  [AttendanceStatus.ABSENT]: '결',
  [AttendanceStatus.LATE]: '지',
  [AttendanceStatus.EARLY_LEAVE]: '조',
};

const CONSULT_TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  '대면': { bg: '#D1FAE5', text: '#065f46' },
  '전화': { bg: '#DBEAFE', text: '#1d4ed8' },
  '온라인': { bg: '#EDE9FE', text: '#5B4FBE' },
};

const BILL_STATUS_BADGE: Record<string, string> = {
  '완납': 'bg-[#D1FAE5] text-[#065f46]',
  '미납': 'bg-[#FEE2E2] text-[#991B1B]',
  '부분납': 'bg-[#FEF3C7] text-[#92400E]',
};

interface StudentForm {
  name: string; school: string; schoolLevel: string; grade: string;
  phone: string; parentName: string; parentPhone: string;
  status: StudentStatus; enrollDate: string; memo: string;
  birthDate: string;
}

const SCHOOL_LEVELS = ['초등학교', '중학교', '고등학교', '대학교'] as const;

function parseSchool(full: string): { school: string; schoolLevel: string } {
  for (const lv of SCHOOL_LEVELS) {
    if (full.endsWith(lv)) return { school: full.slice(0, -lv.length), schoolLevel: lv };
  }
  return { school: full, schoolLevel: '초등학교' };
}

const EMPTY_FORM: StudentForm = {
  name: '', school: '', schoolLevel: '초등학교', grade: '3',
  phone: '', parentName: '', parentPhone: '',
  status: StudentStatus.ACTIVE, enrollDate: new Date().toISOString().slice(0, 10), memo: '',
  birthDate: '',
};

interface PostRegisterInfo {
  newStudentId: string;
  studentLoginId: string;
  parentLoginId: string;
  siblingCandidates: Array<{ id: string; name: string; school: string; grade: number; avatarColor: string }>;
}

function StudentFormFields({ form, setForm }: { form: StudentForm; setForm: (f: StudentForm) => void }) {
  const fieldClass = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* 이름 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">이름 *</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" className={fieldClass} />
      </div>
      {/* 학년 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">학년</label>
        <input type="number" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="3" className={fieldClass} />
      </div>
      {/* 학교명 + 학교급 (한 행 full-width) */}
      <div className="col-span-2 grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11.5px] text-[#6b7280] block mb-1">학교명</label>
          <input type="text" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="예: 한국" className={fieldClass} />
        </div>
        <div>
          <label className="text-[11.5px] text-[#6b7280] block mb-1">학교급</label>
          <select value={form.schoolLevel} onChange={(e) => setForm({ ...form, schoolLevel: e.target.value })} className={fieldClass}>
            {SCHOOL_LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
          </select>
        </div>
      </div>
      {/* 생년월일 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">생년월일</label>
        <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={fieldClass} />
      </div>
      {/* 입원일 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">입원일</label>
        <input type="date" value={form.enrollDate} onChange={(e) => setForm({ ...form, enrollDate: e.target.value })} className={fieldClass} />
      </div>
      {/* 학생 연락처 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">학생 연락처 *</label>
        <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01000000000" className={fieldClass} />
        {form.phone.includes('-') && (
          <p className="text-[10.5px] text-[#991b1b] mt-1">'-' 없이 숫자만 입력해주세요.</p>
        )}
      </div>
      {/* 보호자 이름 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">보호자 이름</label>
        <input type="text" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} placeholder="홍부모" className={fieldClass} />
      </div>
      {/* 보호자 연락처 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">보호자 연락처 *</label>
        <input type="tel" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} placeholder="01000000000" className={fieldClass} />
        {form.parentPhone.includes('-') && (
          <p className="text-[10.5px] text-[#991b1b] mt-1">'-' 없이 숫자만 입력해주세요.</p>
        )}
      </div>
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">상태</label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
          className={fieldClass}
        >
          {STATUS_OPTIONS.slice(1).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="text-[11.5px] text-[#6b7280] block mb-1">메모</label>
        <textarea
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
          rows={2}
          className={`${fieldClass} resize-none`}
          placeholder="내부 메모 (보호자 비공개)"
        />
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const { students, selectedStudentId, filterStatus, search, loading, getFilteredStudents, getStudent,
    setSelectedStudent, setFilterStatus, setSearch, addStudent, updateStudent, changeStatus,
    addSiblingLink, syncSiblings, fetchStudents } = useStudentStore();
  const { classes, fetchClasses } = useClassStore();
  const { getRecordsByStudent, fetchByStudentMonth } = useAttendanceStore();
  const { getExamsByClass, getGradesByExam, fetchExams, fetchGrades } = useGradeStore();
  const { consultations, fetchConsultations, addConsultation } = useCommunicationStore();
  const { teachers, fetchTeachers } = useTeacherStore();

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [detailTab, setDetailTab] = useState('info');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState<StudentForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<StudentForm>(EMPTY_FORM);
  const [newStatus, setNewStatus] = useState<StudentStatus>(StudentStatus.ACTIVE);
  const [postRegister, setPostRegister] = useState<PostRegisterInfo | null>(null);

  // 형제/자매 관리 모달
  const [siblingOpen, setSiblingOpen] = useState(false);
  const [siblingSearch, setSiblingSearch] = useState('');
  const [siblingChecked, setSiblingChecked] = useState<Set<string>>(new Set());

  // 상담 등록 모달
  const EMPTY_CONSULT = {
    date: new Date().toISOString().slice(0, 10),
    time: '10:00',
    duration: 30,
    type: '대면' as ConsultationType,
    teacherId: '',
    topic: '',
    content: '',
    followUp: '',
  };
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultForm, setConsultForm] = useState(EMPTY_CONSULT);
  const [consultSaving, setConsultSaving] = useState(false);

  // 비밀번호 초기화
  const [resetTarget, setResetTarget] = useState<'student' | 'parent' | null>(null);
  const [resetResult, setResetResult] = useState<{ loginId: string | null; target: 'student' | 'parent' } | null>(null);
  const [resetting, setResetting] = useState(false);

  // 상담 예정 일정
  const [scheduledConsults, setScheduledConsults] = useState<CalendarEvent[]>([]);

  // 결제 탭
  const [studentBills, setStudentBills] = useState<Bill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);

  // 출결 캘린더 팝업 (학생 목록 행 버튼)
  const [attModalStudentId, setAttModalStudentId] = useState<string | null>(null);
  const [attModalStudentName, setAttModalStudentName] = useState('');

  // 출결 탭 인라인 캘린더
  const [attYear, setAttYear] = useState(() => new Date().getFullYear());
  const [attMonth, setAttMonth] = useState(() => new Date().getMonth() + 1);

  const filtered = getFilteredStudents();
  const selected = selectedStudentId ? getStudent(selectedStudentId) : null;
  const studentClasses = selected ? classes.filter((c) => selected.classes.includes(c.id)) : [];
  const filterOptions = STATUS_OPTIONS.map((opt) => ({
    ...opt,
    count: opt.value === 'all' ? students.length : students.filter((s) => s.status === opt.value).length,
  }));

  // 학생 변경 시 출결 탭 월 초기화
  useEffect(() => {
    setAttYear(new Date().getFullYear());
    setAttMonth(new Date().getMonth() + 1);
  }, [selected?.id]);

  // 출결 탭 데이터 fetch
  const attMonthStr = `${attYear}-${String(attMonth).padStart(2, '0')}`;
  useEffect(() => {
    if (detailTab === 'attendance' && selected?.id) {
      fetchByStudentMonth(selected.id, attMonthStr);
    }
  }, [detailTab, selected?.id, attMonthStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // 성적 탭 데이터 fetch
  useEffect(() => {
    if (detailTab === 'grade' && selected) {
      studentClasses.forEach(async (cls) => {
        await fetchExams(cls.id);
        getExamsByClass(cls.id).forEach((exam) => fetchGrades(exam.id));
      });
    }
  }, [detailTab, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 상담 탭 데이터 fetch
  useEffect(() => {
    if (detailTab === 'consult' && selected?.id) {
      fetchConsultations();
      if (teachers.length === 0) fetchTeachers();
      fetch(`/api/calendar?studentId=${selected.id}`)
        .then((r) => r.json())
        .then((data: CalendarEvent[]) => setScheduledConsults(data))
        .catch(() => setScheduledConsults([]));
    }
  }, [detailTab, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 결제 탭 데이터 fetch
  useEffect(() => {
    if (detailTab === 'payment' && selected?.id) {
      setBillsLoading(true);
      fetch(`/api/finance/bills?studentId=${selected.id}`)
        .then((r) => r.json())
        .then((data: Bill[]) => setStudentBills(data))
        .catch(() => toast('결제 정보를 불러오는 데 실패했습니다.', 'error'))
        .finally(() => setBillsLoading(false));
    }
  }, [detailTab, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 출결 탭 계산
  const attRecords = selected ? getRecordsByStudent(selected.id, attMonthStr) : [];
  const attRecordMap: Record<string, AttendanceStatus> = {};
  attRecords.forEach((r) => { attRecordMap[r.date] = r.status; });
  const attDaysInMonth = new Date(attYear, attMonth, 0).getDate();
  const attFirstDay = new Date(attYear, attMonth - 1, 1).getDay();
  const attPresentDays = attRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const attTotalDays = attRecords.length;
  const attRate = attTotalDays > 0 ? Math.round((attPresentDays / attTotalDays) * 100) : 0;

  const attCells: (number | null)[] = [
    ...Array.from({ length: attFirstDay }, () => null),
    ...Array.from({ length: attDaysInMonth }, (_, i) => i + 1),
  ];
  while (attCells.length < 42) attCells.push(null);
  const attWeeks: (number | null)[][] = Array.from({ length: 6 }, (_, i) => attCells.slice(i * 7, (i + 1) * 7));

  // 성적 탭 계산
  const gradeRows = studentClasses.flatMap((cls) =>
    getExamsByClass(cls.id).map((exam) => {
      const grades = getGradesByExam(exam.id);
      const myGrade = selected ? grades.find((g) => g.studentId === selected.id) : null;
      return { cls, exam, myGrade: myGrade ?? null };
    })
  ).sort((a, b) => b.exam.date.localeCompare(a.exam.date));

  // 상담 탭 계산
  const studentConsults = selected
    ? [...consultations.filter((c) => c.studentId === selected.id)].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  // 상담 등록 핸들러
  const handleAddConsult = async () => {
    if (!selected) return;
    if (!consultForm.topic.trim()) { toast('상담 주제를 입력하세요.', 'error'); return; }
    if (!consultForm.content.trim()) { toast('상담 내용을 입력하세요.', 'error'); return; }
    if (!consultForm.teacherId) { toast('담당 강사를 선택하세요.', 'error'); return; }
    const teacher = teachers.find((t) => t.id === consultForm.teacherId);
    setConsultSaving(true);
    await addConsultation({
      studentId: selected.id,
      studentName: selected.name,
      parentName: selected.parentName,
      teacherId: consultForm.teacherId,
      teacherName: teacher?.name ?? '',
      date: consultForm.date,
      time: consultForm.time,
      duration: consultForm.duration,
      type: consultForm.type,
      topic: consultForm.topic,
      content: consultForm.content,
      followUp: consultForm.followUp,
    });
    setConsultSaving(false);
    setConsultOpen(false);
    setConsultForm(EMPTY_CONSULT);
  };

  // 형제/자매 모달
  const openSiblingModal = () => {
    if (!selected) return;
    const samePhone = students
      .filter((s) => s.id !== selected.id && s.parentPhone && s.parentPhone === selected.parentPhone)
      .map((s) => s.id);
    const initial = new Set([...selected.siblingIds, ...samePhone]);
    setSiblingChecked(initial);
    setSiblingSearch('');
    setSiblingOpen(true);
  };

  const toggleSiblingCheck = (id: string) => {
    setSiblingChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSiblingsSave = async () => {
    if (!selected) return;
    await syncSiblings(selected.id, [...siblingChecked]);
    setSiblingOpen(false);
    toast('형제/자매 정보가 저장되었습니다.', 'success');
  };

  const removeSibling = async (siblingId: string) => {
    if (!selected) return;
    await syncSiblings(selected.id, selected.siblingIds.filter((id) => id !== siblingId));
  };

  const siblingCandidateList = selected
    ? students.filter((s) => {
        if (s.id === selected.id) return false;
        if (!siblingSearch) return true;
        return s.name.includes(siblingSearch) || s.school.includes(siblingSearch);
      })
    : [];

  const samePhoneIds = selected
    ? new Set(students.filter((s) => s.id !== selected.id && s.parentPhone && s.parentPhone === selected.parentPhone).map((s) => s.id))
    : new Set<string>();

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.phone || !registerForm.parentPhone) {
      toast('필수 항목을 입력해주세요.', 'error'); return;
    }
    if (registerForm.phone.includes('-') || registerForm.parentPhone.includes('-')) {
      toast("전화번호는 '-' 없이 숫자만 입력해주세요.", 'error'); return;
    }

    const year = new Date().getFullYear();
    const yearCount = students.filter((s) => s.attendanceNumber.startsWith(String(year))).length;
    const attendanceNumber = `${year}${String(yearCount + 1).padStart(3, '0')}`;

    const siblingCandidates = students
      .filter((s) => s.parentPhone && s.parentPhone === registerForm.parentPhone)
      .map(({ id, name, school, grade, avatarColor }) => ({ id, name, school, grade, avatarColor }));

    try {
      const { studentLoginId } = await addStudent({
        ...registerForm,
        school: `${registerForm.school.trim()}${registerForm.schoolLevel}`,
        grade: Number(registerForm.grade),
        classes: [],
        siblingIds: [],
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        attendanceNumber,
        birthDate: registerForm.birthDate || undefined,
      });

      const newStudents = useStudentStore.getState().students;
      const newStudentId = newStudents[newStudents.length - 1].id;

      setRegisterOpen(false);
      setRegisterForm(EMPTY_FORM);
      setPostRegister({
        newStudentId,
        studentLoginId: studentLoginId ?? attendanceNumber,
        parentLoginId: registerForm.parentPhone,
        siblingCandidates,
      });
    } catch {
      // 에러는 store에서 toast 처리
    }
  };

  const handleSiblingLink = () => {
    if (!postRegister) return;
    postRegister.siblingCandidates.forEach((sibling) => {
      addSiblingLink(postRegister.newStudentId, sibling.id);
    });
    setPostRegister(null);
    toast('형제/자매 연결이 완료되었습니다.', 'success');
  };

  const handleEdit = () => {
    if (!selected) return;
    if (editForm.phone.includes('-') || editForm.parentPhone.includes('-')) {
      toast("전화번호는 '-' 없이 숫자만 입력해주세요.", 'error'); return;
    }
    updateStudent(selected.id, {
      ...editForm,
      school: `${editForm.school.trim()}${editForm.schoolLevel}`,
      grade: Number(editForm.grade),
      birthDate: editForm.birthDate || undefined,
    });
    toast('학생 정보가 수정되었습니다.');
    setEditOpen(false);
  };

  const openEdit = () => {
    if (!selected) return;
    const { school, schoolLevel } = parseSchool(selected.school);
    setEditForm({
      name: selected.name, school, schoolLevel, grade: String(selected.grade),
      phone: selected.phone, parentName: selected.parentName, parentPhone: selected.parentPhone,
      status: selected.status, enrollDate: selected.enrollDate, memo: selected.memo,
      birthDate: selected.birthDate ?? '',
    });
    setEditOpen(true);
  };

  const handleStatusChange = () => {
    if (!selected) return;
    changeStatus(selected.id, newStatus);
    toast(`${selected.name} 학생 상태가 '${newStatus}'로 변경되었습니다.`);
    setStatusOpen(false);
  };

  const handlePasswordReset = async (target: 'student' | 'parent') => {
    if (!selected) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/students/${selected.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? '비밀번호 초기화에 실패했습니다.', 'error');
        return;
      }
      setResetTarget(null);
      setResetResult({ loginId: data.loginId, target });
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="학생 등록/정보 관리"
        badge={`총 ${students.filter(s => s.status === StudentStatus.ACTIVE).length}명 재원`}
        actions={
          <Button variant="dark" size="sm" onClick={() => setRegisterOpen(true)}>
            <Plus size={13} /> 학생 등록
          </Button>
        }
      />

      {loading ? <LoadingSpinner /> : <div className="flex flex-1 overflow-hidden">
        {/* 좌측 학생 목록 */}
        <div className="w-64 shrink-0 flex flex-col border-r border-[#e2e8f0] bg-white overflow-hidden">
          <div className="p-3 border-b border-[#e2e8f0] space-y-2">
            <SearchInput value={search} onChange={setSearch} placeholder="이름, 학교 검색" className="w-full" />
            <FilterTags options={filterOptions} value={filterStatus} onChange={(v) => setFilterStatus(v as StudentStatus | 'all')} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-[#9ca3af]">검색 결과가 없습니다</div>
            ) : filtered.map((student) => (
              <div
                key={student.id}
                className={clsx(
                  'flex items-center gap-1 pr-2 border-b border-[#f1f5f9] transition-colors',
                  selectedStudentId === student.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                )}
              >
                {/* 학생 선택 영역 */}
                <button
                  onClick={() => { setSelectedStudent(student.id); setDetailTab('info'); }}
                  className="flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 text-left cursor-pointer"
                >
                  <Avatar name={student.name} color={student.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[13px] font-medium text-[#111827] truncate">{student.name}</span>
                      <Badge label={student.status} />
                    </div>
                    <div className="text-[11px] text-[#6b7280] mt-0.5">{student.school} · {student.grade}학년</div>
                  </div>
                </button>
                {/* 출결 현황 버튼 */}
                <button
                  onClick={() => { setAttModalStudentId(student.id); setAttModalStudentName(student.name); }}
                  className="shrink-0 p-1.5 text-[#9ca3af] hover:text-[#4fc3a1] hover:bg-[#E1F5EE] rounded-[6px] cursor-pointer"
                  title="출결 현황"
                >
                  <CalendarDays size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 우측 상세 */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f6f8]">
            <div className="bg-white border-b border-[#e2e8f0] px-5 py-4">
              <div className="flex items-center gap-4">
                <Avatar name={selected.name} color={selected.avatarColor} size="lg" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[17px] font-bold text-[#111827]">{selected.name}</span>
                    <Badge label={selected.status} />
                    <span className="text-[12px] text-[#9ca3af]">출결번호: {selected.attendanceNumber}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[12px] text-[#6b7280]">
                    <span className="flex items-center gap-1"><School size={12} />{selected.school} {selected.grade}학년</span>
                    <span className="flex items-center gap-1"><Phone size={12} />{formatPhone(selected.phone)}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} />입원 {formatKoreanDate(selected.enrollDate)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setResetTarget('student')}>
                    <RefreshCw size={13} /> 비밀번호 초기화
                  </Button>
                  <Button variant="default" size="sm" onClick={openEdit}>정보 수정</Button>
                  <Button variant="dark" size="sm" onClick={() => { setNewStatus(selected.status); setStatusOpen(true); }}>상태 변경</Button>
                </div>
              </div>
            </div>

            <Tabs tabs={DETAIL_TABS} value={detailTab} onChange={setDetailTab} className="bg-white px-5" />

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {detailTab === 'info' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                    <div className="text-[12.5px] font-semibold text-[#111827] mb-3">인적사항</div>
                    <dl className="space-y-2">
                      {[
                        ['이름', selected.name],
                        ['학교', `${selected.school} ${selected.grade}학년`],
                        ['학생 연락처', formatPhone(selected.phone)],
                        ['보호자', selected.parentName],
                        ['보호자 연락처', formatPhone(selected.parentPhone)],
                        ['입원일', formatKoreanDate(selected.enrollDate)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex">
                          <dt className="w-28 text-[12px] text-[#6b7280] shrink-0">{label}</dt>
                          <dd className="text-[12.5px] text-[#111827]">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="space-y-4">
                    {/* 형제/자매 카드 */}
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[12.5px] font-semibold text-[#111827] flex items-center gap-1">
                          <Users size={13} /> 형제/자매
                        </div>
                        <button
                          onClick={openSiblingModal}
                          className="flex items-center gap-1 text-[11.5px] text-[#4fc3a1] hover:text-[#3aab8a] font-medium cursor-pointer"
                        >
                          <Plus size={12} /> 추가/수정
                        </button>
                      </div>
                      {selected.siblingIds.length === 0 ? (
                        <p className="text-[12px] text-[#9ca3af]">등록된 형제/자매 없음</p>
                      ) : (
                        <div className="space-y-1.5">
                          {selected.siblingIds.map((id) => {
                            const sibling = students.find((s) => s.id === id);
                            return sibling ? (
                              <div key={id} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-[12px]">
                                  <Avatar name={sibling.name} color={sibling.avatarColor} size="sm" />
                                  <span className="text-[#111827]">{sibling.name}</span>
                                  <span className="text-[#9ca3af]">({sibling.school} {sibling.grade}학년)</span>
                                </div>
                                <button
                                  onClick={() => removeSibling(id)}
                                  className="text-[#9ca3af] hover:text-[#ef4444] cursor-pointer shrink-0"
                                  title="형제/자매 해제"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                      <div className="text-[12.5px] font-semibold text-[#111827] mb-2 flex items-center gap-1">
                        <StickyNote size={13} /> 내부 메모 <span className="text-[10px] font-normal text-[#9ca3af]">(보호자 비공개)</span>
                      </div>
                      <textarea
                        defaultValue={selected.memo}
                        rows={4}
                        className="w-full text-[12px] border border-[#e2e8f0] rounded-[8px] p-2 resize-none focus:outline-none focus:border-[#4fc3a1] text-[#374151]"
                        placeholder="메모를 입력하세요..."
                        onBlur={(e) => updateStudent(selected.id, { memo: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'class' && (
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">수강 중인 반</div>
                  {studentClasses.length === 0 ? (
                    <p className="text-[12px] text-[#9ca3af]">배정된 반 없음</p>
                  ) : (
                    <div className="space-y-2">
                      {studentClasses.map((cls) => (
                        <div key={cls.id} className="flex items-center justify-between p-3 bg-[#f4f6f8] rounded-[8px]">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                              <span className="text-[13px] font-medium text-[#111827]">{cls.name}</span>
                            </div>
                            <div className="text-[11.5px] text-[#6b7280] mt-0.5 ml-4">
                              {cls.teacherName} · {cls.schedule.map(s => `${['','월','화','수','목','금','토','일'][s.dayOfWeek]}${s.startTime}`).join(', ')}
                            </div>
                          </div>
                          <span className="text-[12px] text-[#6b7280]">{cls.fee.toLocaleString()}원/월</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 출결 탭 — 인라인 캘린더 */}
              {detailTab === 'attendance' && (
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  {/* 통계 카드 */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      { label: '출석', value: `${attPresentDays}일`, color: '#065f46' },
                      { label: '결석', value: `${attRecords.filter(r => r.status === AttendanceStatus.ABSENT).length}일`, color: '#991B1B' },
                      { label: '지각', value: `${attRecords.filter(r => r.status === AttendanceStatus.LATE).length}일`, color: '#92400E' },
                      { label: '출석률', value: `${attRate}%`, color: '#0D9E7A' },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-[#f4f6f8] rounded-[8px] p-3 text-center">
                        <div className="text-[16px] font-bold" style={{ color: stat.color }}>{stat.value}</div>
                        <div className="text-[11.5px] text-[#6b7280] mt-0.5">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* 월 선택 */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => { if (attMonth === 1) { setAttMonth(12); setAttYear(y => y - 1); } else setAttMonth(m => m - 1); }} className="p-1 hover:bg-[#f1f5f9] rounded cursor-pointer"><ChevronLeft size={16} /></button>
                    <span className="text-[14px] font-semibold text-[#111827]">{attYear}년 {attMonth}월</span>
                    <button onClick={() => { if (attMonth === 12) { setAttMonth(1); setAttYear(y => y + 1); } else setAttMonth(m => m + 1); }} className="p-1 hover:bg-[#f1f5f9] rounded cursor-pointer"><ChevronRight size={16} /></button>
                  </div>
                  {/* 요일 헤더 */}
                  <div className="grid grid-cols-7 mb-1">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                      <div key={d} className="text-center text-[11.5px] text-[#9ca3af] py-0.5">{d}</div>
                    ))}
                  </div>
                  {/* 날짜 셀 */}
                  <div className="flex flex-col gap-1">
                    {attWeeks.map((week, wi) => (
                      <div key={wi} className="grid grid-cols-7 gap-1">
                        {week.map((day, di) => {
                          if (day === null) return <div key={di} className="h-10" />;
                          const dateStr = `${attYear}-${String(attMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const status = attRecordMap[dateStr];
                          return (
                            <div key={di} className="h-10 flex flex-col items-center justify-center rounded-[6px] border border-[#f1f5f9] bg-white hover:bg-[#f9fafb]">
                              <span className="text-[12px] text-[#374151] font-semibold leading-none">{day}</span>
                              {status && (
                                <span className={clsx('text-[9px] font-bold px-1 py-0.5 rounded-full mt-1', ATT_STATUS_COLORS[status])}>
                                  {ATT_STATUS_SHORT[status]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {/* 범례 */}
                  <div className="flex gap-4 mt-3 pt-3 border-t border-[#f1f5f9]">
                    {Object.entries(ATT_STATUS_SHORT).map(([s, short]) => (
                      <div key={s} className="flex items-center gap-1">
                        <span className={clsx('w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center', ATT_STATUS_COLORS[s])}>{short}</span>
                        <span className="text-[11.5px] text-[#6b7280]">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 성적 탭 */}
              {detailTab === 'grade' && (
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#e2e8f0]">
                    <span className="text-[12.5px] font-semibold text-[#111827]">시험 성적 내역</span>
                  </div>
                  {gradeRows.length === 0 ? (
                    <div className="p-8 text-center text-[12px] text-[#9ca3af]">시험 기록이 없습니다.</div>
                  ) : (
                    <table className="w-full text-[12.5px]">
                      <thead className="bg-[#f4f6f8]">
                        <tr>
                          {['반', '시험명', '날짜', '점수', '만점', '비고'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-[11.5px] text-[#6b7280] font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f5f9]">
                        {gradeRows.map(({ cls, exam, myGrade }) => (
                          <tr key={exam.id} className="hover:bg-[#f9fafb]">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                                <span className="text-[#111827]">{cls.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-[#111827] font-medium">{exam.name}</td>
                            <td className="px-4 py-2.5 text-[#6b7280]">{formatKoreanDate(exam.date)}</td>
                            <td className="px-4 py-2.5">
                              {myGrade?.score != null ? (
                                <span className="font-bold text-[#111827]">{myGrade.score}</span>
                              ) : (
                                <span className="text-[#9ca3af]">미기록</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[#6b7280]">{exam.totalScore}</td>
                            <td className="px-4 py-2.5 text-[#9ca3af]">{myGrade?.memo || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* 결제 탭 */}
              {detailTab === 'payment' && (() => {
                const totalAmount = studentBills.reduce((s, b) => s + b.amount, 0);
                const paidAmount = studentBills.reduce((s, b) => s + b.paidAmount, 0);
                const unpaidAmount = totalAmount - paidAmount;
                const unpaidBills = studentBills.filter((b) => b.status !== '완납');
                return (
                  <div className="space-y-4">
                    {/* 요약 카드 */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                        <div className="text-[11px] text-[#9ca3af] mb-1">총 청구액</div>
                        <div className="text-[15px] font-bold text-[#111827]">{totalAmount.toLocaleString()}원</div>
                        <div className="text-[11px] text-[#9ca3af] mt-1">{studentBills.length}건</div>
                      </div>
                      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                        <div className="text-[11px] text-[#9ca3af] mb-1">수납 완료</div>
                        <div className="text-[15px] font-bold text-[#4fc3a1]">{paidAmount.toLocaleString()}원</div>
                        <div className="text-[11px] text-[#9ca3af] mt-1">{studentBills.filter((b) => b.status === '완납').length}건</div>
                      </div>
                      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                        <div className="text-[11px] text-[#9ca3af] mb-1">미납 잔액</div>
                        <div className={`text-[15px] font-bold ${unpaidAmount > 0 ? 'text-[#ef4444]' : 'text-[#9ca3af]'}`}>{unpaidAmount.toLocaleString()}원</div>
                        <div className="text-[11px] text-[#9ca3af] mt-1">{unpaidBills.length}건</div>
                      </div>
                    </div>

                    {/* 수납 필요 항목 */}
                    {unpaidBills.length > 0 && (
                      <div className="bg-[#FFF7ED] rounded-[10px] border border-[#fed7aa] p-4">
                        <div className="text-[12px] font-semibold text-[#92400E] mb-2">수납 필요 항목 ({unpaidBills.length}건)</div>
                        <div className="space-y-1.5">
                          {unpaidBills.map((bill) => (
                            <div key={bill.id} className="flex items-center justify-between text-[12px]">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${BILL_STATUS_BADGE[bill.status] ?? ''}`}>{bill.status}</span>
                                <span className="text-[#92400E]">{bill.month} · {bill.className}</span>
                              </div>
                              <span className="font-semibold text-[#92400E]">
                                {(bill.amount - bill.paidAmount).toLocaleString()}원 미납
                                {bill.dueDate && <span className="font-normal text-[#b45309] ml-1.5">(납부기한 {bill.dueDate})</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 수납 이력 테이블 */}
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-[#111827]">수납 이력</span>
                        <span className="text-[11.5px] text-[#9ca3af]">총 {studentBills.length}건</span>
                      </div>
                      {billsLoading ? (
                        <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                      ) : studentBills.length === 0 ? (
                        <div className="p-8 text-center text-[12px] text-[#9ca3af]">청구 내역이 없습니다.</div>
                      ) : (
                        <table className="w-full text-[12.5px]">
                          <thead className="bg-[#f8fafc]">
                            <tr>
                              {['월', '반', '청구금액', '납부금액', '납부방법', '상태', '납부일'].map((h) => (
                                <th key={h} className={`px-4 py-2.5 text-[11.5px] text-[#6b7280] font-medium ${['청구금액', '납부금액'].includes(h) ? 'text-right' : h === '납부방법' || h === '상태' ? 'text-center' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f5f9]">
                            {studentBills.map((bill) => (
                              <tr key={bill.id} className="hover:bg-[#f9fafb]">
                                <td className="px-4 py-2.5 font-medium text-[#111827]">{bill.month}</td>
                                <td className="px-4 py-2.5 text-[#374151]">{bill.className}</td>
                                <td className="px-4 py-2.5 text-right text-[#374151]">{bill.amount.toLocaleString()}원</td>
                                <td className="px-4 py-2.5 text-right text-[#374151]">{bill.paidAmount.toLocaleString()}원</td>
                                <td className="px-4 py-2.5 text-center text-[#6b7280]">{bill.method ?? '—'}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${BILL_STATUS_BADGE[bill.status] ?? 'bg-[#f3f4f6] text-[#374151]'}`}>
                                    {bill.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-[#6b7280]">{bill.paidDate ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 리포트 탭 */}
              {detailTab === 'report' && (
                <StudentReportTab studentId={selected.id} />
              )}

              {/* 상담 탭 */}
              {detailTab === 'consult' && (
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[12.5px] font-semibold text-[#111827]">상담 기록</span>
                      <span className="text-[11.5px] text-[#9ca3af]">총 {studentConsults.length}건</span>
                    </div>
                    <Button variant="dark" size="sm" onClick={() => { setConsultForm(EMPTY_CONSULT); setConsultOpen(true); }}>
                      + 상담 등록
                    </Button>
                  </div>
                  {/* 캘린더에서 등록된 예정 상담 (완료된 기록이 없는 날짜만) */}
                  {scheduledConsults.filter((ev) => !studentConsults.some((c) => c.date === ev.date)).length > 0 && (
                    <div className="border-b border-[#e2e8f0]">
                      <div className="divide-y divide-[#f1f5f9]">
                        {scheduledConsults.filter((ev) => !studentConsults.some((c) => c.date === ev.date)).map((ev) => (
                          <div
                            key={ev.id}
                            className="px-4 py-3 hover:bg-[#f9fafb] cursor-pointer flex items-center justify-between group"
                            onClick={() => {
                              setConsultForm({
                                ...EMPTY_CONSULT,
                                date: ev.date,
                                time: ev.startTime ?? '10:00',
                                topic: ev.title,
                              });
                              setConsultOpen(true);
                            }}
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#6366f1]">예정</span>
                                <span className="text-[11.5px] text-[#6b7280]">{formatKoreanDate(ev.date)}</span>
                                {ev.startTime && <span className="text-[11.5px] text-[#9ca3af]">{ev.startTime}</span>}
                              </div>
                              <div className="text-[12.5px] font-medium text-[#111827]">{ev.title}</div>
                              {ev.description && <div className="text-[12px] text-[#9ca3af] mt-0.5">{ev.description}</div>}
                            </div>
                            <span className="text-[11px] text-[#4fc3a1] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">기록 작성 →</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 완료된 상담 기록 */}
                  {studentConsults.length === 0 ? (
                    <div className="p-8 text-center text-[12px] text-[#9ca3af]">상담 기록이 없습니다.</div>
                  ) : (
                    <div className="divide-y divide-[#f1f5f9]">
                      {studentConsults.map((c) => {
                        const typeStyle = CONSULT_TYPE_STYLE[c.type] ?? { bg: '#f3f4f6', text: '#374151' };
                        return (
                          <div key={c.id} className="px-4 py-3 hover:bg-[#f9fafb]">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
                              >
                                {c.type}
                              </span>
                              <span className="text-[11.5px] text-[#6b7280]">{formatKoreanDate(c.date)}</span>
                              {c.teacherName && <span className="text-[11.5px] text-[#9ca3af]">· {c.teacherName}</span>}
                            </div>
                            <div className="text-[12.5px] font-medium text-[#111827] mb-0.5">{c.topic}</div>
                            {c.content && <div className="text-[12px] text-[#6b7280] line-clamp-2">{c.content}</div>}
                            {c.followUp && (
                              <div className="mt-1 text-[11.5px] text-[#9ca3af]">
                                <span className="font-medium text-[#6b7280]">목표/건의</span> · {c.followUp}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
            <p className="text-[13px] text-[#9ca3af]">좌측에서 학생을 선택하세요</p>
          </div>
        )}
      </div>}

      {/* 출결 현황 팝업 */}
      <AttendanceCalendarModal
        open={!!attModalStudentId}
        onClose={() => setAttModalStudentId(null)}
        studentId={attModalStudentId ?? ''}
        studentName={attModalStudentName}
      />

      {/* 학생 등록 모달 */}
      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="학생 등록"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setRegisterOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleRegister}>등록</Button>
          </>
        }
      >
        <StudentFormFields form={registerForm} setForm={setRegisterForm} />
      </Modal>

      {/* 정보 수정 모달 */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="학생 정보 수정"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setEditOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleEdit}>저장</Button>
          </>
        }
      >
        <StudentFormFields form={editForm} setForm={setEditForm} />
      </Modal>

      {/* 상담 등록 모달 */}
      <Modal
        open={consultOpen}
        onClose={() => setConsultOpen(false)}
        title="상담 등록"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setConsultOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAddConsult} disabled={consultSaving}>
              {consultSaving ? '저장 중...' : '등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 날짜 / 시간 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11.5px] font-medium text-[#374151] mb-1">날짜</label>
              <input
                type="date"
                value={consultForm.date}
                onChange={(e) => setConsultForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11.5px] font-medium text-[#374151] mb-1">시간</label>
              <input
                type="time"
                value={consultForm.time}
                onChange={(e) => setConsultForm((f) => ({ ...f, time: e.target.value }))}
                className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
              />
            </div>
          </div>

          {/* 유형 / 소요시간 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11.5px] font-medium text-[#374151] mb-1">상담 유형</label>
              <select
                value={consultForm.type}
                onChange={(e) => setConsultForm((f) => ({ ...f, type: e.target.value as ConsultationType }))}
                className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
              >
                <option value="대면">대면</option>
                <option value="전화">전화</option>
                <option value="온라인">온라인</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[11.5px] font-medium text-[#374151] mb-1">소요시간 (분)</label>
              <input
                type="number"
                min={5}
                step={5}
                value={consultForm.duration}
                onChange={(e) => setConsultForm((f) => ({ ...f, duration: Number(e.target.value) }))}
                className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
              />
            </div>
          </div>

          {/* 담당 강사 */}
          <div>
            <label className="block text-[11.5px] font-medium text-[#374151] mb-1">담당 강사</label>
            <select
              value={consultForm.teacherId}
              onChange={(e) => setConsultForm((f) => ({ ...f, teacherId: e.target.value }))}
              className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
            >
              <option value="">강사 선택</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* 상담 주제 */}
          <div>
            <label className="block text-[11.5px] font-medium text-[#374151] mb-1">상담 주제 <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder="예) 수학 성적 하락 관련"
              value={consultForm.topic}
              onChange={(e) => setConsultForm((f) => ({ ...f, topic: e.target.value }))}
              className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:border-[#4fc3a1]"
            />
          </div>

          {/* 상담 내용 */}
          <div>
            <label className="block text-[11.5px] font-medium text-[#374151] mb-1">상담 내용 <span className="text-red-400">*</span></label>
            <textarea
              rows={4}
              placeholder="상담에서 나눈 주요 내용을 기록하세요."
              value={consultForm.content}
              onChange={(e) => setConsultForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:border-[#4fc3a1] resize-none"
            />
          </div>

          {/* 목표 및 건의사항 */}
          <div>
            <label className="block text-[11.5px] font-medium text-[#374151] mb-1">목표 및 건의사항</label>
            <textarea
              rows={3}
              placeholder="상담 후 설정한 목표, 학부모 건의사항 등을 입력하세요."
              value={consultForm.followUp}
              onChange={(e) => setConsultForm((f) => ({ ...f, followUp: e.target.value }))}
              className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:border-[#4fc3a1] resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* 상태 변경 모달 */}
      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="학생 상태 변경"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setStatusOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleStatusChange}>변경</Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-[12.5px] text-[#6b7280] mb-3">{selected?.name} 학생의 상태를 변경합니다.</p>
          {STATUS_OPTIONS.slice(1).map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 p-3 rounded-[8px] border cursor-pointer hover:bg-[#f4f6f8]" style={{ borderColor: newStatus === opt.value ? '#4fc3a1' : '#e2e8f0', backgroundColor: newStatus === opt.value ? '#E1F5EE' : '' }}>
              <input type="radio" value={opt.value} checked={newStatus === opt.value} onChange={() => setNewStatus(opt.value as StudentStatus)} className="accent-[#4fc3a1]" />
              <span className="text-[13px] font-medium text-[#111827]">{opt.label}</span>
            </label>
          ))}
        </div>
      </Modal>

      {/* 형제/자매 관리 모달 */}
      <Modal
        open={siblingOpen}
        onClose={() => setSiblingOpen(false)}
        title="형제/자매 관리"
        size="md"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setSiblingOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleSiblingsSave}>저장</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12px] text-[#6b7280]">
            형제/자매로 연결할 학생을 선택하세요. 같은 보호자 번호의 학생은 자동으로 추천됩니다.
          </p>
          <input
            type="text"
            value={siblingSearch}
            onChange={(e) => setSiblingSearch(e.target.value)}
            placeholder="이름, 학교로 검색"
            className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]"
          />
          <div className="max-h-64 overflow-y-auto space-y-1 border border-[#e2e8f0] rounded-[8px] p-1">
            {siblingCandidateList.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-4">검색 결과가 없습니다</p>
            ) : siblingCandidateList.map((s) => {
              const isSamePhone = samePhoneIds.has(s.id);
              const isChecked = siblingChecked.has(s.id);
              return (
                <label
                  key={s.id}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-[6px] cursor-pointer hover:bg-[#f4f6f8]',
                    isChecked && 'bg-[#E1F5EE]',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSiblingCheck(s.id)}
                    className="accent-[#4fc3a1] shrink-0"
                  />
                  <Avatar name={s.name} color={s.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-[#111827]">{s.name}</span>
                      {isSamePhone && (
                        <span className="text-[10px] bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded-full font-medium">
                          보호자 번호 일치
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#6b7280]">{s.school} · {s.grade}학년</div>
                  </div>
                </label>
              );
            })}
          </div>
          {siblingChecked.size > 0 && (
            <p className="text-[11.5px] text-[#4fc3a1] font-medium">{siblingChecked.size}명 선택됨</p>
          )}
        </div>
      </Modal>

      {/* 비밀번호 초기화 확인 모달 */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="비밀번호 초기화"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setResetTarget(null)} disabled={resetting}>취소</Button>
            <Button variant="danger" size="md" onClick={() => handlePasswordReset(resetTarget!)} disabled={resetting}>
              {resetting ? '초기화 중...' : '초기화'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-[#374151]">
            <span className="font-semibold">{selected?.name}</span> 학생의 비밀번호를 초기화하시겠습니까?
          </p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3 p-3 rounded-[8px] border cursor-pointer hover:bg-[#f4f6f8]" style={{ borderColor: resetTarget === 'student' ? '#4fc3a1' : '#e2e8f0', backgroundColor: resetTarget === 'student' ? '#E1F5EE' : '' }}>
              <input type="radio" checked={resetTarget === 'student'} onChange={() => setResetTarget('student')} className="accent-[#4fc3a1]" />
              <span className="text-[12.5px] text-[#111827]">학생 비밀번호</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-[8px] border cursor-pointer hover:bg-[#f4f6f8]" style={{ borderColor: resetTarget === 'parent' ? '#4fc3a1' : '#e2e8f0', backgroundColor: resetTarget === 'parent' ? '#E1F5EE' : '' }}>
              <input type="radio" checked={resetTarget === 'parent'} onChange={() => setResetTarget('parent')} className="accent-[#4fc3a1]" />
              <span className="text-[12.5px] text-[#111827]">학부모 비밀번호</span>
            </label>
          </div>
          <p className="text-[11px] text-[#9ca3af]">초기화 후 새 임시 비밀번호가 발급됩니다. 반드시 학생/학부모에게 전달해주세요.</p>
        </div>
      </Modal>

      {/* 비밀번호 초기화 결과 모달 */}
      <Modal
        open={!!resetResult}
        onClose={() => setResetResult(null)}
        title="비밀번호 초기화 완료"
        size="sm"
        footer={<Button variant="dark" size="md" onClick={() => setResetResult(null)}>확인</Button>}
      >
        <div className="space-y-3">
          <div className="bg-[#f4f6f8] rounded-[10px] p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#111827] mb-1">
              <KeyRound size={13} /> {resetResult?.target === 'parent' ? '학부모' : '학생'} 계정
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-28 text-[#6b7280] shrink-0">로그인 ID</span>
              <span className="font-mono font-medium text-[#111827]">{resetResult?.loginId}</span>
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-28 text-[#6b7280] shrink-0">새 임시 비밀번호</span>
              <span className="text-[#4fc3a1] font-medium">연락처로 SMS 발송됨</span>
            </div>
          </div>
          <p className="text-[11px] text-[#9ca3af]">임시 비밀번호가 등록된 연락처로 SMS 발송되었습니다.</p>
        </div>
      </Modal>

      {/* 등록 완료 모달: 계정 안내 + 형제/자매 감지 */}
      <Modal
        open={!!postRegister}
        onClose={() => setPostRegister(null)}
        title="학생 등록 완료"
        size="sm"
        footer={
          postRegister?.siblingCandidates.length ? (
            <>
              <Button variant="default" size="md" onClick={() => setPostRegister(null)}>건너뛰기</Button>
              <Button variant="dark" size="md" onClick={handleSiblingLink}>형제/자매 연결</Button>
            </>
          ) : (
            <Button variant="dark" size="md" onClick={() => setPostRegister(null)}>확인</Button>
          )
        }
      >
        <div className="space-y-4">
          <div className="bg-[#f4f6f8] rounded-[10px] p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#111827] mb-1">
              <KeyRound size={13} /> 학생 앱 계정
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-24 text-[#6b7280] shrink-0">로그인 ID</span>
              <span className="font-mono font-medium text-[#111827]">{postRegister?.studentLoginId} (출석번호)</span>
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-24 text-[#6b7280] shrink-0">임시 비밀번호</span>
              <span className="text-[#4fc3a1] font-medium">학생 연락처로 SMS 발송됨</span>
            </div>
          </div>
          <div className="bg-[#f4f6f8] rounded-[10px] p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#111827] mb-1">
              <KeyRound size={13} /> 학부모 앱 계정
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-24 text-[#6b7280] shrink-0">로그인 ID</span>
              <span className="font-mono font-medium text-[#111827]">{postRegister?.parentLoginId} (전화번호)</span>
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-24 text-[#6b7280] shrink-0">임시 비밀번호</span>
              <span className="text-[#4fc3a1] font-medium">보호자 연락처로 SMS 발송됨</span>
            </div>
          </div>
          <p className="text-[11px] text-[#9ca3af]">임시 비밀번호가 각 연락처로 SMS 발송되었습니다.</p>
          {postRegister?.siblingCandidates.length ? (
            <div className="border border-[#fcd34d] bg-[#fffbeb] rounded-[8px] p-4">
              <div className="text-[12.5px] font-semibold text-[#92400e] mb-2">형제/자매 감지</div>
              <p className="text-[12px] text-[#78350f] mb-3">같은 보호자 번호를 사용하는 학생이 있습니다. 형제/자매로 연결할까요?</p>
              <div className="space-y-2">
                {postRegister.siblingCandidates.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-[12px] text-[#111827]">
                    <Avatar name={s.name} color={s.avatarColor} size="sm" />
                    <span>{s.name}</span>
                    <span className="text-[#6b7280]">({s.school} {s.grade}학년)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
