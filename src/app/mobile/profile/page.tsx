'use client';
import { useEffect, useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import PushNotificationToggle from '@/components/mobile/PushNotificationToggle';
import { formatPhone } from '@/lib/utils/format';
import { ChevronLeft, Phone, School, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useMobileChild } from '@/contexts/MobileChildContext';

type StudentInfo = {
  id: string; name: string; school: string; grade: number;
  avatarColor: string; attendanceNumber: string; qrCode: string;
  phone: string | null; parentName: string | null; parentPhone: string | null;
};
type ClassInfo = {
  id: string; name: string; color: string;
  schedule: { dayOfWeek: number; startTime: string; endTime: string }[];
};

const DAY_NAMES: Record<number, string> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 7: '일' };

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

export default function MobileProfilePage() {
  const { selectedChildId, selectedChild } = useMobileChild();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    fetch(`/api/mobile/me?studentId=${selectedChildId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.student) setStudent(data.student);
        if (data.classes) setClasses(data.classes);
      })
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  if (!loading && !student) {
    return (
      <div className="flex flex-col min-h-screen pb-20">
        <div className="bg-[#1a2535] px-4 pt-12 pb-6 min-h-[160px] flex items-center">
          <span className="text-[17px] font-bold text-white">내 정보</span>
        </div>
        <div className="px-4 py-6 flex-1 flex flex-col gap-4">
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6 text-center text-[13px] text-[#9ca3af]">
            학생 정보를 불러올 수 없습니다.
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[12px] border border-[#e2e8f0] bg-white text-[13px] font-semibold text-[#ef4444]"
          >
            <LogOut size={15} />
            로그아웃
          </button>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-20">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">내 정보</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-[24px] font-bold text-white"
            style={{ backgroundColor: student?.avatarColor ?? selectedChild?.avatarColor ?? '#4fc3a1' }}>
            {(student?.name ?? selectedChild?.name ?? 'S')[0]}
          </div>
          <div>
            <div className="text-[20px] font-bold text-white">{student?.name ?? selectedChild?.name ?? ''}</div>
            <div className="text-[13px] text-white/60">{student?.school} {student?.grade ? `${student.grade}학년` : ''}</div>
            <div className="text-[12px] text-[#4fc3a1] mt-0.5">{student?.attendanceNumber ? `출석번호: ${student.attendanceNumber}` : ''}</div>
          </div>
        </div>
      </div>

      <MobileContentLoader loading={loading}>
      <div className="px-4 py-4 space-y-3">
        {/* 연락처 */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="text-[13px] font-semibold text-[#111827] mb-3">연락처</div>
          <div className="space-y-2.5">
            {student?.phone && (
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-[#6b7280]" />
                <div>
                  <div className="text-[11px] text-[#9ca3af]">학생 연락처</div>
                  <div className="text-[12.5px] text-[#111827]">{formatPhone(student.phone)}</div>
                </div>
              </div>
            )}
            {student?.parentPhone && (
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-[#6b7280]" />
                <div>
                  <div className="text-[11px] text-[#9ca3af]">학부모 연락처 : {student.parentName ?? '학부모'}</div>
                  <div className="text-[12.5px] text-[#111827]">{formatPhone(student.parentPhone)}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <School size={14} className="text-[#6b7280]" />
              <div>
                <div className="text-[11px] text-[#9ca3af]">학교</div>
                <div className="text-[12.5px] text-[#111827]">{student?.school} {student?.grade ? `${student.grade}학년` : ''}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 수강 중인 반 */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="text-[13px] font-semibold text-[#111827] mb-3">수강 중인 반</div>
          <div className="space-y-2">
            {classes.length === 0 ? (
              <div className="text-[12px] text-[#9ca3af]">수강 중인 반 없음</div>
            ) : classes.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-[12.5px] font-medium text-[#111827]">{c.name}</span>
                <span className="text-[11.5px] text-[#6b7280] ml-auto">
                  {c.schedule.map((s) => DAY_NAMES[s.dayOfWeek]).join(',')}요일
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 알림 설정 */}
        <PushNotificationToggle />
        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[12px] border border-[#e2e8f0] bg-white text-[13px] font-semibold text-[#ef4444]"
        >
          <LogOut size={15} />
          로그아웃
        </button>
      </div>
      </MobileContentLoader>
      <BottomTabBar />
    </div>
  );
}
