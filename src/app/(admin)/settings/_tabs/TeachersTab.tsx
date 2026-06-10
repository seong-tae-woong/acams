'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import Modal from '@/components/shared/Modal';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { DEFAULT_PERMISSIONS } from '@/lib/types/teacher';
import { formatPhone } from '@/lib/utils/format';
import { Shield, KeyRound, X, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import { PERM_LABELS, AVATAR_COLORS, fieldCls } from '../_shared';

export default function TeachersTab({
  selectedId,
  registerOpen,
  setRegisterOpen,
}: {
  selectedId: string;
  registerOpen: boolean;
  setRegisterOpen: (open: boolean) => void;
}) {
  const { teachers, updateTeacher, addTeacher, resetPassword } = useTeacherStore();
  const { classes } = useClassStore();
  const { currentUser } = useAuthStore();
  const [savingPerm, setSavingPerm] = useState(false);

  // 강사 본인은 자기 계정만 조회(다른 강사 선택 불가) — 권한 섹션·관리 버튼은 원장 전용
  const isTeacher = currentUser?.role === 'teacher';

  // 강사 추가 모달
  const [regForm, setRegForm] = useState({ name: '', subject: '', phone: '', email: '', classes: [] as string[] });
  const [credentialModal, setCredentialModal] = useState<{ name: string; email: string; tempPassword: string | null; smsEnabled: boolean } | null>(null);

  // 강사 추가 모달이 열릴 때 입력 폼 초기화
  useEffect(() => {
    if (registerOpen) setRegForm({ name: '', subject: '', phone: '', email: '', classes: [] });
  }, [registerOpen]);

  // 강사 정보 수정 모달
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', subject: '', phone: '', email: '', classes: [] as string[] });
  const [savingEdit, setSavingEdit] = useState(false);

  // 비밀번호 초기화
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ loginId: string; tempPassword: string | null; smsEnabled: boolean } | null>(null);

  const selected = isTeacher
    ? teachers.find((t) => t.userId === currentUser?.id)
    : teachers.find((t) => t.id === selectedId);

  const togglePerm = (key: keyof typeof DEFAULT_PERMISSIONS) => {
    if (!selected) return;
    const newPerms = { ...selected.permissions, [key]: !selected.permissions[key] };
    useTeacherStore.setState((state) => ({
      teachers: state.teachers.map((t) =>
        t.id === selectedId ? { ...t, permissions: newPerms } : t
      ),
    }));
  };

  const savePerm = async () => {
    if (!selected) return;
    setSavingPerm(true);
    try {
      await updateTeacher(selectedId, { permissions: selected.permissions });
    } finally {
      setSavingPerm(false);
    }
  };

  const toggleActive = async () => {
    if (!selected) return;
    await updateTeacher(selectedId, { isActive: !selected.isActive });
  };

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

  const handleEdit = async () => {
    if (!editForm.name.trim()) { toast('강사 이름을 입력해주세요.', 'error'); return; }
    setSavingEdit(true);
    try {
      await updateTeacher(selectedId, {
        name: editForm.name.trim(),
        subject: editForm.subject.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
      });
      setEditOpen(false);
    } catch { /* store handles error */ } finally {
      setSavingEdit(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!selected) return;
    setResetting(true);
    try {
      const result = await resetPassword(selectedId);
      setResetConfirmOpen(false);
      setResetResult({ loginId: result.loginId, tempPassword: result.tempPassword, smsEnabled: result.smsEnabled });
    } catch { /* store handles error */ } finally {
      setResetting(false);
    }
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
      const { tempPassword, smsEnabled } = await addTeacher({
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
      setCredentialModal({ name: regForm.name.trim(), email: regForm.email.trim(), tempPassword, smsEnabled });
      setRegForm({ name: '', subject: '', phone: '', email: '', classes: [] });
    } catch { /* store handles error */ }
  };

  return (
    <>
      {selected && (
        <div className="space-y-4 max-w-xl">
          {/* 기본 정보 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar name={selected.name} color={selected.avatarColor} size="md" />
                <div>
                  <div className="text-[15px] font-bold text-[#111827]">{selected.name}</div>
                  <div className="text-[12px] text-[#6b7280]">{selected.subject} · {formatPhone(selected.phone)}</div>
                </div>
              </div>
              {/* 계정 관리 버튼 — 원장/슈퍼어드민 전용 (강사 본인은 조회만) */}
              {!isTeacher && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setResetConfirmOpen(true)}>
                    <RefreshCw size={13} /> 비밀번호 초기화
                  </Button>
                  <Button variant="default" size="sm" onClick={openEdit}>수정</Button>
                  <Button
                    variant={selected.isActive ? 'danger' : 'primary'}
                    size="sm"
                    onClick={toggleActive}
                  >
                    {selected.isActive ? '비활성화' : '활성화'}
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <div className="text-[#6b7280] mb-0.5">이메일</div>
                <div className="text-[#111827]">{selected.email}</div>
              </div>
              <div>
                <div className="text-[#6b7280] mb-0.5">담당 반</div>
                <div className="text-[#111827]">{selected.classes.length}개 반</div>
              </div>
            </div>
          </div>

          {/* 권한 설정 — 원장/슈퍼어드민 전용 (강사 본인에게는 미노출) */}
          {!isTeacher && (
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} className="text-[#4fc3a1]" />
                <span className="text-[12.5px] font-semibold text-[#111827]">메뉴 접근 권한</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(DEFAULT_PERMISSIONS) as (keyof typeof DEFAULT_PERMISSIONS)[]).map((key) => {
                  const enabled = selected.permissions[key];
                  return (
                    <label
                      key={key}
                      className="flex items-center justify-between p-2.5 bg-[#f4f6f8] rounded-[8px] cursor-pointer"
                      onClick={() => togglePerm(key)}
                    >
                      <span className="text-[12px] text-[#374151]">{PERM_LABELS[key]}</span>
                      <div className={clsx('w-9 h-5 rounded-full transition-colors relative', enabled ? 'bg-[#4fc3a1]' : 'bg-[#e2e8f0]')}>
                        <div className={clsx('absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all', enabled ? 'left-[19px]' : 'left-[3px]')} />
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="primary" size="sm" onClick={savePerm} disabled={savingPerm}>
                  {savingPerm ? '저장 중...' : '권한 저장'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!selected && teachers.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-[13px] text-[#9ca3af]">등록된 강사가 없습니다.</p>
          <p className="text-[12px] text-[#9ca3af] mt-1">좌측 &apos;강사 추가&apos; 버튼으로 강사를 등록하세요.</p>
        </div>
      )}

      {/* ── 강사 정보 수정 모달 ─────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="강사 정보 수정"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setEditOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleEdit} disabled={savingEdit}>
              {savingEdit ? '저장 중...' : '저장'}
            </Button>
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
              <input className={fieldCls} value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" />
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
              {classes.length === 0 && (
                <span className="text-[12px] text-[#9ca3af]">등록된 반이 없습니다.</span>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── 비밀번호 초기화 확인 모달 ────────────────────── */}
      <Modal
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="비밀번호 초기화"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setResetConfirmOpen(false)} disabled={resetting}>취소</Button>
            <Button variant="danger" size="md" onClick={handlePasswordReset} disabled={resetting}>
              {resetting ? '초기화 중...' : '초기화'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-[#374151]">
            <span className="font-semibold">{selected?.name}</span> 강사의 비밀번호를 초기화하시겠습니까?
          </p>
          <p className="text-[11px] text-[#9ca3af]">초기화 후 새 임시 비밀번호가 발급됩니다. 반드시 강사에게 전달해주세요.</p>
        </div>
      </Modal>

      {/* ── 비밀번호 초기화 결과 모달 ────────────────────── */}
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
              <KeyRound size={13} /> 강사 계정
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-28 text-[#6b7280] shrink-0">로그인 ID</span>
              <span className="font-mono font-medium text-[#111827]">{resetResult?.loginId}</span>
            </div>
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-28 text-[#6b7280] shrink-0">새 임시 비밀번호</span>
              {resetResult?.tempPassword ? (
                <span className="font-mono font-semibold text-[#111827]">{resetResult.tempPassword}</span>
              ) : (
                <span className="text-[#6b7280]">SMS로 발송되었습니다</span>
              )}
            </div>
          </div>
          {resetResult?.tempPassword ? (
            <div className="border border-[#fcd34d] bg-[#fffbeb] rounded-[8px] p-3">
              <p className="text-[11.5px] text-[#92400E] font-medium mb-1">
                {resetResult?.smsEnabled === false ? 'SMS 발송이 꺼져 있습니다 (테스트 모드)' : '강사 연락처가 없어 SMS를 보내지 못했습니다'}
              </p>
              <p className="text-[11px] text-[#78350f]">위 임시 비밀번호를 강사에게 직접 전달해주세요.</p>
            </div>
          ) : (
            <p className="text-[11px] text-[#9ca3af]">임시 비밀번호는 보안을 위해 화면에 표시하지 않으며, 강사 연락처로 SMS 발송되었습니다.</p>
          )}
        </div>
      </Modal>

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
              <label className="text-[11.5px] text-[#6b7280] block mb-1">이메일 *</label>
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
              {credentialModal?.tempPassword ? (
                <span className="font-mono font-semibold text-[#111827]">{credentialModal.tempPassword}</span>
              ) : (
                <span className="text-[#6b7280]">SMS로 발송되었습니다</span>
              )}
            </div>
          </div>
          {credentialModal?.tempPassword ? (
            <div className="border border-[#fcd34d] bg-[#fffbeb] rounded-[8px] p-3">
              <p className="text-[11.5px] text-[#92400E] font-medium mb-1">
                {credentialModal?.smsEnabled === false ? 'SMS 발송이 꺼져 있습니다 (테스트 모드)' : '강사 연락처가 없어 SMS를 보내지 못했습니다'}
              </p>
              <p className="text-[11px] text-[#78350f]">위 임시 비밀번호를 강사에게 직접 전달해주세요.</p>
            </div>
          ) : (
            <p className="text-[11px] text-[#9ca3af]">임시 비밀번호는 보안을 위해 화면에 표시하지 않으며, 강사 연락처로 SMS 발송되었습니다.</p>
          )}
        </div>
      </Modal>
    </>
  );
}
