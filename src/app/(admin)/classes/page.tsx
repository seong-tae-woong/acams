'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { DAY_NAMES } from '@/lib/types/class';
import { toast } from '@/lib/stores/toastStore';
import { Plus } from 'lucide-react';
import clsx from 'clsx';

const HOURS = ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
const DAYS = [1, 2, 3, 4, 5] as const; // 월~금

export default function ClassesPage() {
  const { classes, selectedClassId, setSelectedClass } = useClassStore();
  const { students } = useStudentStore();
  const selected = classes.find((c) => c.id === selectedClassId);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', teacher: '', fee: '', room: '' });

  const handleAddClass = () => {
    if (!addForm.name.trim()) { toast('반 이름을 입력해주세요.', 'error'); return; }
    toast(`'${addForm.name}' 반이 등록되었습니다.`, 'success');
    setAddForm({ name: '', teacher: '', fee: '', room: '' });
    setAddOpen(false);
  };

  const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="반 편성 및 시간표"
        actions={<Button variant="dark" size="sm" onClick={() => setAddOpen(true)}><Plus size={13} /> 반 추가</Button>}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 반 목록 */}
        <div className="w-56 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {classes.map((cls) => {
            const pct = Math.round((cls.currentStudents / cls.maxStudents) * 100);
            const isFull = cls.currentStudents >= cls.maxStudents;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={clsx(
                  'w-full px-3 py-3 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer',
                  selectedClassId === cls.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                  <span className="text-[12.5px] font-medium text-[#111827] truncate">{cls.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#6b7280]">{cls.teacherName}</span>
                  <span className={clsx('text-[11px] font-medium', isFull ? 'text-[#991B1B]' : 'text-[#065f46]')}>
                    {cls.currentStudents}/{cls.maxStudents}명
                  </span>
                </div>
                <div className="mt-1.5 h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: isFull ? '#ef4444' : '#4fc3a1' }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* 우측: 시간표 + 반 상세 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {selected && (
            <>
              {/* 반 정보 카드 */}
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selected.color }} />
                    <span className="text-[15px] font-bold text-[#111827]">{selected.name}</span>
                  </div>
                  <Button variant="default" size="sm" onClick={() => toast('반 수정 기능은 추후 지원 예정입니다.', 'info')}>반 수정</Button>
                </div>
                <div className="grid grid-cols-4 gap-4 text-[12px]">
                  <div>
                    <div className="text-[#6b7280] mb-0.5">강사</div>
                    <div className="font-medium text-[#111827]">{selected.teacherName}</div>
                  </div>
                  <div>
                    <div className="text-[#6b7280] mb-0.5">정원/현원</div>
                    <div className="font-medium text-[#111827]">{selected.currentStudents}/{selected.maxStudents}명</div>
                  </div>
                  <div>
                    <div className="text-[#6b7280] mb-0.5">수강료</div>
                    <div className="font-medium text-[#111827]">{selected.fee.toLocaleString()}원/월</div>
                  </div>
                  <div>
                    <div className="text-[#6b7280] mb-0.5">강의실</div>
                    <div className="font-medium text-[#111827]">{selected.room}</div>
                  </div>
                </div>
              </div>

              {/* 주간 시간표 */}
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0]">
                  <span className="text-[12.5px] font-semibold text-[#111827]">주간 시간표</span>
                </div>
                <div className="p-4">
                  {/* 요일 헤더 */}
                  <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] gap-1 mb-1">
                    <div />
                    {DAYS.map((d) => (
                      <div key={d} className="text-center text-[11.5px] font-medium text-[#6b7280] py-1">
                        {DAY_NAMES[d]}
                      </div>
                    ))}
                  </div>
                  {/* 시간별 행 */}
                  {HOURS.map((hour) => (
                    <div key={hour} className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] gap-1 min-h-[36px]">
                      <div className="text-[10.5px] text-[#9ca3af] flex items-center">{hour}</div>
                      {DAYS.map((day) => {
                        const hasClass = classes.find((c) =>
                          c.schedule.some((s) => s.dayOfWeek === day && s.startTime <= hour && s.endTime > hour),
                        );
                        const isSelected = hasClass?.id === selected.id;
                        return (
                          <div
                            key={day}
                            className={clsx('rounded-[6px] flex items-center justify-center text-[10.5px] font-medium', {
                              'text-white': isSelected || (hasClass && hasClass.id !== selected.id),
                              'bg-[#f4f6f8]': !hasClass,
                            })}
                            style={hasClass ? { backgroundColor: hasClass.color, opacity: isSelected ? 1 : 0.4 } : {}}
                          >
                            {isSelected && hasClass.name.slice(0, 4)}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* 학생 목록 */}
              <div className="bg-white rounded-[10px] border border-[#e2e8f0]">
                <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[#111827]">수강생 목록</span>
                  <Button variant="default" size="sm" onClick={() => toast('학생 추가 기능은 추후 지원 예정입니다.', 'info')}>학생 추가</Button>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {students.filter((s) => s.classes.includes(selected.id)).map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f4f6f8] rounded-[8px]">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ backgroundColor: s.avatarColor }}>
                        {s.name[0]}
                      </span>
                      <span className="text-[12px] text-[#374151]">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 반 추가 모달 */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="반 추가"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setAddOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAddClass}>등록</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">반 이름 *</label>
            <input className={fieldCls} value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 초등수학 기초반" />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">담당 강사</label>
            <input className={fieldCls} value={addForm.teacher} onChange={(e) => setAddForm((f) => ({ ...f, teacher: e.target.value }))} placeholder="예: 김선생" />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">수강료 (원/월)</label>
            <input type="number" className={fieldCls} value={addForm.fee} onChange={(e) => setAddForm((f) => ({ ...f, fee: e.target.value }))} placeholder="예: 280000" />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">강의실</label>
            <input className={fieldCls} value={addForm.room} onChange={(e) => setAddForm((f) => ({ ...f, room: e.target.value }))} placeholder="예: A강의실" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
