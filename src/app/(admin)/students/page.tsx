'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import Badge from '@/components/shared/Badge';
import SearchInput from '@/components/shared/SearchInput';
import FilterTags from '@/components/shared/FilterTags';
import Tabs from '@/components/shared/Tabs';
import Modal from '@/components/shared/Modal';
import AttendanceCalendarModal from '@/components/admin/AttendanceCalendarModal';
import StudentReportTab from '@/components/admin/StudentReportTab';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useClassStore } from '@/lib/stores/classStore';
import { StudentStatus } from '@/lib/types/student';
import { formatKoreanDate, formatPhone } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Phone, School, Calendar, KeyRound, CalendarDays, RefreshCw, History } from 'lucide-react';
import clsx from 'clsx';
import {
  STATUS_OPTIONS, DETAIL_TABS, AVATAR_COLORS,
  type StudentForm, parseSchool, EMPTY_FORM, type PostRegisterInfo, StudentFormFields,
} from './_shared';
import InfoTab from './_tabs/InfoTab';
import ClassTab from './_tabs/ClassTab';
import AttendanceTab from './_tabs/AttendanceTab';
import GradeTab from './_tabs/GradeTab';
import PaymentTab from './_tabs/PaymentTab';
import ConsultTab from './_tabs/ConsultTab';

export default function StudentsPage() {
  const {
    students, selectedStudentId, selectedStudent, filterStatus, search, loading, detailLoading,
    getFilteredStudents,
    setSelectedStudent, setFilterStatus, setSearch, addStudent, updateStudent, changeStatus,
    syncSiblings, fetchStudents,
  } = useStudentStore();
  const { fetchClasses } = useClassStore();

  // 학원 SMS 설정 — 등록 폼/완료 모달 분기에 사용
  const [smsEnabled, setSmsEnabled] = useState<boolean>(true);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
    fetch('/api/settings/academy')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (typeof data?.smsEnabled === 'boolean') setSmsEnabled(data.smsEnabled);
      })
      .catch(() => { /* 실패해도 default true 유지 */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [detailTab, setDetailTab] = useState('info');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState<StudentForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<StudentForm>(EMPTY_FORM);
  const [newStatus, setNewStatus] = useState<StudentStatus>(StudentStatus.ACTIVE);
  const [postRegister, setPostRegister] = useState<PostRegisterInfo | null>(null);

  // 비밀번호 초기화
  const [resetTarget, setResetTarget] = useState<'student' | 'parent' | null>(null);
  const [resetResult, setResetResult] = useState<{ loginId: string | null; tempPassword: string | null; target: 'student' | 'parent'; smsEnabled: boolean } | null>(null);
  const [resetting, setResetting] = useState(false);

  // 출결 캘린더 팝업 (학생 목록 행 버튼)
  const [attModalStudentId, setAttModalStudentId] = useState<string | null>(null);
  const [attModalStudentName, setAttModalStudentName] = useState('');

  const filtered = getFilteredStudents();
  const selected = selectedStudent; // store의 selectedStudent 직접 참조 (getStudent 불필요)
  const filterOptions = STATUS_OPTIONS.map((opt) => ({
    ...opt,
    count: opt.value === 'all' ? students.length : students.filter((s) => s.status === opt.value).length,
  }));

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.parentPhone) {
      toast('필수 항목을 입력해주세요.', 'error'); return;
    }
    if (registerForm.phone.includes('-') || registerForm.parentPhone.includes('-')) {
      toast("전화번호는 '-' 없이 숫자만 입력해주세요.", 'error'); return;
    }
    // SMS OFF(테스트 모드)일 때만 임시PW 사전 체크 — 본 검증은 서버 validateTempPassword가 수행
    if (!smsEnabled) {
      if (!registerForm.customStudentPassword || !registerForm.customParentPassword) {
        toast('테스트 모드에서는 학생/학부모 임시 비밀번호를 모두 입력해주세요.', 'error'); return;
      }
    }

    const year = new Date().getFullYear();
    const yearCount = students.filter((s) => s.attendanceNumber.startsWith(String(year))).length;
    const attendanceNumber = `${year}${String(yearCount + 1).padStart(3, '0')}`;

    try {
      // siblingCandidates는 서버(POST /api/students)가 감지해서 응답에 포함 (D3)
      const { studentLoginId, studentTempPassword, parentTempPassword, smsEnabled: respSmsEnabled, siblingCandidates } = await addStudent({
        ...registerForm,
        school: `${registerForm.school.trim()}${registerForm.schoolLevel}`,
        grade: Number(registerForm.grade),
        classes: [],
        siblingIds: [],
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        attendanceNumber,
        birthDate: registerForm.birthDate || undefined,
        // smsEnabled=false일 때만 서버에서 사용; true면 무시됨
        customStudentPassword: registerForm.customStudentPassword,
        customParentPassword: registerForm.customParentPassword,
      });

      // addStudent 성공 시 store가 selectedStudentId를 자동 세팅함
      const newStudentId = useStudentStore.getState().selectedStudentId ?? '';

      setRegisterOpen(false);
      setRegisterForm(EMPTY_FORM);
      setPostRegister({
        newStudentId,
        studentLoginId: studentLoginId ?? attendanceNumber,
        parentLoginId: registerForm.parentPhone,
        studentTempPassword,
        parentTempPassword,
        smsEnabled: respSmsEnabled,
        siblingCandidates,
      });
    } catch {
      // 에러는 store에서 toast 처리
    }
  };

  const handleSiblingLink = async () => {
    if (!postRegister) return;
    try {
      await syncSiblings(
        postRegister.newStudentId,
        postRegister.siblingCandidates.map((s) => s.id),
      );
      setPostRegister(null);
      toast('형제/자매 연결이 완료되었습니다.', 'success');
    } catch {
      // syncSiblings에서 실패 토스트 처리 — 모달 유지하여 재시도 가능
    }
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
      // 정보 수정에서는 임시PW 미사용 — 빈 값 (StudentFormFields에서도 미노출, showTempPasswords 기본 false)
      customStudentPassword: '', customParentPassword: '',
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
      setResetResult({ loginId: data.loginId, tempPassword: data.tempPassword ?? null, target, smsEnabled: data.smsEnabled ?? true });
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
        badge={`총 ${students.filter((s) => s.status === StudentStatus.ACTIVE).length}명 재원`}
        actions={
          <Button variant="dark" size="sm" onClick={() => setRegisterOpen(true)}>
            <Plus size={13} /> 학생 등록
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 학생 목록 */}
        <div className="w-64 shrink-0 flex flex-col border-r border-[#e2e8f0] bg-white overflow-hidden">
          <div className="p-3 border-b border-[#e2e8f0] space-y-2">
            <SearchInput value={search} onChange={setSearch} placeholder="이름, 학교 검색" className="w-full" />
            <FilterTags options={filterOptions} value={filterStatus} onChange={(v) => setFilterStatus(v as StudentStatus | 'all')} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              /* 목록 스켈레톤 — LoadingSpinner 전체 블로킹 대신 목록 패널만 shimmer */
              [...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-[#f1f5f9]">
                  <div className="w-8 h-8 rounded-full bg-[#e2e8f0] animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-[#e2e8f0] rounded animate-pulse w-24" />
                    <div className="h-2.5 bg-[#e2e8f0] rounded animate-pulse w-32" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
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
                  onClick={() => { void setSelectedStudent(student.id); setDetailTab('info'); }}
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
        {detailLoading ? (
          /* 상세 스켈레톤 — 학생 클릭 후 API 응답 전까지 shimmer */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f6f8]">
            <div className="bg-white border-b border-[#e2e8f0] px-5 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#e2e8f0] animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#e2e8f0] rounded animate-pulse w-28" />
                <div className="h-3 bg-[#e2e8f0] rounded animate-pulse w-48" />
              </div>
            </div>
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-white rounded-[10px] animate-pulse" />
              ))}
            </div>
          </div>
        ) : selected ? (
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
                  <Link
                    href={`/students/lessons?studentId=${selected.id}`}
                    className="inline-flex items-center gap-1 px-3 h-[30px] rounded-[8px] text-[12px] text-[#374151] border border-[#e2e8f0] bg-white hover:bg-[#f4f6f8]"
                  >
                    <History size={13} /> 수업 이력
                  </Link>
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
              {detailTab === 'info'       && <InfoTab       key={selected.id} student={selected} />}
              {detailTab === 'class'      && <ClassTab      key={selected.id} student={selected} />}
              {detailTab === 'attendance' && <AttendanceTab key={selected.id} student={selected} />}
              {detailTab === 'grade'      && <GradeTab      key={selected.id} student={selected} />}
              {detailTab === 'payment'    && <PaymentTab    key={selected.id} student={selected} />}
              {detailTab === 'consult'    && <ConsultTab    key={selected.id} student={selected} />}
              {detailTab === 'report'     && <StudentReportTab studentId={selected.id} />}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
            <p className="text-[13px] text-[#9ca3af]">좌측에서 학생을 선택하세요</p>
          </div>
        )}
      </div>

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
        <StudentFormFields form={registerForm} setForm={setRegisterForm} showTempPasswords={!smsEnabled} />
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
              <span className="font-mono font-semibold text-[#111827]">{resetResult?.tempPassword ?? '—'}</span>
            </div>
          </div>
          {resetResult?.smsEnabled === false ? (
            <div className="border border-[#fcd34d] bg-[#fffbeb] rounded-[8px] p-3">
              <p className="text-[11.5px] text-[#92400E] font-medium mb-1">SMS 발송이 꺼져 있습니다 (테스트 모드)</p>
              <p className="text-[11px] text-[#78350f]">위 임시 비밀번호를 직접 전달해주세요.</p>
            </div>
          ) : (
            <p className="text-[11px] text-[#9ca3af]">임시 비밀번호는 이 화면에서만 확인할 수 있습니다. 반드시 학생/학부모에게 전달해주세요. 등록된 연락처로 SMS도 발송됩니다.</p>
          )}
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
              <span className="font-mono font-semibold text-[#111827]">{postRegister?.studentTempPassword ?? '—'}</span>
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
              <span className={postRegister?.parentTempPassword ? 'font-mono font-semibold text-[#111827]' : 'text-[#6b7280]'}>
                {postRegister?.parentTempPassword ?? '기존 보호자 계정 — 비밀번호 유지'}
              </span>
            </div>
          </div>
          {postRegister?.smsEnabled === false ? (
            <div className="border border-[#fcd34d] bg-[#fffbeb] rounded-[8px] p-3">
              <p className="text-[11.5px] text-[#92400E] font-medium mb-1">SMS 발송이 꺼져 있습니다 (테스트 모드)</p>
              <p className="text-[11px] text-[#78350f]">위 임시 비밀번호를 학생/학부모에게 직접 전달해주세요. 학생 첫 로그인 시 변경이 강제되지 않습니다.</p>
            </div>
          ) : (
            <p className="text-[11px] text-[#9ca3af]">임시 비밀번호는 이 화면에서만 확인할 수 있습니다. 반드시 전달해주세요. 각 연락처로 SMS도 발송됩니다.</p>
          )}
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
