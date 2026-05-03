'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import Avatar from '@/components/shared/Avatar';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { useClassStore } from '@/lib/stores/classStore';
import { DAY_NAMES } from '@/lib/types/class';
import { DEFAULT_PERMISSIONS } from '@/lib/types/teacher';
import type { TeacherPermissions } from '@/lib/types/teacher';
import { formatPhone } from '@/lib/utils/format';
import { Plus, X, KeyRound } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const HOURS = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
const DAYS = [1, 2, 3, 4, 5] as const;

const PERM_LABELS: Record<string, string> = {
  manageStudents: '학생 관리',
  manageClasses: '반 관리',
  manageAttendance: '출결 관리',
  manageGrades: '성적 관리',
  manageFinance: '재무 관리',
  manageNotifications: '알림/공지',
  viewReports: '리포트 조회',
};

const AVATAR_COLORS = ['#ef4444', '#4fc3a1', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#ec4899'];

const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

export default function TeachersPage() {
  const { teachers, loading, addTeacher, updateTeacher, fetchTeachers } = useTeacherStore();
  const { classes, fetchClasses } = useClassStore();

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedId, setSelectedId] = useState(teachers[0]?.id ?? '');
  const selected = teachers.find((t) => t.id === selectedId);
  const teacherClasses = selected ? classes.filter((c) => selected.classes.includes(c.id)) : [];

  // ── 권한 로컬 상태 ─────────────────────────────────────
  const [localPerms, setLocalPerms] = useState<TeacherPermissions>(
    selected?.permissions ?? DEFAULT_PERMISSIONS,
  );

  useEffect(() => {
    if (selected) setLocalPerms(selected.permissions);
  }, [selectedId, selected]);

  const togglePerm = (key: string) => {
    setLocalPerms((prev) => ({ ...prev, [key]: !prev[key as keyof TeacherPermissions] }));
  };

  const handleSavePerms = () => {
    if (!selected) return;
    updateTeacher(selected.id, { permissions: localPerms });
    toast(`${selected.name} 강사 권한이 저장되었습니다.`, 'success');
  };

  // ── 강사 등록 모달 ─────────────────────────────────────
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '', subject: '', phone: '', email: '', classes: [] as string[],
  });
  const [credentialModal, setCredentialModal] = useState<{ name: string; email: string } | null>(null);

  const openRegister = () => {
    setRegForm({ name: '', subject: '', phone: '', email: '', classes: [] });
    setRegisterOpen(true);
  };

  const toggleRegClass = (classId: string) => {
    setRegForm((f) => ({
      ...f,
      classes: f.classes.includes(classId)
        ? f.classes.filter((id) => id !== classId)
        : [...f.classes, classId],
    }));
  };

  const handleRegister = async () => {
    if (!regForm.name.trim()) { toast('강사 이름을 입력해주세요.', 'error'); return; }
    if (!regForm.email.trim()) { toast('이메일을 입력해주세요.', 'error'); return; }
    try {
      await addTeacher({
        name: regForm.name.trim(),
        subject: regForm.subject.trim(),
        phone: regForm.phone.trim(),
        email: regForm.email.trim(),
        classes: regForm.classes,
        permissions: { ...DEFAULT_PERMISSIONS },
        isActive: true,
        avatarColor: AVATAR_COLORS[teachers.length % AVATAR_COLORS.length],
      });
      setRegisterOpen(false);
      setCredentialModal({ name: regForm.name.trim(), email: regForm.email.trim() });
      setRegForm({ name: '', subject: '', phone: '', email: '', classes: [] });
    } catch {
      // 에러는 store에서 toast 처리
    }
  };

  // ── 강사 정보 수정 모달 ────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', subject: '', phone: '', email: '', classes: [] as string[],
  });

  const openEdit = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name,
      subject: selected.subject,
      phone: selected.phone,
      email: selected.email,
      classes: [...selected.classes],
    });
    setEditOpen(true);
  };

  const toggleEditClass = (classId: string) => {
    setEditForm((f) => ({
      ...f,
      classes: f.classes.includes(classId)
        ? f.classes.filter((id) => id !== classId)
        : [...f.classes, classId],
    }));
  };

  const handleEdit = () => {
    if (!selected) return;
    if (!editForm.name.trim()) { toast('강사 이름을 입력해주세요.', 'error'); return; }
    updateTeacher(selected.id, {
      name: editForm.name.trim(),
      subject: editForm.subject.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim(),
      classes: editForm.classes,
    });
    toast('강사 정보가 수정되었습니다.', 'success');
    setEditOpen(false);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="강사 배정"
        badge={`총 ${teachers.filter(t => t.isActive).length}명`}
        actions={
          <Button variant="dark" size="sm" onClick={openRegister}>
            <Plus size={13} /> 강사 등록
          </Button>
        }
      />
      {loading ? <LoadingSpinner /> : <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 강사 목록 */}
        <div className="w-48 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {teachers.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-3 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer',
                selectedId === t.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
              )}
            >
              <Avatar name={t.name} color={t.avatarColor} size="sm" />
              <div>
                <div className="text-[12.5px] font-medium text-[#111827]">{t.name}</div>
                <div className="text-[11px] text-[#6b7280]">{t.subject}</div>
              </div>
            </button>
          ))}
        </div>

        {/* 우측: 강사 상세 */}
        {selected && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 기본 정보 */}
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar name={selected.name} color={selected.avatarColor} size="md" />
                  <div>
                    <div className="text-[15px] font-bold text-[#111827]">{selected.name}</div>
                    <div className="text-[12px] text-[#6b7280]">{selected.subject} · {formatPhone(selected.phone)}</div>
                  </div>
                </div>
                <Button variant="default" size="sm" onClick={openEdit}>정보 수정</Button>
              </div>

              {/* 담당 반 */}
              <div className="mt-3 pt-3 border-t border-[#f1f5f9]">
                <div className="text-[12px] text-[#6b7280] mb-2">담당 반</div>
                <div className="flex flex-wrap gap-2">
                  {teacherClasses.map((cls) => (
                    <span key={cls.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f4f6f8] rounded-[8px] text-[12px] text-[#374151]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                      {cls.name}
                    </span>
                  ))}
                  {teacherClasses.length === 0 && (
                    <span className="text-[12px] text-[#9ca3af]">배정된 반 없음</span>
                  )}
                </div>
              </div>
            </div>

            {/* 주간 스케줄 */}
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e8f0]">
                <span className="text-[12.5px] font-semibold text-[#111827]">주간 스케줄</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-[50px_1fr_1fr_1fr_1fr_1fr] gap-1 mb-1">
                  <div />
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-[11.5px] font-medium text-[#6b7280]">{DAY_NAMES[d]}</div>
                  ))}
                </div>
                {HOURS.map((hour) => (
                  <div key={hour} className="grid grid-cols-[50px_1fr_1fr_1fr_1fr_1fr] gap-1 min-h-[36px]">
                    <div className="text-[10.5px] text-[#9ca3af] flex items-center">{hour}</div>
                    {DAYS.map((day) => {
                      const cls = teacherClasses.find((c) =>
                        c.schedule.some((s) => s.dayOfWeek === day && s.startTime <= hour && s.endTime > hour),
                      );
                      return (
                        <div
                          key={day}
                          className="rounded-[6px] flex items-center justify-center text-[10px] font-medium text-white"
                          style={cls ? { backgroundColor: cls.color } : { backgroundColor: '#f4f6f8' }}
                        >
                          {cls && cls.name.slice(0, 4)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* 권한 설정 */}
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12.5px] font-semibold text-[#111827]">메뉴 접근 권한</span>
                <Button variant="primary" size="sm" onClick={handleSavePerms}>권한 저장</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PERM_LABELS).map(([key, label]) => {
                  const enabled = localPerms[key as keyof TeacherPermissions];
                  return (
                    <label key={key} className="flex items-center justify-between p-2.5 bg-[#f4f6f8] rounded-[8px] cursor-pointer">
                      <span className="text-[12px] text-[#374151]">{label}</span>
                      <button
                        type="button"
                        onClick={() => togglePerm(key)}
                        className={clsx('w-9 h-5 rounded-full transition-colors relative focus:outline-none cursor-pointer', enabled ? 'bg-[#4fc3a1]' : 'bg-[#e2e8f0]')}
                      >
                        <div className={clsx('absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all', enabled ? 'left-[19px]' : 'left-[3px]')} />
                      </button>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>}

      {/* ── 강사 등록 모달 ───────────────────────────────── */}
      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="강사 등록"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setRegisterOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleRegister}>등록</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">이름 *</label>
              <input className={fieldCls} value={regForm.name} onChange={(e) => setRegForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 최선생" />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">과목</label>
              <input className={fieldCls} value={regForm.subject} onChange={(e) => setRegForm((f) => ({ ...f, subject: e.target.value }))} placeholder="예: 수학" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">연락처</label>
              <input className={fieldCls} value={regForm.phone} onChange={(e) => setRegForm((f) => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">이메일</label>
              <input className={fieldCls} value={regForm.email} onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))} placeholder="예: teacher@acams.kr" />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">담당 반 (복수 선택 가능)</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {classes.map((cls) => {
                const isSelected = regForm.classes.includes(cls.id);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => toggleRegClass(cls.id)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] border transition-colors cursor-pointer',
                      isSelected
                        ? 'border-[#4fc3a1] bg-[#E1F5EE] text-[#065f46]'
                        : 'border-[#e2e8f0] bg-[#f4f6f8] text-[#374151] hover:border-[#4fc3a1]',
                    )}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                    {cls.name}
                    {isSelected && <X size={11} className="ml-0.5 text-[#4fc3a1]" />}
                  </button>
                );
              })}
              {classes.length === 0 && (
                <span className="text-[12px] text-[#9ca3af]">등록된 반이 없습니다.</span>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── 계정 발급 안내 모달 ──────────────────────────── */}
      <Modal
        open={!!credentialModal}
        onClose={() => setCredentialModal(null)}
        title="강사 계정 발급 완료"
        size="sm"
        footer={
          <Button variant="dark" size="md" onClick={() => setCredentialModal(null)}>확인</Button>
        }
      >
        <div className="space-y-3">
          <p className="text-[12.5px] text-[#6b7280]">
            <span className="font-semibold text-[#111827]">{credentialModal?.name}</span> 강사의 로그인 계정이 발급되었습니다.
            아래 정보를 강사에게 전달해주세요.
          </p>
          <div className="bg-[#f4f6f8] rounded-[10px] p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#111827] mb-1">
              <KeyRound size={13} /> 로그인 정보
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-24 text-[#6b7280] shrink-0">이메일(ID)</span>
              <span className="font-mono font-medium text-[#111827]">{credentialModal?.email}</span>
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-24 text-[#6b7280] shrink-0">임시 비밀번호</span>
              <span className="text-[#4fc3a1] font-medium">강사 연락처로 SMS 발송됨</span>
            </div>
          </div>
          <p className="text-[11px] text-[#9ca3af]">임시 비밀번호가 강사 연락처로 SMS 발송되었습니다.</p>
        </div>
      </Modal>

      {/* ── 강사 정보 수정 모달 ──────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="강사 정보 수정"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setEditOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleEdit}>저장</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">이름 *</label>
              <input className={fieldCls} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">과목</label>
              <input className={fieldCls} value={editForm.subject} onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">연락처</label>
              <input className={fieldCls} value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">이메일</label>
              <input className={fieldCls} value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">담당 반 (복수 선택 가능)</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {classes.map((cls) => {
                const isSelected = editForm.classes.includes(cls.id);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => toggleEditClass(cls.id)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] border transition-colors cursor-pointer',
                      isSelected
                        ? 'border-[#4fc3a1] bg-[#E1F5EE] text-[#065f46]'
                        : 'border-[#e2e8f0] bg-[#f4f6f8] text-[#374151] hover:border-[#4fc3a1]',
                    )}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                    {cls.name}
                    {isSelected && <X size={11} className="ml-0.5 text-[#4fc3a1]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
