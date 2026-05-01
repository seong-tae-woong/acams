'use client';
import { useEffect, useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { formatPhone } from '@/lib/utils/format';
import { ChevronLeft, QrCode, Phone, School, LogOut } from 'lucide-react';
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
  const { selectedChildId } = useMobileChild();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

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

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen pb-20">
        <div className="bg-[#1a2535] px-4 pt-12 pb-6 min-h-[160px] flex items-center justify-center">
          <LoadingSpinner />
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!student) {
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
            style={{ backgroundColor: student.avatarColor }}>
            {student.name[0]}
          </div>
          <div>
            <div className="text-[20px] font-bold text-white">{student.name}</div>
            <div className="text-[13px] text-white/60">{student.school} {student.grade}학년</div>
            <div className="text-[12px] text-[#4fc3a1] mt-0.5">출석번호: {student.attendanceNumber}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* QR 코드 */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-[#111827]">출결 QR 코드</span>
            <button onClick={() => setShowQR(!showQR)} className="text-[12px] text-[#4fc3a1] font-medium cursor-pointer">
              {showQR ? '숨기기' : '보기'}
            </button>
          </div>
          {showQR ? (
            <div className="flex flex-col items-center py-4">
              <div className="w-40 h-40 bg-[#f4f6f8] rounded-[10px] flex flex-col items-center justify-center gap-2 border-2 border-[#e2e8f0]">
                <QrCode size={64} className="text-[#1a2535]" />
                <span className="text-[11px] text-[#6b7280]">{student.qrCode}</span>
              </div>
              <p className="text-[11.5px] text-[#9ca3af] mt-3 text-center">
                키오스크에 QR 코드를 스캔하거나<br />출석번호를 입력하세요
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-[#f4f6f8] rounded-[10px] p-3">
              <QrCode size={32} className="text-[#4fc3a1]" />
              <div>
                <div className="text-[12.5px] font-medium text-[#111827]">QR로 빠른 출결 체크</div>
                <div className="text-[11.5px] text-[#6b7280]">보기를 눌러 QR 코드를 확인하세요</div>
              </div>
            </div>
          )}
        </div>

        {/* 연락처 */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="text-[13px] font-semibold text-[#111827] mb-3">연락처</div>
          <div className="space-y-2.5">
            {student.phone && (
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-[#6b7280]" />
                <div>
                  <div className="text-[11px] text-[#9ca3af]">학생 연락처</div>
                  <div className="text-[12.5px] text-[#111827]">{formatPhone(student.phone)}</div>
                </div>
              </div>
            )}
            {student.parentPhone && (
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-[#6b7280]" />
                <div>
                  <div className="text-[11px] text-[#9ca3af]">{student.parentName ?? '학부모'}</div>
                  <div className="text-[12.5px] text-[#111827]">{formatPhone(student.parentPhone)}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <School size={14} className="text-[#6b7280]" />
              <div>
                <div className="text-[11px] text-[#9ca3af]">학교</div>
                <div className="text-[12.5px] text-[#111827]">{student.school} {student.grade}학년</div>
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
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="text-[13px] font-semibold text-[#111827] mb-3">알림 설정</div>
          {[
            { label: '출결 알림', sub: '결석/지각 시 알림 수신' },
            { label: '성적 알림', sub: '시험 성적 등록 시 알림' },
            { label: '공지 알림', sub: '새 공지사항 알림' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9] last:border-0">
              <div>
                <div className="text-[12.5px] font-medium text-[#111827]">{item.label}</div>
                <div className="text-[11px] text-[#9ca3af]">{item.sub}</div>
              </div>
              <div className="w-9 h-5 rounded-full bg-[#4fc3a1] relative cursor-pointer">
                <div className="absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] left-[19px]" />
              </div>
            </div>
          ))}
        </div>
        {/* 로그아웃 */}
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
