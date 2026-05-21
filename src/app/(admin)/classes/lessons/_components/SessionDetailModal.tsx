'use client';
import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import Button from '@/components/shared/Button';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useLessonStore } from '@/lib/stores/lessonStore';
import { StudentStatus } from '@/lib/types/student';
import clsx from 'clsx';
import type { LessonSession } from '@/lib/types/lesson';
import CommentClinicPanel from './CommentClinicPanel';

interface SessionDetailModalProps {
  open: boolean;
  onClose: () => void;
  session: LessonSession;
}

export default function SessionDetailModal({ open, onClose, session }: SessionDetailModalProps) {
  const { students } = useStudentStore();
  const { comments, clinicResults, getCommentFor } = useLessonStore();

  const classStudents = useMemo(
    () =>
      students.filter(
        (s) => s.classes.includes(session.classId) && s.status === StudentStatus.ACTIVE,
      ),
    [students, session.classId],
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // 첫 학생 자동 선택
  useEffect(() => {
    if (open && !selectedStudentId && classStudents.length > 0) {
      setSelectedStudentId(classStudents[0].id);
    }
  }, [open, selectedStudentId, classStudents]);

  if (!open) return null;

  const dateLabel = new Date(`${session.date}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[820px] mx-4 bg-white rounded-[10px] shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
          <div>
            <div className="text-[14px] font-semibold text-[#111827]">
              {session.className} <span className="text-[12px] text-[#6b7280] ml-2">{session.startTime}~{session.endTime}</span>
              {session.isOneTime && <span className="ml-2 text-[11px] text-[#f59e0b]">(보강)</span>}
            </div>
            <div className="text-[12px] text-[#6b7280] mt-0.5">{dateLabel}</div>
          </div>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#374151] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 학생 목록 */}
          <div className="w-[200px] border-r border-[#e2e8f0] overflow-y-auto">
            {classStudents.length === 0 ? (
              <div className="p-4 text-[12px] text-[#9ca3af]">수강 학생 없음</div>
            ) : (
              classStudents.map((s) => {
                const hasComment = !!getCommentFor(session.classId, s.id, session.date)?.comment;
                const hasClinic = clinicResults.some(
                  (r) => r.studentId === s.id && r.sessionDate === session.date,
                );
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentId(s.id)}
                    className={clsx(
                      'w-full text-left px-4 py-2.5 text-[12.5px] border-b border-[#f1f5f9] flex items-center justify-between cursor-pointer',
                      selectedStudentId === s.id
                        ? 'bg-[#eef2ff] text-[#1a2535] font-medium'
                        : 'text-[#374151] hover:bg-[#f9fafb]',
                    )}
                  >
                    <span>{s.name}</span>
                    <span className="flex gap-1">
                      {hasComment && <span className="w-1.5 h-1.5 rounded-full bg-[#4fc3a1]" title="코멘트 있음" />}
                      {hasClinic && <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" title="Clinic 있음" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* 입력 영역 — 공용 패널 */}
          <div className="flex-1 overflow-y-auto p-5">
            <CommentClinicPanel
              scope={{ kind: 'lesson', classId: session.classId, sessionDate: session.date }}
              selectedStudentId={selectedStudentId || null}
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#e2e8f0] flex justify-end">
          <Button variant="default" size="sm" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}
