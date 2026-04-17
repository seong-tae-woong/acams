'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { StudentStatus } from '@/lib/types/student';
import { formatKoreanDate } from '@/lib/utils/format';
import { Plus, MessageSquare } from 'lucide-react';
import clsx from 'clsx';

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  '대면': { bg: '#D1FAE5', text: '#065f46' },
  '전화': { bg: '#DBEAFE', text: '#1d4ed8' },
  '온라인': { bg: '#EDE9FE', text: '#5B4FBE' },
};

export default function ConsultationPage() {
  const { consultations } = useCommunicationStore();
  const { students } = useStudentStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedConsultId, setSelectedConsultId] = useState<string | null>(null);

  const activeStudents = students.filter((s) => s.status !== StudentStatus.WITHDRAWN);
  const studentConsults = consultations
    .filter((c) => c.studentId === selectedStudentId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const selectedConsult = consultations.find((c) => c.id === selectedConsultId);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="상담 기록 관리"
        badge={`총 ${consultations.length}건`}
        actions={<Button variant="dark" size="sm"><Plus size={13} /> 상담 등록</Button>}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 패널 1: 학생 목록 */}
        <div className="w-44 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          <div className="p-2 pt-3 px-3 text-[10.5px] text-[#9ca3af] uppercase font-medium">학생</div>
          {activeStudents.map((s) => {
            const count = consultations.filter((c) => c.studentId === s.id).length;
            return (
              <button
                key={s.id}
                onClick={() => { setSelectedStudentId(s.id); setSelectedConsultId(null); }}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[#f1f5f9] text-left cursor-pointer transition-colors',
                  selectedStudentId === s.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                )}
              >
                <Avatar name={s.name} color={s.avatarColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-[#111827] truncate">{s.name}</div>
                  {count > 0 && <div className="text-[10.5px] text-[#9ca3af]">{count}건</div>}
                </div>
              </button>
            );
          })}
        </div>

        {/* 패널 2: 상담 이력 */}
        <div className="w-64 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {selectedStudentId ? (
            <>
              <div className="p-3 border-b border-[#e2e8f0] text-[11.5px] font-semibold text-[#374151]">
                상담 이력 ({studentConsults.length}건)
              </div>
              {studentConsults.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-[#9ca3af]">상담 기록 없음</div>
              ) : (
                <div className="divide-y divide-[#f1f5f9]">
                  {studentConsults.map((c) => {
                    const ts = TYPE_STYLE[c.type] ?? { bg: '#f1f5f9', text: '#374151' };
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedConsultId(c.id)}
                        className={clsx(
                          'w-full text-left px-3 py-3 transition-colors cursor-pointer',
                          selectedConsultId === c.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                        )}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10.5px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: ts.bg, color: ts.text }}>
                            {c.type}
                          </span>
                          <span className="text-[11px] text-[#9ca3af]">{formatKoreanDate(c.date)}</span>
                        </div>
                        <div className="text-[12.5px] font-medium text-[#111827]">{c.topic}</div>
                        <div className="text-[11.5px] text-[#6b7280] mt-0.5">{c.teacherName} · {c.duration}분</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[12px] text-[#9ca3af]">학생을 선택하세요</p>
            </div>
          )}
        </div>

        {/* 패널 3: 상담 상세 */}
        <div className="flex-1 overflow-y-auto">
          {selectedConsult ? (
            <div className="p-5 space-y-4">
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-[#4fc3a1]" />
                    <span className="text-[14px] font-bold text-[#111827]">{selectedConsult.topic}</span>
                  </div>
                  <Button variant="default" size="sm">수정</Button>
                </div>
                <div className="grid grid-cols-3 gap-4 text-[12px] mb-4">
                  <div>
                    <div className="text-[#6b7280] mb-0.5">날짜/시간</div>
                    <div className="font-medium text-[#111827]">{formatKoreanDate(selectedConsult.date)} {selectedConsult.time}</div>
                  </div>
                  <div>
                    <div className="text-[#6b7280] mb-0.5">방법 / 시간</div>
                    <div className="font-medium text-[#111827]">{selectedConsult.type} · {selectedConsult.duration}분</div>
                  </div>
                  <div>
                    <div className="text-[#6b7280] mb-0.5">상담 교사</div>
                    <div className="font-medium text-[#111827]">{selectedConsult.teacherName}</div>
                  </div>
                  <div>
                    <div className="text-[#6b7280] mb-0.5">학생</div>
                    <div className="font-medium text-[#111827]">{selectedConsult.studentName}</div>
                  </div>
                  <div>
                    <div className="text-[#6b7280] mb-0.5">학부모</div>
                    <div className="font-medium text-[#111827]">{selectedConsult.parentName}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[11.5px] text-[#6b7280] mb-1">상담 내용</div>
                    <div className="bg-[#f4f6f8] rounded-[8px] p-3 text-[12.5px] text-[#374151] leading-relaxed">
                      {selectedConsult.content}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11.5px] text-[#6b7280] mb-1">후속 조치</div>
                    <div className="bg-[#E1F5EE] rounded-[8px] p-3 text-[12.5px] text-[#065f46] leading-relaxed">
                      {selectedConsult.followUp || '없음'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[13px] text-[#9ca3af]">상담 기록을 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
