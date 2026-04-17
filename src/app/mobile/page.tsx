'use client';
import Link from 'next/link';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { mockBills } from '@/lib/mock/finance';
import { BillStatus } from '@/lib/types/finance';
import { DAY_NAMES } from '@/lib/types/class';
import { Bell, ChevronRight, Calendar, BookOpen, CreditCard, MessageSquare } from 'lucide-react';

// 시뮬레이션: 로그인한 학생 = s1 (김도윤)
const STUDENT_ID = 's1';

export default function MobileHomePage() {
  const { students } = useStudentStore();
  const { classes } = useClassStore();
  const { announcements } = useCommunicationStore();

  const student = students.find((s) => s.id === STUDENT_ID);
  const myClasses = student ? classes.filter((c) => student.classes.includes(c.id)) : [];
  const myBills = mockBills.filter((b) => b.studentId === STUDENT_ID && b.month === '2026-04');
  const unpaid = myBills.filter((b) => b.status !== BillStatus.PAID);
  const pinnedAnnouncements = announcements.filter((a) => a.pinned && a.status === '게시됨');

  const todayDow = new Date('2026-04-18').getDay() || 7;
  const todayClasses = myClasses.filter((c) => c.schedule.some((s) => s.dayOfWeek === todayDow));

  return (
    <div className="flex flex-col pb-20">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[13px] text-[#4fc3a1] font-medium">세계로학원</div>
            <div className="text-[20px] font-bold text-white mt-0.5">
              안녕하세요, {student?.name ?? '학생'}님 👋
            </div>
          </div>
          <Link href="/mobile/profile">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-bold text-white" style={{ backgroundColor: student?.avatarColor ?? '#4fc3a1' }}>
              {student?.name?.[0] ?? 'S'}
            </div>
          </Link>
        </div>
        {/* 오늘 수업 */}
        <div className="bg-white/10 rounded-[12px] p-3">
          <div className="text-[11.5px] text-white/60 mb-1.5">오늘({DAY_NAMES[todayDow]}) 수업</div>
          {todayClasses.length === 0 ? (
            <div className="text-[13px] text-white/70">오늘 수업 없음</div>
          ) : (
            todayClasses.map((c) => {
              const schedule = c.schedule.find((s) => s.dayOfWeek === todayDow);
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-[13px] font-medium text-white">{c.name}</span>
                  <span className="text-[12px] text-white/60">{schedule?.startTime}~{schedule?.endTime}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* 미납 알림 */}
        {unpaid.length > 0 && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[12px] p-3.5 flex items-center gap-3">
            <Bell size={16} className="text-[#991B1B] shrink-0" />
            <div className="flex-1">
              <div className="text-[12.5px] font-semibold text-[#991B1B]">미납 수강료 안내</div>
              <div className="text-[11.5px] text-[#991B1B]/80">
                {unpaid.map((b) => `${b.className} ${(b.amount - b.paidAmount).toLocaleString()}원`).join(' · ')}
              </div>
            </div>
            <Link href="/mobile/payments"><ChevronRight size={16} className="text-[#991B1B]" /></Link>
          </div>
        )}

        {/* 핀 공지 */}
        {pinnedAnnouncements.length > 0 && (
          <div className="bg-[#E1F5EE] border border-[#4fc3a1]/30 rounded-[12px] p-3.5">
            <div className="text-[11px] text-[#0D9E7A] font-semibold mb-1">📌 공지사항</div>
            <div className="text-[12.5px] font-medium text-[#111827]">{pinnedAnnouncements[0].title}</div>
          </div>
        )}

        {/* 바로가기 메뉴 */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/mobile/attendance', label: '출결 확인', sub: '이번 달 출석현황', icon: Calendar, color: '#4fc3a1' },
            { href: '/mobile/grades', label: '성적 조회', sub: '최근 시험 결과', icon: BookOpen, color: '#6366f1' },
            { href: '/mobile/payments', label: '수납 내역', sub: unpaid.length > 0 ? `미납 ${unpaid.length}건` : '전액 납부', icon: CreditCard, color: unpaid.length > 0 ? '#991B1B' : '#0D9E7A' },
            { href: '/mobile/schedule', label: '시간표', sub: `수강 ${myClasses.length}개 반`, icon: Calendar, color: '#f59e0b' },
          ].map(({ href, label, sub, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="bg-white rounded-[12px] border border-[#e2e8f0] p-4 flex flex-col gap-2 active:bg-[#f4f6f8]"
            >
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#111827]">{label}</div>
                <div className="text-[11.5px]" style={{ color }}>{sub}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* 수강 중인 반 */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="text-[13px] font-semibold text-[#111827] mb-3">수강 중인 반</div>
          <div className="space-y-2">
            {myClasses.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <div className="flex-1">
                  <div className="text-[12.5px] font-medium text-[#111827]">{c.name}</div>
                  <div className="text-[11.5px] text-[#6b7280]">
                    {c.schedule.map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}~${s.endTime}`).join(', ')}
                  </div>
                </div>
                <div className="text-[11.5px] text-[#374151]">{c.room}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
