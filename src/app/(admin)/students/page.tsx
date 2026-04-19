'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import Badge from '@/components/shared/Badge';
import SearchInput from '@/components/shared/SearchInput';
import FilterTags from '@/components/shared/FilterTags';
import Tabs from '@/components/shared/Tabs';
import Modal from '@/components/shared/Modal';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useClassStore } from '@/lib/stores/classStore';
import { StudentStatus } from '@/lib/types/student';
import { formatKoreanDate, formatPhone } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Phone, School, Calendar, StickyNote, Users, KeyRound } from 'lucide-react';
import clsx from 'clsx';

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
];

const AVATAR_COLORS = ['#4A90D9','#7B68EE','#20B2AA','#FF6B6B','#FFD93D','#6BCB77','#F4A261','#A78BFA','#34D399','#FB7185'];

interface StudentForm {
  name: string; school: string; grade: string;
  phone: string; parentName: string; parentPhone: string;
  status: StudentStatus; enrollDate: string; memo: string;
  birthDate: string;
}

const EMPTY_FORM: StudentForm = {
  name: '', school: '', grade: '3',
  phone: '', parentName: '', parentPhone: '',
  status: StudentStatus.ACTIVE, enrollDate: new Date().toISOString().slice(0, 10), memo: '',
  birthDate: '',
};

interface PostRegisterInfo {
  newStudentId: string;
  credentialId: string;
  credentialPw: string;
  siblingCandidates: Array<{ id: string; name: string; school: string; grade: number; avatarColor: string }>;
}

function StudentFormFields({ form, setForm }: { form: StudentForm; setForm: (f: StudentForm) => void }) {
  const fieldClass = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: '이름 *', key: 'name', type: 'text', placeholder: '홍길동' },
        { label: '학교 *', key: 'school', type: 'text', placeholder: '한국초등학교' },
        { label: '학년', key: 'grade', type: 'number', placeholder: '3' },
        { label: '생년월일', key: 'birthDate', type: 'date', placeholder: '' },
        { label: '입원일', key: 'enrollDate', type: 'date', placeholder: '' },
        { label: '학생 연락처 *', key: 'phone', type: 'tel', placeholder: '010-0000-0000' },
        { label: '보호자 이름', key: 'parentName', type: 'text', placeholder: '홍부모' },
        { label: '보호자 연락처 *', key: 'parentPhone', type: 'tel', placeholder: '010-0000-0000' },
      ].map(({ label, key, type, placeholder }) => (
        <div key={key}>
          <label className="text-[11.5px] text-[#6b7280] block mb-1">{label}</label>
          <input
            type={type}
            value={(form as unknown as Record<string, string>)[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder={placeholder}
            className={fieldClass}
          />
        </div>
      ))}
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
  const { students, selectedStudentId, filterStatus, search, getFilteredStudents, getStudent,
    setSelectedStudent, setFilterStatus, setSearch, addStudent, updateStudent, changeStatus,
    addSiblingLink } = useStudentStore();
  const { classes } = useClassStore();
  const [detailTab, setDetailTab] = useState('info');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState<StudentForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<StudentForm>(EMPTY_FORM);
  const [newStatus, setNewStatus] = useState<StudentStatus>(StudentStatus.ACTIVE);
  const [postRegister, setPostRegister] = useState<PostRegisterInfo | null>(null);

  const filtered = getFilteredStudents();
  const selected = selectedStudentId ? getStudent(selectedStudentId) : null;
  const studentClasses = selected ? classes.filter((c) => selected.classes.includes(c.id)) : [];
  const filterOptions = STATUS_OPTIONS.map((opt) => ({
    ...opt,
    count: opt.value === 'all' ? students.length : students.filter((s) => s.status === opt.value).length,
  }));

  const handleRegister = () => {
    if (!registerForm.name || !registerForm.phone || !registerForm.parentPhone) {
      toast('필수 항목을 입력해주세요.', 'error'); return;
    }

    // 출결번호: 연도 + 3자리 순번 (예: 2026021)
    const year = new Date().getFullYear();
    const yearCount = students.filter((s) => s.attendanceNumber.startsWith(String(year))).length;
    const attendanceNumber = `${year}${String(yearCount + 1).padStart(3, '0')}`;

    // 보호자 번호 기반 형제/자매 후보 탐색
    const siblingCandidates = students
      .filter((s) => s.parentPhone && s.parentPhone === registerForm.parentPhone)
      .map(({ id, name, school, grade, avatarColor }) => ({ id, name, school, grade, avatarColor }));

    addStudent({
      ...registerForm,
      grade: Number(registerForm.grade),
      classes: [],
      siblingIds: [],
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      attendanceNumber,
      birthDate: registerForm.birthDate || undefined,
    });

    // 방금 추가된 학생 ID 획득 (Zustand set은 동기)
    const newStudents = useStudentStore.getState().students;
    const newStudentId = newStudents[newStudents.length - 1].id;

    // 학부모 앱 계정 정보
    const credentialId = registerForm.parentPhone;
    const credentialPw = registerForm.birthDate
      ? registerForm.birthDate.replace(/-/g, '')
      : '(생년월일 입력 후 확인 가능)';

    setRegisterOpen(false);
    setRegisterForm(EMPTY_FORM);
    setPostRegister({ newStudentId, credentialId, credentialPw, siblingCandidates });
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
    updateStudent(selected.id, {
      ...editForm,
      grade: Number(editForm.grade),
      birthDate: editForm.birthDate || undefined,
    });
    toast('학생 정보가 수정되었습니다.');
    setEditOpen(false);
  };

  const openEdit = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name, school: selected.school, grade: String(selected.grade),
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

      <div className="flex flex-1 overflow-hidden">
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
              <button
                key={student.id}
                onClick={() => { setSelectedStudent(student.id); setDetailTab('info'); }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer',
                  selectedStudentId === student.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                )}
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
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                      <div className="text-[12.5px] font-semibold text-[#111827] mb-2 flex items-center gap-1">
                        <Users size={13} /> 형제/자매
                      </div>
                      {selected.siblingIds.length === 0 ? (
                        <p className="text-[12px] text-[#9ca3af]">등록된 형제/자매 없음</p>
                      ) : selected.siblingIds.map((id) => {
                        const sibling = students.find((s) => s.id === id);
                        return sibling ? (
                          <div key={id} className="flex items-center gap-2 text-[12px]">
                            <Avatar name={sibling.name} color={sibling.avatarColor} size="sm" />
                            {sibling.name} ({sibling.school} {sibling.grade}학년)
                          </div>
                        ) : null;
                      })}
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
              {(detailTab === 'attendance' || detailTab === 'grade' || detailTab === 'payment' || detailTab === 'consult') && (
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-8 text-center">
                  <p className="text-[13px] text-[#9ca3af]">좌측 메뉴에서 전용 화면을 이용하세요.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
            <p className="text-[13px] text-[#9ca3af]">좌측에서 학생을 선택하세요</p>
          </div>
        )}
      </div>

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

      {/* 등록 완료 모달: 계정 안내 + 형제/자매 감지 */}
      <Modal
        open={!!postRegister}
        onClose={() => setPostRegister(null)}
        title="등록 완료"
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
          {/* 학부모 앱 계정 안내 */}
          <div className="bg-[#f4f6f8] rounded-[8px] p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#111827] mb-1">
              <KeyRound size={13} /> 학부모 앱 계정
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-20 text-[#6b7280] shrink-0">로그인 ID</span>
              <span className="font-mono font-medium text-[#111827]">{postRegister?.credentialId}</span>
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-20 text-[#6b7280] shrink-0">초기 비밀번호</span>
              <span className="font-mono font-medium text-[#111827]">{postRegister?.credentialPw}</span>
            </div>
            <p className="text-[11px] text-[#9ca3af] pt-1">첫 로그인 후 비밀번호를 변경할 수 있습니다.</p>
          </div>

          {/* 형제/자매 감지 안내 */}
          {postRegister?.siblingCandidates.length ? (
            <div className="border border-[#fcd34d] bg-[#fffbeb] rounded-[8px] p-4">
              <div className="text-[12.5px] font-semibold text-[#92400e] mb-2">형제/자매 감지</div>
              <p className="text-[12px] text-[#78350f] mb-3">
                같은 보호자 번호를 사용하는 학생이 있습니다. 형제/자매로 연결할까요?
              </p>
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
