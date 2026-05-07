'use client';
import { useEffect, useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useMobileChild } from '@/contexts/MobileChildContext';

type ClassInfo = {
  id: string; name: string; color: string; subject: string; room: string; teacherName: string;
  schedule: { dayOfWeek: number; startTime: string; endTime: string }[];
};

const DAY_NAMES: Record<number, string> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금' };
const DAYS = [1, 2, 3, 4, 5] as const;
const HOURS = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

export default function MobileSchedulePage() {
  const { selectedChildId } = useMobileChild();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    fetch(`/api/mobile/me?studentId=${selectedChildId}`)
      .then((r) => r.json())
      .then((data) => { if (data.classes) setClasses(data.classes); })
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  return (
    <div className="flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">시간표</span>
        </div>
      </div>

      <MobileContentLoader loading={loading}>
        <div className="px-4 py-4 space-y-3">
          {/* 주간 시간표 */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-3 overflow-x-auto">
            <div className="min-w-[320px]">
              <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] gap-1 mb-1">
                <div />
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-[11px] font-medium text-[#6b7280]">{DAY_NAMES[d]}</div>
                ))}
              </div>
              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] gap-1 min-h-[34px]">
                  <div className="text-[10px] text-[#9ca3af] flex items-center">{hour}</div>
                  {DAYS.map((day) => {
                    const cls = classes.find((c) =>
                      c.schedule.some((s) => s.dayOfWeek === day && s.startTime <= hour && s.endTime > hour),
                    );
                    return (
                      <div
                        key={day}
                        className="rounded-[5px] flex items-center justify-center text-[9px] font-medium text-white"
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

          {/* 수강 반 상세 */}
          {classes.length === 0 ? (
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6 text-center text-[13px] text-[#9ca3af]">
              수강 중인 반 없음
            </div>
          ) : classes.map((c) => (
            <div key={c.id} className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-[14px] font-bold text-[#111827]">{c.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <div className="text-[#6b7280]">강사</div>
                  <div className="font-medium text-[#111827]">{c.teacherName || '—'}</div>
                </div>
                <div>
                  <div className="text-[#6b7280]">강의실</div>
                  <div className="font-medium text-[#111827]">{c.room || '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[#6b7280]">수업 시간</div>
                  <div className="font-medium text-[#111827]">
                    {c.schedule.map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}~${s.endTime}`).join(', ')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </MobileContentLoader>
      <BottomTabBar />
    </div>
  );
}
