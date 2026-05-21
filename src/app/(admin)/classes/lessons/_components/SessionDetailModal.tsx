'use client';
import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import Button from '@/components/shared/Button';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useLessonStore } from '@/lib/stores/lessonStore';
import { StudentStatus } from '@/lib/types/student';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import type { LessonSession, ClinicCheck } from '@/lib/types/lesson';

interface SessionDetailModalProps {
  open: boolean;
  onClose: () => void;
  session: LessonSession;
}

export default function SessionDetailModal({ open, onClose, session }: SessionDetailModalProps) {
  const { students } = useStudentStore();
  const {
    templates,
    comments,
    clinicResults,
    fetchComments,
    upsertComment,
    fetchClinicResults,
    upsertClinicResult,
    getCommentFor,
    getClinicResultFor,
  } = useLessonStore();

  const classStudents = useMemo(
    () =>
      students.filter(
        (s) => s.classes.includes(session.classId) && s.status === StudentStatus.ACTIVE,
      ),
    [students, session.classId],
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [commentText, setCommentText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [localChecks, setLocalChecks] = useState<ClinicCheck[]>([]);
  const [saving, setSaving] = useState(false);

  // 모달 오픈 시 데이터 fetch
  useEffect(() => {
    if (!open) return;
    fetchComments(session.classId, session.date).catch(() => {});
    fetchClinicResults(session.classId, session.date).catch(() => {});
  }, [open, session.classId, session.date, fetchComments, fetchClinicResults]);

  // 학생 선택 시 첫 학생 자동 지정
  useEffect(() => {
    if (open && !selectedStudentId && classStudents.length > 0) {
      setSelectedStudentId(classStudents[0].id);
    }
  }, [open, selectedStudentId, classStudents]);

  // 양식 1개라도 있으면 첫 양식 자동 선택
  useEffect(() => {
    if (open && !selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [open, selectedTemplateId, templates]);

  // 학생 또는 양식 변경 시 입력 영역 동기화
  useEffect(() => {
    if (!selectedStudentId) {
      setCommentText('');
      setLocalChecks([]);
      return;
    }
    const c = getCommentFor(session.classId, selectedStudentId, session.date);
    setCommentText(c?.comment ?? '');
  }, [selectedStudentId, session.classId, session.date, comments, getCommentFor]);

  useEffect(() => {
    if (!selectedStudentId || !selectedTemplateId) {
      setLocalChecks([]);
      return;
    }
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;
    const existing = getClinicResultFor(
      session.classId,
      selectedStudentId,
      session.date,
      selectedTemplateId,
    );
    if (existing) {
      setLocalChecks(existing.checks);
    } else {
      // 양식 항목 기준으로 초기화 (모두 unchecked)
      setLocalChecks(tmpl.items.map((it) => ({ itemId: it.id, checked: false })));
    }
  }, [
    selectedStudentId,
    selectedTemplateId,
    session.classId,
    session.date,
    templates,
    clinicResults,
    getClinicResultFor,
  ]);

  const toggleCheck = (itemId: string) => {
    setLocalChecks((prev) => {
      const idx = prev.findIndex((c) => c.itemId === itemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { itemId, checked: !next[idx].checked };
        return next;
      }
      return [...prev, { itemId, checked: true }];
    });
  };

  const currentTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleSave = async () => {
    if (!selectedStudentId) {
      toast('학생을 선택해 주세요.', 'error');
      return;
    }
    setSaving(true);
    try {
      // Comment 저장 (빈 문자열도 저장 — 사용자가 의도적으로 지운 경우)
      await upsertComment({
        classId: session.classId,
        studentId: selectedStudentId,
        sessionDate: session.date,
        comment: commentText,
      });

      // Clinic 결과 저장 (양식이 선택된 경우)
      if (selectedTemplateId && currentTemplate) {
        await upsertClinicResult({
          classId: session.classId,
          studentId: selectedStudentId,
          sessionDate: session.date,
          templateId: selectedTemplateId,
          checks: localChecks,
        });
      }

      toast('저장되었습니다.', 'success');
    } catch {
      toast('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

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

          {/* 입력 영역 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!selectedStudentId ? (
              <div className="text-[13px] text-[#9ca3af]">학생을 선택해 주세요.</div>
            ) : (
              <>
                {/* Comment */}
                <div>
                  <label className="block text-[12px] font-semibold text-[#111827] mb-1.5">
                    수업 코멘트
                  </label>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={4}
                    placeholder="수업 중 관찰한 내용, 학습 코멘트 등을 입력하세요."
                    className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] resize-none"
                  />
                </div>

                {/* Clinic */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] font-semibold text-[#111827]">Clinic 체크리스트</label>
                    {templates.length > 0 && (
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="text-[12px] border border-[#e2e8f0] rounded-[8px] px-2 py-1 focus:outline-none focus:border-[#4fc3a1]"
                      >
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {templates.length === 0 ? (
                    <div className="text-[12px] text-[#9ca3af] py-3 px-3 bg-[#f9fafb] rounded-[8px]">
                      등록된 Clinic 양식이 없습니다. 우측 상단 "Clinic 양식 관리" 버튼으로 양식을 먼저 만들어 주세요.
                    </div>
                  ) : !currentTemplate ? null : currentTemplate.items.length === 0 ? (
                    <div className="text-[12px] text-[#9ca3af] py-3 px-3 bg-[#f9fafb] rounded-[8px]">
                      이 양식에는 항목이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-1.5 border border-[#e2e8f0] rounded-[8px] p-3">
                      {[...currentTemplate.items]
                        .sort((a, b) => a.order - b.order)
                        .map((item) => {
                          const checked = localChecks.find((c) => c.itemId === item.id)?.checked ?? false;
                          return (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 text-[12.5px] text-[#374151] cursor-pointer hover:bg-[#f9fafb] px-1.5 py-1 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCheck(item.id)}
                                className="cursor-pointer accent-[#4fc3a1]"
                              />
                              <span>{item.label}</span>
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#e2e8f0] flex justify-end gap-2">
          <Button variant="default" size="sm" onClick={onClose}>닫기</Button>
          <Button
            variant="dark"
            size="sm"
            onClick={handleSave}
            disabled={saving || !selectedStudentId}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
