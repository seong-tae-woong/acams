'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { mockMakeupClasses } from '@/lib/mock/calendar';
import { mockStudents } from '@/lib/mock/students';
import { useClassStore } from '@/lib/stores/classStore';
import { formatKoreanDate } from '@/lib/utils/format';
import { Plus, CheckCheck } from 'lucide-react';
import clsx from 'clsx';

export default function MakeupPage() {
  const { classes } = useClassStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const selected = mockMakeupClasses.find((m) => m.id === selectedId);
  const targetStudents = selected
    ? mockStudents.filter((s) => selected.targetStudents.includes(s.id))
    : [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="보강 수업 관리"
        badge={`${mockMakeupClasses.length}건`}
        actions={<Button variant="dark" size="sm"><Plus size={13} /> 보강 등록</Button>}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 보강 목록 */}
        <div className="w-64 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          <div className="p-2 space-y-1">
            {mockMakeupClasses.map((mc) => {
              const cls = classes.find((c) => c.id === mc.originalClassId);
              return (
                <button
                  key={mc.id}
                  onClick={() => setSelectedId(mc.id)}
                  className={clsx(
                    'w-full px-3 py-3 rounded-[8px] text-left transition-colors cursor-pointer',
                    selectedId === mc.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls?.color ?? '#ccc' }} />
                    <span className="text-[12.5px] font-medium text-[#111827]">{mc.originalClassName}</span>
                  </div>
                  <div className="text-[11.5px] text-[#6b7280] ml-4">
                    보강일: {formatKoreanDate(mc.makeupDate)} {mc.makeupTime}
                  </div>
                  <div className="text-[11px] text-[#9ca3af] ml-4 mt-0.5">
                    원래 수업: {formatKoreanDate(mc.originalDate)}
                  </div>
                  <div className="ml-4 mt-1.5">
                    <span className={clsx(
                      'px-2 py-0.5 rounded-[20px] text-[10.5px] font-medium',
                      mc.attendanceChecked
                        ? 'bg-[#D1FAE5] text-[#065f46]'
                        : 'bg-[#FEF3C7] text-[#92400E]',
                    )}>
                      {mc.attendanceChecked ? '출결 완료' : '출결 미확인'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우측: 보강 상세 */}
        {selected ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 보강 정보 카드 */}
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[14px] font-bold text-[#111827]">{selected.originalClassName} 보강</span>
                <Button variant="default" size="sm">수정</Button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-[12px]">
                <div>
                  <div className="text-[#6b7280] mb-0.5">원래 수업일</div>
                  <div className="font-medium text-[#111827]">{formatKoreanDate(selected.originalDate)}</div>
                </div>
                <div>
                  <div className="text-[#6b7280] mb-0.5">보강 일시</div>
                  <div className="font-medium text-[#111827]">{formatKoreanDate(selected.makeupDate)} {selected.makeupTime}</div>
                </div>
                <div>
                  <div className="text-[#6b7280] mb-0.5">담당 강사</div>
                  <div className="font-medium text-[#111827]">{selected.teacherName}</div>
                </div>
                <div>
                  <div className="text-[#6b7280] mb-0.5">보강 사유</div>
                  <div className="font-medium text-[#111827]">{selected.reason}</div>
                </div>
                <div>
                  <div className="text-[#6b7280] mb-0.5">대상 학생</div>
                  <div className="font-medium text-[#111827]">{selected.targetStudents.length}명</div>
                </div>
                <div>
                  <div className="text-[#6b7280] mb-0.5">출결 상태</div>
                  <div className={clsx(
                    'font-medium',
                    selected.attendanceChecked ? 'text-[#065f46]' : 'text-[#92400E]',
                  )}>
                    {selected.attendanceChecked ? '완료' : '미입력'}
                  </div>
                </div>
              </div>
            </div>

            {/* 출결 입력 */}
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-[#111827]">대상 학생 출결</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    targetStudents.forEach((s) => { all[s.id] = true; });
                    setChecked(all);
                  }}
                >
                  <CheckCheck size={13} /> 전체 출석
                </Button>
              </div>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-[#f4f6f8]">
                    <th className="text-left px-5 py-2.5 text-[#6b7280] font-medium">이름</th>
                    <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">출석</th>
                    <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">결석</th>
                    <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {targetStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-[#f9fafb]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ backgroundColor: s.avatarColor }}>
                            {s.name[0]}
                          </span>
                          <span className="font-medium text-[#111827]">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name={`makeup-${s.id}`}
                            checked={checked[s.id] === true}
                            onChange={() => setChecked((prev) => ({ ...prev, [s.id]: true }))}
                            className="sr-only"
                          />
                          <span
                            className={clsx(
                              'px-3 py-1 rounded-[20px] text-[11.5px] font-medium cursor-pointer transition-all',
                              checked[s.id] === true
                                ? 'bg-[#065f46] text-white'
                                : 'bg-[#f1f5f9] text-[#9ca3af] hover:bg-[#e2e8f0]',
                            )}
                            onClick={() => setChecked((prev) => ({ ...prev, [s.id]: true }))}
                          >
                            출석
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name={`makeup-${s.id}`}
                            checked={checked[s.id] === false}
                            onChange={() => setChecked((prev) => ({ ...prev, [s.id]: false }))}
                            className="sr-only"
                          />
                          <span
                            className={clsx(
                              'px-3 py-1 rounded-[20px] text-[11.5px] font-medium cursor-pointer transition-all',
                              checked[s.id] === false
                                ? 'bg-[#991B1B] text-white'
                                : 'bg-[#f1f5f9] text-[#9ca3af] hover:bg-[#e2e8f0]',
                            )}
                            onClick={() => setChecked((prev) => ({ ...prev, [s.id]: false }))}
                          >
                            결석
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="메모"
                          className="w-full text-[12px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 focus:outline-none focus:border-[#4fc3a1]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-[#e2e8f0] flex justify-end">
                <Button variant="dark" size="md" onClick={() => alert('보강 출결이 저장되었습니다.')}>
                  출결 저장
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
            <p className="text-[13px] text-[#9ca3af]">좌측에서 보강 수업을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
