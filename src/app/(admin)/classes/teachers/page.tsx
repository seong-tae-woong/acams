'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import { useClassStore } from '@/lib/stores/classStore';
import { mockTeachers } from '@/lib/mock/teachers';
import { DAY_NAMES } from '@/lib/types/class';
import { formatPhone } from '@/lib/utils/format';
import { Plus } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

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

export default function TeachersPage() {
  const [selectedId, setSelectedId] = useState(mockTeachers[0]?.id ?? '');
  const { classes } = useClassStore();

  const selected = mockTeachers.find((t) => t.id === selectedId);
  const teacherClasses = selected ? classes.filter((c) => selected.classes.includes(c.id)) : [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="강사 배정"
        badge={`총 ${mockTeachers.filter(t => t.isActive).length}명`}
        actions={<Button variant="dark" size="sm" onClick={() => toast('강사 등록 기능은 추후 지원 예정입니다.', 'info')}><Plus size={13} /> 강사 등록</Button>}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 강사 목록 */}
        <div className="w-48 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {mockTeachers.map((t) => (
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
                <Button variant="default" size="sm" onClick={() => toast('정보 수정 기능은 추후 지원 예정입니다.', 'info')}>정보 수정</Button>
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
                <Button variant="primary" size="sm" onClick={() => toast(`${selected.name} 강사 권한이 저장되었습니다.`, 'success')}>권한 저장</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PERM_LABELS).map(([key, label]) => {
                  const enabled = selected.permissions[key as keyof typeof selected.permissions];
                  return (
                    <label key={key} className="flex items-center justify-between p-2.5 bg-[#f4f6f8] rounded-[8px] cursor-pointer">
                      <span className="text-[12px] text-[#374151]">{label}</span>
                      <div className={clsx('w-9 h-5 rounded-full transition-colors relative', enabled ? 'bg-[#4fc3a1]' : 'bg-[#e2e8f0]')}>
                        <div className={clsx('absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all', enabled ? 'left-[19px]' : 'left-[3px]')} />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
