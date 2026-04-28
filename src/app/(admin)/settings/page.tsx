'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import Modal from '@/components/shared/Modal';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { useClassStore } from '@/lib/stores/classStore';
import { DEFAULT_PERMISSIONS } from '@/lib/types/teacher';
import { formatPhone } from '@/lib/utils/format';
import { Shield, Plus, KeyRound, X, RefreshCw, Globe, Copy, ExternalLink } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

const PERM_LABELS: Record<keyof typeof DEFAULT_PERMISSIONS, string> = {
  manageStudents: '학생 관리',
  manageClasses: '반 관리',
  manageAttendance: '출결 관리',
  manageGrades: '성적 관리',
  manageFinance: '재무 관리',
  manageNotifications: '알림/공지',
  viewReports: '리포트 조회',
  admin: '전체 관리자',
};

const AVATAR_COLORS = ['#ef4444', '#4fc3a1', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#ec4899'];
const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

export default function SettingsPage() {
  const { teachers, loading, fetchTeachers, updateTeacher, addTeacher, resetPassword } = useTeacherStore();
  const { classes, fetchClasses } = useClassStore();
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'teachers' | 'academy' | 'profile'>('teachers');
  const [academyName, setAcademyName] = useState('세계로학원');
  const [academyPhone, setAcademyPhone] = useState('02-1234-5678');
  const [savingPerm, setSavingPerm] = useState(false);

  // 강사 추가 모달
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', subject: '', phone: '', email: '', classes: [] as string[] });
  const [credentialModal, setCredentialModal] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

  // 강사 정보 수정 모달
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', subject: '', phone: '', email: '', classes: [] as string[] });
  const [savingEdit, setSavingEdit] = useState(false);

  // 비밀번호 초기화
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ loginId: string; tempPassword: string } | null>(null);

  // 공개 프로필 상태
  const [profileForm, setProfileForm] = useState({
    slug: '',
    intro: '',
    directorName: '',
    businessNumber: '',
    phone: '',
    address: '',
    operatingHours: '',
    refundPolicy: '',
    showFees: true,
    profileEnabled: false,
    kakaoMapUrl: '',
    galleryImages: Array(6).fill('') as string[],
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId && teachers.length > 0) setSelectedId(teachers[0].id);
  }, [teachers, selectedId]);

  useEffect(() => {
    if (activeTab !== 'profile') return;
    setProfileLoading(true);
    fetch('/api/settings/academy')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const imgs = [...(data.galleryImages ?? []), '', '', '', '', '', ''].slice(0, 6);
        setProfileForm({
          slug: data.slug ?? '',
          intro: data.intro ?? '',
          directorName: data.directorName ?? '',
          businessNumber: data.businessNumber ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          operatingHours: data.operatingHours ?? '',
          refundPolicy: data.refundPolicy ?? '',
          showFees: data.showFees ?? true,
          profileEnabled: data.profileEnabled ?? false,
          kakaoMapUrl: data.kakaoMapUrl ?? '',
          galleryImages: imgs,
        });
      })
      .finally(() => setProfileLoading(false));
  }, [activeTab]); // eslint-disable-line

  const selected = teachers.find((t) => t.id === selectedId);

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
      setResetResult(result);
    } catch { /* store handles error */ } finally {
      setResetting(false);
    }
  };

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

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      // galleryImages는 갤러리 API로 별도 관리, slug는 읽기 전용
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { galleryImages, slug, ...fields } = profileForm;
      const res = await fetch('/api/settings/academy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        toast('공개 프로필이 저장되었습니다.', 'success');
      } else {
        toast('저장에 실패했습니다.', 'error');
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIndex(index);
    try {
      const imageCompression = (await import('browser-image-compression')).default;
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      });
      const formData = new FormData();
      formData.append('file', compressed, 'image.jpg');
      formData.append('index', String(index));
      const res = await fetch('/api/settings/gallery', { method: 'POST', body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast(`업로드 실패 (${res.status}): ${errData.error ?? '알 수 없는 오류'}`, 'error');
        return;
      }
      const { url } = await res.json();
      setProfileForm((f) => {
        const imgs = [...f.galleryImages];
        imgs[index] = url;
        return { ...f, galleryImages: imgs };
      });
      toast('사진이 업로드되었습니다.', 'success');
    } catch {
      toast('업로드에 실패했습니다.', 'error');
    } finally {
      setUploadingIndex(null);
      e.target.value = '';
    }
  };

  const deleteImage = async (index: number) => {
    const res = await fetch(`/api/settings/gallery?index=${index}`, { method: 'DELETE' });
    if (!res.ok) { toast('삭제에 실패했습니다.', 'error'); return; }
    setProfileForm((f) => {
      const imgs = [...f.galleryImages];
      imgs[index] = '';
      return { ...f, galleryImages: imgs };
    });
    toast('사진이 삭제되었습니다.', 'success');
  };

  const handleRegister = async () => {
    if (!regForm.name.trim()) { toast('강사 이름을 입력해주세요.', 'error'); return; }
    if (!regForm.email.trim()) { toast('이메일을 입력해주세요.', 'error'); return; }
    try {
      const { tempPassword } = await addTeacher({
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
      setCredentialModal({ name: regForm.name.trim(), email: regForm.email.trim(), tempPassword });
      setRegForm({ name: '', subject: '', phone: '', email: '', classes: [] });
    } catch { /* store handles error */ }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="계정 관리" />
      {loading ? <LoadingSpinner /> : <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 탭 + 강사 목록 */}
        <div className="w-52 shrink-0 border-r border-[#e2e8f0] bg-white flex flex-col">
          <div className="flex border-b border-[#e2e8f0]">
            {(['teachers', 'academy', 'profile'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'flex-1 py-3 text-[11px] font-medium transition-colors cursor-pointer',
                  activeTab === tab ? 'border-b-2 border-[#4fc3a1] text-[#111827]' : 'text-[#6b7280] hover:text-[#374151]',
                )}
              >
                {tab === 'teachers' ? '강사 계정' : tab === 'academy' ? '학원 정보' : '공개 페이지'}
              </button>
            ))}
          </div>

          {activeTab === 'teachers' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* 강사 추가 버튼 */}
              <div className="p-3 border-b border-[#e2e8f0] shrink-0">
                <button
                  onClick={openRegister}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-[12px] font-medium bg-[#1a2535] text-white hover:bg-[#263347] transition-colors cursor-pointer"
                >
                  <Plus size={13} /> 강사 추가
                </button>
              </div>
              {/* 강사 목록 */}
              <div className="flex-1 overflow-y-auto">
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
                      <div className="text-[11px] text-[#6b7280]">
                        {t.subject} · {t.isActive ? '활성' : '비활성'}
                      </div>
                    </div>
                    {!t.isActive && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-[#f1f5f9] text-[#9ca3af] rounded">비활성</span>
                    )}
                  </button>
                ))}
                {teachers.length === 0 && (
                  <div className="p-4 text-center text-[12px] text-[#9ca3af]">등록된 강사가 없습니다.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 우측: 상세 */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'teachers' && selected && (
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

              {/* 권한 설정 */}
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
            </div>
          )}

          {activeTab === 'teachers' && !selected && teachers.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-[13px] text-[#9ca3af]">등록된 강사가 없습니다.</p>
              <p className="text-[12px] text-[#9ca3af] mt-1">좌측 &apos;강사 추가&apos; 버튼으로 강사를 등록하세요.</p>
            </div>
          )}

          {activeTab === 'academy' && (
            <div className="space-y-4 max-w-xl">
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
                <div className="text-[13px] font-semibold text-[#111827] mb-2">학원 기본 정보</div>
                {[
                  { label: '학원명', value: academyName, setter: setAcademyName },
                  { label: '대표 전화', value: academyPhone, setter: setAcademyPhone },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">{label}</label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]"
                    />
                  </div>
                ))}
                <div className="pt-2">
                  <Button variant="dark" size="md" onClick={() => toast('학원 정보가 저장되었습니다.', 'success')}>저장</Button>
                </div>
              </div>

              <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                <div className="text-[13px] font-semibold text-[#111827] mb-3">알림 설정</div>
                {[
                  { label: '결석 시 학부모 자동 알림', desc: '출결 저장 20분 후 발송' },
                  { label: '수강료 미납 자동 알림', desc: '납부기한 다음날 발송' },
                  { label: '성적 등록 알림', desc: '시험 성적 등록 시 발송' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9] last:border-0">
                    <div>
                      <div className="text-[12.5px] font-medium text-[#111827]">{item.label}</div>
                      <div className="text-[11px] text-[#9ca3af]">{item.desc}</div>
                    </div>
                    <div className="w-9 h-5 rounded-full bg-[#4fc3a1] relative cursor-pointer">
                      <div className="absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] left-[19px]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4 max-w-xl">
              {profileLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[#4fc3a1] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* 공개 페이지 URL */}
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe size={14} className="text-[#4fc3a1]" />
                      <span className="text-[13px] font-semibold text-[#111827]">공개 페이지 URL</span>
                    </div>
                    {profileForm.slug ? (
                      <div className="flex items-center gap-2 bg-[#f4f6f8] rounded-[8px] px-3 py-2 mb-3">
                        <span className="text-[12px] text-[#374151] flex-1 font-mono truncate">
                          /academy/{profileForm.slug}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/academy/${profileForm.slug}`);
                            toast('URL이 복사되었습니다.', 'success');
                          }}
                          className="text-[#9ca3af] hover:text-[#4fc3a1] transition-colors cursor-pointer shrink-0"
                          title="URL 복사"
                        >
                          <Copy size={13} />
                        </button>
                        <a
                          href={`/academy/${profileForm.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#9ca3af] hover:text-[#4fc3a1] transition-colors shrink-0"
                          title="페이지 미리보기"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    ) : (
                      <p className="text-[12px] text-[#9ca3af] mb-3">슬러그가 설정되지 않았습니다.</p>
                    )}
                    <div className="flex items-center justify-between py-2 border-t border-[#f1f5f9]">
                      <div>
                        <div className="text-[12.5px] font-medium text-[#111827]">페이지 공개</div>
                        <div className="text-[11px] text-[#9ca3af]">비활성 시 학원 소개 페이지 접근 불가</div>
                      </div>
                      <div
                        className={clsx('w-9 h-5 rounded-full relative cursor-pointer transition-colors', profileForm.profileEnabled ? 'bg-[#4fc3a1]' : 'bg-[#e2e8f0]')}
                        onClick={() => setProfileForm((f) => ({ ...f, profileEnabled: !f.profileEnabled }))}
                      >
                        <div className={clsx('absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all', profileForm.profileEnabled ? 'left-[19px]' : 'left-[3px]')} />
                      </div>
                    </div>
                  </div>

                  {/* 학원 소개 */}
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
                    <div className="text-[13px] font-semibold text-[#111827] mb-1">학원 소개</div>
                    <div>
                      <label className="text-[11.5px] text-[#6b7280] block mb-1">소개글</label>
                      <textarea
                        rows={3}
                        value={profileForm.intro}
                        onChange={(e) => setProfileForm((f) => ({ ...f, intro: e.target.value }))}
                        placeholder="학원 소개글을 입력하세요"
                        className={clsx(fieldCls, 'resize-none')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11.5px] text-[#6b7280] block mb-1">대표자명</label>
                        <input type="text" value={profileForm.directorName} onChange={(e) => setProfileForm((f) => ({ ...f, directorName: e.target.value }))} className={fieldCls} placeholder="홍길동" />
                      </div>
                      <div>
                        <label className="text-[11.5px] text-[#6b7280] block mb-1">사업자등록번호</label>
                        <input type="text" value={profileForm.businessNumber} onChange={(e) => setProfileForm((f) => ({ ...f, businessNumber: e.target.value }))} className={fieldCls} placeholder="000-00-00000" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11.5px] text-[#6b7280] block mb-1">대표 전화</label>
                        <input type="text" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} className={fieldCls} placeholder="02-0000-0000" />
                      </div>
                      <div>
                        <label className="text-[11.5px] text-[#6b7280] block mb-1">주소</label>
                        <input type="text" value={profileForm.address} onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))} className={fieldCls} placeholder="서울시 강남구..." />
                      </div>
                    </div>
                  </div>

                  {/* 운영 정보 */}
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
                    <div className="text-[13px] font-semibold text-[#111827] mb-1">운영 정보</div>
                    <div>
                      <label className="text-[11.5px] text-[#6b7280] block mb-1">운영 시간</label>
                      <textarea
                        rows={3}
                        value={profileForm.operatingHours}
                        onChange={(e) => setProfileForm((f) => ({ ...f, operatingHours: e.target.value }))}
                        placeholder={'월~금  14:00 ~ 22:00\n토  10:00 ~ 18:00\n일  휴무'}
                        className={clsx(fieldCls, 'resize-none')}
                      />
                    </div>
                    <div>
                      <label className="text-[11.5px] text-[#6b7280] block mb-1">환불 정책</label>
                      <textarea
                        rows={3}
                        value={profileForm.refundPolicy}
                        onChange={(e) => setProfileForm((f) => ({ ...f, refundPolicy: e.target.value }))}
                        placeholder="수강 시작 후 1개월 이내 50% 환불..."
                        className={clsx(fieldCls, 'resize-none')}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-[#f1f5f9]">
                      <div>
                        <div className="text-[12.5px] font-medium text-[#111827]">수강료 공개</div>
                        <div className="text-[11px] text-[#9ca3af]">비활성 시 공개 페이지에서 수강료 숨김</div>
                      </div>
                      <div
                        className={clsx('w-9 h-5 rounded-full relative cursor-pointer transition-colors', profileForm.showFees ? 'bg-[#4fc3a1]' : 'bg-[#e2e8f0]')}
                        onClick={() => setProfileForm((f) => ({ ...f, showFees: !f.showFees }))}
                      >
                        <div className={clsx('absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all', profileForm.showFees ? 'left-[19px]' : 'left-[3px]')} />
                      </div>
                    </div>
                  </div>

                  {/* 갤러리 */}
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
                    <div className="text-[13px] font-semibold text-[#111827]">학원 사진 (최대 6장)</div>
                    <p className="text-[11px] text-[#9ca3af]">사진을 선택하면 자동으로 최적화되어 업로드됩니다.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const url = profileForm.galleryImages[i] ?? '';
                        const isUploading = uploadingIndex === i;
                        return (
                          <div
                            key={i}
                            className="relative aspect-[4/3] rounded-[8px] overflow-hidden border border-dashed border-[#e2e8f0] bg-[#f8fafc]"
                          >
                            {url ? (
                              <>
                                <img src={url} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
                                <button
                                  onClick={() => deleteImage(i)}
                                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 cursor-pointer transition-colors"
                                >
                                  <X size={10} className="text-white" />
                                </button>
                              </>
                            ) : (
                              <label className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-[#f1f5f9] transition-colors">
                                {isUploading ? (
                                  <div className="w-5 h-5 border-2 border-[#4fc3a1] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Plus size={18} className="text-[#d1d5db]" />
                                    <span className="text-[10px] text-[#9ca3af]">추가</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingIndex !== null}
                                  onChange={(e) => handleImageUpload(e, i)}
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 저장 버튼 */}
                  <div className="flex justify-end pb-2">
                    <Button variant="dark" size="md" onClick={saveProfile} disabled={profileSaving}>
                      {profileSaving ? '저장 중...' : '공개 페이지 저장'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>}

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
              <span className="font-mono font-bold text-[#4fc3a1] text-[15px] tracking-wider">{resetResult?.tempPassword}</span>
            </div>
          </div>
          <p className="text-[11px] text-[#9ca3af]">이 화면을 닫으면 임시 비밀번호를 다시 확인할 수 없습니다.</p>
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
              <span className="font-mono font-medium text-[#4fc3a1] text-[14px] tracking-wider">{credentialModal?.tempPassword}</span>
            </div>
          </div>
          <p className="text-[11px] text-[#9ca3af]">이 화면을 닫으면 임시 비밀번호를 다시 확인할 수 없습니다.</p>
        </div>
      </Modal>
    </div>
  );
}
