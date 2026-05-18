'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { useClassStore } from '@/lib/stores/classStore';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import clsx from 'clsx';
import { type SettingsTab } from './_shared';
import TeachersList from './_components/TeachersList';
import TeachersTab from './_tabs/TeachersTab';
import AcademyTab from './_tabs/AcademyTab';
import ProfileTab from './_tabs/ProfileTab';
import TabletTab from './_tabs/TabletTab';

export default function SettingsPage() {
  const { teachers, loading, fetchTeachers } = useTeacherStore();
  const { fetchClasses } = useClassStore();
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<SettingsTab>('teachers');

  // 강사 추가 모달
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId && teachers.length > 0) setSelectedId(teachers[0].id);
  }, [teachers, selectedId]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="계정 관리" />
      {loading ? <LoadingSpinner /> : <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 탭 + 강사 목록 */}
        <div className="w-52 shrink-0 border-r border-[#e2e8f0] bg-white flex flex-col">
          <div className="flex flex-wrap border-b border-[#e2e8f0]">
            {([
              { key: 'teachers', label: '강사 계정' },
              { key: 'academy',  label: '학원 정보' },
              { key: 'profile',  label: '공개 페이지' },
              { key: 'tablet',   label: '태블릿' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={clsx(
                  'flex-1 py-3 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap',
                  activeTab === key ? 'border-b-2 border-[#4fc3a1] text-[#111827]' : 'text-[#6b7280] hover:text-[#374151]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'teachers' && (
            <TeachersList
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              openRegister={() => setRegisterOpen(true)}
            />
          )}
        </div>

        {/* 우측: 상세 */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'teachers' && (
            <TeachersTab selectedId={selectedId} registerOpen={registerOpen} setRegisterOpen={setRegisterOpen} />
          )}

          {activeTab === 'academy' && <AcademyTab />}

          {/* ── 태블릿 계정 관리 탭 ──────────────────────────── */}
          {activeTab === 'tablet' && <TabletTab />}

          {activeTab === 'profile' && <ProfileTab />}
        </div>
      </div>}
    </div>
  );
}
