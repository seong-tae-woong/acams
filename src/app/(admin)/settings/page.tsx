'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import { mockTeachers } from '@/lib/mock/teachers';
import type { Teacher } from '@/lib/types/teacher';
import { DEFAULT_PERMISSIONS } from '@/lib/types/teacher';
import { formatPhone } from '@/lib/utils/format';
import { Plus, Trash2, Shield } from 'lucide-react';
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

export default function SettingsPage() {
  const [teachers, setTeachers] = useState<Teacher[]>(mockTeachers);
  const [selectedId, setSelectedId] = useState<string>(mockTeachers[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<'teachers' | 'academy'>('teachers');
  const [academyName, setAcademyName] = useState('세계로학원');
  const [academyPhone, setAcademyPhone] = useState('02-1234-5678');

  const selected = teachers.find((t) => t.id === selectedId);

  const togglePerm = (key: keyof typeof DEFAULT_PERMISSIONS) => {
    setTeachers((prev) =>
      prev.map((t) =>
        t.id === selectedId
          ? { ...t, permissions: { ...t.permissions, [key]: !t.permissions[key] } }
          : t,
      ),
    );
  };

  const toggleActive = () => {
    setTeachers((prev) =>
      prev.map((t) => t.id === selectedId ? { ...t, isActive: !t.isActive } : t),
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="계정 관리" />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 탭 + 강사 목록 */}
        <div className="w-52 shrink-0 border-r border-[#e2e8f0] bg-white flex flex-col">
          <div className="flex border-b border-[#e2e8f0]">
            {(['teachers', 'academy'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'flex-1 py-3 text-[12px] font-medium transition-colors cursor-pointer',
                  activeTab === tab ? 'border-b-2 border-[#4fc3a1] text-[#111827]' : 'text-[#6b7280] hover:text-[#374151]',
                )}
              >
                {tab === 'teachers' ? '강사 계정' : '학원 정보'}
              </button>
            ))}
          </div>

          {activeTab === 'teachers' && (
            <>
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
              </div>
              <div className="p-2 border-t border-[#e2e8f0]">
                <Button variant="dark" size="sm" onClick={() => alert('강사 등록 모달 (추후 구현)')}>
                  <Plus size={13} /> 강사 추가
                </Button>
              </div>
            </>
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
                    <Button variant="default" size="sm">수정</Button>
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
                  <Button variant="primary" size="sm" onClick={() => alert('권한이 저장되었습니다.')}>권한 저장</Button>
                </div>
              </div>
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
                  <Button variant="dark" size="md" onClick={() => alert('저장되었습니다.')}>저장</Button>
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
        </div>
      </div>
    </div>
  );
}
