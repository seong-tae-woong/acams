'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { useCalendarStore } from '@/lib/stores/calendarStore';
import { useClassStore } from '@/lib/stores/classStore';
import type { CalendarEventType } from '@/lib/types/calendar';

const EVENT_TYPES: CalendarEventType[] = ['학원일정', '상담일정', '보강일정'];

const TYPE_COLOR: Record<CalendarEventType, string> = {
  '학원일정': '#4fc3a1',
  '상담일정': '#6366f1',
  '보강일정': '#8b5cf6',
};

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate: string; // 'YYYY-MM-DD'
}

export default function AddScheduleModal({ open, onClose, defaultDate }: Props) {
  const addEvent = useCalendarStore((s) => s.addEvent);
  const { classes, fetchClasses } = useClassStore();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [type, setType] = useState<CalendarEventType>('학원일정');
  const [isPublic, setIsPublic] = useState(true);
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState<string>(''); // '' = 전체
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (classes.length === 0) fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // type이 상담일정으로 바뀌면 기본적으로 비공개
  useEffect(() => {
    if (type === '상담일정') setIsPublic(false);
    else setIsPublic(true);
  }, [type]);

  // 모달 열릴 때 defaultDate 반영 및 폼 초기화
  useEffect(() => {
    if (open) {
      setTitle('');
      setDate(defaultDate);
      setStartTime('');
      setEndTime('');
      setType('학원일정');
      setIsPublic(true);
      setDescription('');
      setClassId('');
    }
  }, [open, defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setSubmitting(true);
    try {
      await addEvent({
        title: title.trim(),
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        type,
        isPublic,
        description: description.trim(),
        color: TYPE_COLOR[type],
        classId: classId || null,
        relatedStudentId: null,
      });
      onClose();
    } catch {
      // 에러는 store에서 toast로 처리
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] focus:ring-2 focus:ring-[#4fc3a1]/20 transition-colors';
  const labelClass = 'block text-[11.5px] font-medium text-[#374151] mb-1';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="일정 추가"
      size="sm"
      footer={
        <>
          <Button variant="default" size="md" type="button" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="add-schedule-form"
            disabled={submitting || !title.trim() || !date}
          >
            {submitting ? '저장 중...' : '저장'}
          </Button>
        </>
      }
    >
      <form id="add-schedule-form" onSubmit={handleSubmit} className="space-y-3.5">
        {/* 제목 */}
        <div>
          <label className={labelClass}>
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정 제목을 입력하세요"
            required
            className={inputClass}
          />
        </div>

        {/* 일정 종류 */}
        <div>
          <label className={labelClass}>일정 종류</label>
          <div className="flex gap-2">
            {EVENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] border transition-colors cursor-pointer"
                style={
                  type === t
                    ? { backgroundColor: TYPE_COLOR[t], color: '#fff', borderColor: TYPE_COLOR[t] }
                    : { backgroundColor: '#fff', color: '#374151', borderColor: '#e2e8f0' }
                }
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: type === t ? '#fff' : TYPE_COLOR[t] }}
                />
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜 */}
        <div>
          <label className={labelClass}>
            날짜 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        {/* 시간 */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelClass}>시작 시간</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className={labelClass}>종료 시간</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* 대상 반 */}
        <div>
          <label className={labelClass}>대상 반</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={inputClass}
          >
            <option value="">전체 (모든 학생)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-[#9ca3af] mt-1">
            반을 선택하면 해당 반 학생·학부모에게만 표시됩니다.
          </p>
        </div>

        {/* 공개 여부 */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-[#4fc3a1]"
            />
            <span className="text-[12.5px] text-[#374151]">학부모 공개</span>
            <span className="text-[11px] text-[#9ca3af]">(체크 해제 시 원장/강사만 조회)</span>
          </label>
        </div>

        {/* 메모 */}
        <div>
          <label className={labelClass}>메모</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="추가 내용을 입력하세요 (선택)"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
      </form>
    </Modal>
  );
}
