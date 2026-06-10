'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useAuthStore } from '@/lib/stores/authStore';
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
  const { currentUser } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<SettingsTab>('teachers');

  // 강사 추가 모달
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedId || teachers.length === 0) return;
    // 강사 본인은 자기 계정만 선택, 그 외(원장 등)는 첫 강사 선택
    if (currentUser?.role === 'teacher') {
      const own = teachers.find((t) => t.userId === currentUser.id);
      if (own) setSelectedId(own.id);
    } else {
      setSelectedId(teachers[0].id);
    }
  }, [teachers, selectedId, currentUser]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="설정" />
      {loading ? <LoadingSpinner /> : <div className="flex flex-col flex-1 overflow-hidden">
        {/* 상단 가로 탭바 */}
        <div className="flex gap-1 px-5 pt-3 border-b border-[#e2e8f0] bg-white shrink-0">
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
                'px-4 py-2.5 -mb-px text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap border-b-2',
                activeTab === key
                  ? 'border-[#4fc3a1] text-[#111827]'
                  : 'border-transparent text-[#6b7280] hover:text-[#374151]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        {activeTab === 'teachers' ? (
          <div className="flex flex-1 overflow-hidden">
            {/* 강사 목록 (강사 계정 탭 전용 좌측 패널) */}
            <div className="w-56 shrink-0 border-r border-[#e2e8f0] bg-white flex flex-col">
              <TeachersList
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                openRegister={() => setRegisterOpen(true)}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <TeachersTab selectedId={selectedId} registerOpen={registerOpen} setRegisterOpen={setRegisterOpen} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'academy' && <AcademyTab />}
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'tablet' && <TabletTab />}
          </div>
        )}
      </div>}
    </div>
  );
}
