'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { useCalendarStore } from '@/lib/stores/calendarStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import type { CalendarEvent, CalendarEventType } from '@/lib/types/calendar';

// '수업'은 반 시간표 파생 일정이라 직접 추가할 수 없음 — 선택지에서 제외
const EVENT_TYPES: CalendarEventType[] = ['학원일정', '상담일정', '보강일정'];

const TYPE_COLOR: Record<CalendarEventType, string> = {
  '학원일정': '#4fc3a1',
  '상담일정': '#6366f1',
  '보강일정': '#8b5cf6',
  '수업': '#3b82f6',
};

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate: string; // 'YYYY-MM-DD'
  editEvent?: CalendarEvent | null; // 수정 모드
}

export default function AddScheduleModal({ open, onClose, defaultDate, editEvent }: Props) {
  const { addEvent, updateEvent } = useCalendarStore();
  const { classes, fetchClasses } = useClassStore();
  const { students, fetchStudents } = useStudentStore();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [type, setType] = useState<CalendarEventType>('학원일정');
  const [isPublic, setIsPublic] = useState(true);
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState<string>(''); // '' = 전체
  const [relatedStudentId, setRelatedStudentId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (classes.length === 0) fetchClasses();
    if (students.length === 0) fetchStudents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // type이 상담일정으로 바뀌면 기본적으로 비공개
  useEffect(() => {
    if (type === '상담일정') setIsPublic(false);
    else setIsPublic(true);
  }, [type]);

  // 모달 열릴 때 폼 초기화 (수정 모드면 기존 값으로)
  useEffect(() => {
    if (open) {
      if (editEvent) {
        setTitle(editEvent.title);
        setDate(editEvent.date);
        setStartTime(editEvent.startTime ?? '');
        setEndTime(editEvent.endTime ?? '');
        setType(editEvent.type);
        setIsPublic(editEvent.isPublic);
        setDescription(editEvent.description ?? '');
        setClassId(editEvent.classId ?? '');
        setRelatedStudentId(editEvent.relatedStudentId ?? '');
        // 수정 모드에서 학생 이름 표시
        if (editEvent.relatedStudentId) {
          const s = students.find((st) => st.id === editEvent.relatedStudentId);
          setStudentSearch(s?.name ?? '');
        } else {
          setStudentSearch('');
        }
      } else {
        setTitle('');
        setDate(defaultDate);
        setStartTime('');
        setEndTime('');
        setType('학원일정');
        setIsPublic(true);
        setDescription('');
        setClassId('');
        setRelatedStudentId('');
        setStudentSearch('');
      }
    }
  }, [open, defaultDate, editEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        type,
        isPublic,
        description: description.trim(),
        color: TYPE_COLOR[type],
        classId: classId || null,
        relatedStudentId: relatedStudentId || null,
      };
      if (editEvent) {
        await updateEvent(editEvent.id, payload);
      } else {
        await addEvent(payload);
      }
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
      title={editEvent ? '일정 수정' : '일정 추가'}
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
            {submitting ? '저장 중...' : editEvent ? '수정' : '저장'}
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

        {/* 상담 대상 학생 (상담일정일 때만) */}
        {type === '상담일정' && (
          <div>
            <label className={labelClass}>대상 학생</label>
            <input
              type="text"
              placeholder="이름으로 검색"
              value={studentSearch}
              onChange={(e) => { setStudentSearch(e.target.value); setRelatedStudentId(''); }}
              className={inputClass}
            />
            {studentSearch && !relatedStudentId && (
              <div className="mt-1 border border-[#e2e8f0] rounded-[8px] max-h-36 overflow-y-auto bg-white shadow-sm">
                {students
                  .filter((s) => s.name.includes(studentSearch) || s.school.includes(studentSearch))
                  .slice(0, 8)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#f4f6f8] flex items-center justify-between"
                      onClick={() => { setRelatedStudentId(s.id); setStudentSearch(s.name); }}
                    >
                      <span className="font-medium text-[#111827]">{s.name}</span>
                      <span className="text-[11px] text-[#9ca3af]">{s.school} {s.grade}학년</span>
                    </button>
                  ))}
                {students.filter((s) => s.name.includes(studentSearch) || s.school.includes(studentSearch)).length === 0 && (
                  <p className="px-3 py-2 text-[12px] text-[#9ca3af]">검색 결과가 없습니다.</p>
                )}
              </div>
            )}
            {relatedStudentId && (
              <p className="mt-1 text-[11.5px] text-[#4fc3a1]">
                ✓ {studentSearch} 학생이 선택되었습니다.
              </p>
            )}
          </div>
        )}

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
