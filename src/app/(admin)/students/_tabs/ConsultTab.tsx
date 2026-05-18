'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import type { Student } from '@/lib/types/student';
import type { ConsultationType } from '@/lib/types/notification';
import type { CalendarEvent } from '@/lib/types/calendar';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';

const CONSULT_TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  '대면': { bg: '#D1FAE5', text: '#065f46' },
  '전화': { bg: '#DBEAFE', text: '#1d4ed8' },
  '온라인': { bg: '#EDE9FE', text: '#5B4FBE' },
};

export default function ConsultTab({ student }: { student: Student }) {
  const { consultations, fetchConsultations, addConsultation } = useCommunicationStore();
  const { teachers, fetchTeachers } = useTeacherStore();

  const EMPTY_CONSULT = {
    date: new Date().toISOString().slice(0, 10),
    time: '10:00',
    duration: 30,
    type: '대면' as ConsultationType,
    teacherId: '',
    topic: '',
    content: '',
    followUp: '',
  };

  const [scheduledConsults, setScheduledConsults] = useState<CalendarEvent[]>([]);
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultForm, setConsultForm] = useState(EMPTY_CONSULT);
  const [consultSaving, setConsultSaving] = useState(false);

  useEffect(() => {
    fetchConsultations();
    if (teachers.length === 0) fetchTeachers();
    fetch(`/api/calendar?studentId=${student.id}`)
      .then((r) => r.json())
      .then((data: CalendarEvent[]) => setScheduledConsults(data))
      .catch(() => setScheduledConsults([]));
  }, [student.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const studentConsults = [...consultations.filter((c) => c.studentId === student.id)]
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleAddConsult = async () => {
    if (!consultForm.topic.trim()) { toast('상담 주제를 입력하세요.', 'error'); return; }
    if (!consultForm.content.trim()) { toast('상담 내용을 입력하세요.', 'error'); return; }
    if (!consultForm.teacherId) { toast('담당 강사를 선택하세요.', 'error'); return; }
    const teacher = teachers.find((t) => t.id === consultForm.teacherId);
    setConsultSaving(true);
    await addConsultation({
      studentId: student.id,
      studentName: student.name,
      parentName: student.parentName,
      teacherId: consultForm.teacherId,
      teacherName: teacher?.name ?? '',
      date: consultForm.date,
      time: consultForm.time,
      duration: consultForm.duration,
      type: consultForm.type,
      topic: consultForm.topic,
      content: consultForm.content,
      followUp: consultForm.followUp,
    });
    setConsultSaving(false);
    setConsultOpen(false);
    setConsultForm(EMPTY_CONSULT);
  };

  return (
    <>
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] font-semibold text-[#111827]">상담 기록</span>
            <span className="text-[11.5px] text-[#9ca3af]">총 {studentConsults.length}건</span>
          </div>
          <Button variant="dark" size="sm" onClick={() => { setConsultForm(EMPTY_CONSULT); setConsultOpen(true); }}>
            + 상담 등록
          </Button>
        </div>
        {/* 캘린더에서 등록된 예정 상담 (완료된 기록이 없는 날짜만) */}
        {scheduledConsults.filter((ev) => !studentConsults.some((c) => c.date === ev.date)).length > 0 && (
          <div className="border-b border-[#e2e8f0]">
            <div className="divide-y divide-[#f1f5f9]">
              {scheduledConsults.filter((ev) => !studentConsults.some((c) => c.date === ev.date)).map((ev) => (
                <div
                  key={ev.id}
                  className="px-4 py-3 hover:bg-[#f9fafb] cursor-pointer flex items-center justify-between group"
                  onClick={() => {
                    setConsultForm({
                      ...EMPTY_CONSULT,
                      date: ev.date,
                      time: ev.startTime ?? '10:00',
                      topic: ev.title,
                    });
                    setConsultOpen(true);
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#6366f1]">예정</span>
                      <span className="text-[11.5px] text-[#6b7280]">{formatKoreanDate(ev.date)}</span>
                      {ev.startTime && <span className="text-[11.5px] text-[#9ca3af]">{ev.startTime}</span>}
                    </div>
                    <div className="text-[12.5px] font-medium text-[#111827]">{ev.title}</div>
                    {ev.description && <div className="text-[12px] text-[#9ca3af] mt-0.5">{ev.description}</div>}
                  </div>
                  <span className="text-[11px] text-[#4fc3a1] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">기록 작성 →</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 완료된 상담 기록 */}
        {studentConsults.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-[#9ca3af]">상담 기록이 없습니다.</div>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {studentConsults.map((c) => {
              const typeStyle = CONSULT_TYPE_STYLE[c.type] ?? { bg: '#f3f4f6', text: '#374151' };
              return (
                <div key={c.id} className="px-4 py-3 hover:bg-[#f9fafb]">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
                    >
                      {c.type}
                    </span>
                    <span className="text-[11.5px] text-[#6b7280]">{formatKoreanDate(c.date)}</span>
                    {c.teacherName && <span className="text-[11.5px] text-[#9ca3af]">· {c.teacherName}</span>}
                  </div>
                  <div className="text-[12.5px] font-medium text-[#111827] mb-0.5">{c.topic}</div>
                  {c.content && <div className="text-[12px] text-[#6b7280] line-clamp-2">{c.content}</div>}
                  {c.followUp && (
                    <div className="mt-1 text-[11.5px] text-[#9ca3af]">
                      <span className="font-medium text-[#6b7280]">목표/건의</span> · {c.followUp}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 상담 등록 모달 */}
      <Modal
        open={consultOpen}
        onClose={() => setConsultOpen(false)}
        title="상담 등록"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setConsultOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAddConsult} disabled={consultSaving}>
              {consultSaving ? '저장 중...' : '등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 날짜 / 시간 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11.5px] font-medium text-[#374151] mb-1">날짜</label>
              <input
                type="date"
                value={consultForm.date}
                onChange={(e) => setConsultForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11.5px] font-medium text-[#374151] mb-1">시간</label>
              <input
                type="time"
                value={consultForm.time}
                onChange={(e) => setConsultForm((f) => ({ ...f, time: e.target.value }))}
                className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
              />
            </div>
          </div>

          {/* 유형 / 소요시간 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11.5px] font-medium text-[#374151] mb-1">상담 유형</label>
              <select
                value={consultForm.type}
                onChange={(e) => setConsultForm((f) => ({ ...f, type: e.target.value as ConsultationType }))}
                className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
              >
                <option value="대면">대면</option>
                <option value="전화">전화</option>
                <option value="온라인">온라인</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[11.5px] font-medium text-[#374151] mb-1">소요시간 (분)</label>
              <input
                type="number"
                min={5}
                step={5}
                value={consultForm.duration}
                onChange={(e) => setConsultForm((f) => ({ ...f, duration: Number(e.target.value) }))}
                className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
              />
            </div>
          </div>

          {/* 담당 강사 */}
          <div>
            <label className="block text-[11.5px] font-medium text-[#374151] mb-1">담당 강사</label>
            <select
              value={consultForm.teacherId}
              onChange={(e) => setConsultForm((f) => ({ ...f, teacherId: e.target.value }))}
              className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] focus:outline-none focus:border-[#4fc3a1]"
            >
              <option value="">강사 선택</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* 상담 주제 */}
          <div>
            <label className="block text-[11.5px] font-medium text-[#374151] mb-1">상담 주제 <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder="예) 수학 성적 하락 관련"
              value={consultForm.topic}
              onChange={(e) => setConsultForm((f) => ({ ...f, topic: e.target.value }))}
              className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:border-[#4fc3a1]"
            />
          </div>

          {/* 상담 내용 */}
          <div>
            <label className="block text-[11.5px] font-medium text-[#374151] mb-1">상담 내용 <span className="text-red-400">*</span></label>
            <textarea
              rows={4}
              placeholder="상담에서 나눈 주요 내용을 기록하세요."
              value={consultForm.content}
              onChange={(e) => setConsultForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:border-[#4fc3a1] resize-none"
            />
          </div>

          {/* 목표 및 건의사항 */}
          <div>
            <label className="block text-[11.5px] font-medium text-[#374151] mb-1">목표 및 건의사항</label>
            <textarea
              rows={3}
              placeholder="상담 후 설정한 목표, 학부모 건의사항 등을 입력하세요."
              value={consultForm.followUp}
              onChange={(e) => setConsultForm((f) => ({ ...f, followUp: e.target.value }))}
              className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[12.5px] text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:border-[#4fc3a1] resize-none"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
