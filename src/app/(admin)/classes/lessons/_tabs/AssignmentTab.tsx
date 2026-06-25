'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import Tabs from '@/components/shared/Tabs';
import { useClassStore } from '@/lib/stores/classStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { DAY_NAMES } from '@/lib/types/class';
import clsx from 'clsx';
import ClassSelector from '../_components/ClassSelector';
import {
  type Assignment, type AssignmentForm, type MainTab,
  EMPTY_ASSIGNMENT_FORM, fieldClass, TAB_OPTIONS,
} from '../_shared';

interface AssignmentTabProps {
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  mainTab: MainTab;
  setMainTab: (t: MainTab) => void;
}

export default function AssignmentTab({ selectedClassId, setSelectedClassId, mainTab, setMainTab }: AssignmentTabProps) {
  const { classes } = useClassStore();
  const { setSelectedExam } = useGradeStore();

  // 과제 상태
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  // 월 필터 + 검색
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()); // 0-based
  const [search, setSearch] = useState('');

  const [assignmentFormOpen, setAssignmentFormOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(EMPTY_ASSIGNMENT_FORM);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false);
  const [useScheduleDate, setUseScheduleDate] = useState(false);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // 과제 목록 로드 (선택 월의 출제일 범위)
  const loadAssignments = useCallback(async (classId: string, year: number, month: number) => {
    if (!classId) return;
    setAssignmentLoading(true);
    try {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const res = await fetch(`/api/assignments?classId=${classId}&from=${from}&to=${to}`);
      if (!res.ok) throw new Error('과제 목록을 불러올 수 없습니다.');
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadAssignments(selectedClassId, calYear, calMonth);
    }
  }, [selectedClassId, calYear, calMonth, loadAssignments]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1);
  };

  // 검색(과제 내용) 필터 — 선택 월 데이터 안에서
  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => (a.memo || '').toLowerCase().includes(q));
  }, [assignments, search]);

  // 선택된 반의 시간표
  const scheduleDates = useMemo(() => {
    if (!selectedClassId) return [] as { date: string; label: string }[];
    const cls = classes.find((c) => c.id === selectedClassId);
    if (!cls) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out: { date: string; label: string }[] = [];
    // 오늘부터 60일치 시간표 날짜 후보
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      const slot = cls.schedule.find((s) => s.dayOfWeek === dow);
      if (slot) {
        const iso = d.toISOString().slice(0, 10);
        out.push({ date: iso, label: `${iso} (${DAY_NAMES[dow]} ${slot.startTime}~${slot.endTime})` });
      }
    }
    return out;
  }, [selectedClassId, classes]);

  const openCreateAssignmentModal = () => {
    setEditingAssignmentId(null);
    setAssignmentForm(EMPTY_ASSIGNMENT_FORM);
    setUseScheduleDate(false);
    setAssignmentFormOpen(true);
  };

  const openEditAssignmentModal = (a: Assignment) => {
    setEditingAssignmentId(a.id);
    setAssignmentForm({ date: a.date, dueDate: a.dueDate, memo: a.memo });
    setUseScheduleDate(false);
    setAssignmentFormOpen(true);
  };

  const handleSubmitAssignment = async () => {
    if (!selectedClassId) { toast('반을 선택해주세요.', 'error'); return; }
    if (!assignmentForm.date) { toast('과제 일자를 입력해주세요.', 'error'); return; }
    if (!assignmentForm.dueDate) { toast('납기일을 입력해주세요.', 'error'); return; }
    if (assignmentForm.dueDate < assignmentForm.date) {
      toast('납기일은 과제 일자 이후여야 합니다.', 'error'); return;
    }
    setAssignmentSubmitting(true);
    try {
      if (editingAssignmentId) {
        const res = await fetch(`/api/assignments/${editingAssignmentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assignmentForm),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? '저장 실패');
        toast('과제가 수정되었습니다.', 'success');
      } else {
        const res = await fetch('/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classId: selectedClassId, ...assignmentForm }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? '저장 실패');
        toast('과제가 등록되었습니다.', 'success');
      }
      setAssignmentFormOpen(false);
      setEditingAssignmentId(null);
      // 등록/수정한 과제의 출제일 달로 이동(다른 달이면)해 결과를 바로 노출
      const d = new Date(`${assignmentForm.date}T00:00:00`);
      const ty = d.getFullYear();
      const tm = d.getMonth();
      setAssignmentForm(EMPTY_ASSIGNMENT_FORM);
      if (!Number.isNaN(ty) && (ty !== calYear || tm !== calMonth)) {
        setCalYear(ty);
        setCalMonth(tm); // useEffect가 해당 월 로드
      } else {
        await loadAssignments(selectedClassId, calYear, calMonth);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setAssignmentSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm('과제를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      toast('과제가 삭제되었습니다.', 'success');
      await loadAssignments(selectedClassId, calYear, calMonth);
    } catch {
      toast('삭제에 실패했습니다.', 'error');
    }
  };

  return (
    <>
      <Topbar
        title="수업 관리"
        actions={
          <div className="flex gap-2">
            <Button variant="dark" size="sm" onClick={openCreateAssignmentModal}>
              <Plus size={13} /> 과제 등록
            </Button>
          </div>
        }
      />
      <div className="px-5 pt-3 bg-white">
        <Tabs
          tabs={TAB_OPTIONS}
          value={mainTab}
          onChange={(v) => setMainTab(v as MainTab)}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 반 선택 */}
        <ClassSelector
          classes={classes}
          selectedClassId={selectedClassId}
          onSelect={(id) => {
            setSelectedClassId(id);
            setSelectedExam(null);
          }}
        />

        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12.5px] font-semibold text-[#111827]">
                과제 목록 {selectedClass ? `· ${selectedClass.name}` : ''}
              </span>
              {/* 월 네비게이션 */}
              <div className="flex items-center gap-0.5 ml-1">
                <button onClick={prevMonth} className="p-1 rounded hover:bg-[#f4f6f8] cursor-pointer" title="이전 달">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[12px] font-medium text-[#374151] tabular-nums min-w-[68px] text-center">
                  {calYear}년 {calMonth + 1}월
                </span>
                <button onClick={nextMonth} className="p-1 rounded hover:bg-[#f4f6f8] cursor-pointer" title="다음 달">
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => { const t = new Date(); setCalYear(t.getFullYear()); setCalMonth(t.getMonth()); }}
                  className="px-2 text-[11px] text-[#6b7280] hover:text-[#111827] cursor-pointer"
                >
                  오늘
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="과제 내용 검색"
                  className="text-[12px] border border-[#e2e8f0] rounded-[8px] pl-7 pr-2.5 py-1 w-44 focus:outline-none focus:border-[#4fc3a1]"
                />
              </div>
              <span className="text-[11px] text-[#9ca3af] tabular-nums">{filteredAssignments.length}건</span>
            </div>
          </div>
          {assignmentLoading ? (
            <LoadingSpinner size="inline" />
          ) : !selectedClassId ? (
            <div className="p-8 text-center text-[12.5px] text-[#9ca3af]">반을 선택해주세요.</div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-8 text-center text-[12.5px] text-[#9ca3af]">
              {search.trim() ? '검색 결과가 없습니다.' : `${calYear}년 ${calMonth + 1}월에 등록된 과제가 없습니다.`}
            </div>
          ) : (
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#f4f6f8]">
                  <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium w-32">출제일</th>
                  <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium w-32">납기일</th>
                  <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">과제 내용</th>
                  <th className="px-4 py-2.5 text-[#6b7280] font-medium w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredAssignments.map((a) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const overdue = a.dueDate < today;
                  return (
                    <tr key={a.id} className={clsx('hover:bg-[#f4f6f8]', overdue && 'opacity-60')}>
                      <td className="px-4 py-3 text-[#111827]">{a.date}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('font-medium', overdue ? 'text-[#9ca3af]' : 'text-[#111827]')}>
                          {a.dueDate}
                        </span>
                        {overdue && <span className="ml-2 text-[10.5px] text-[#9ca3af]">(마감)</span>}
                      </td>
                      <td className="px-4 py-3 text-[#374151] whitespace-pre-wrap">
                        {a.memo || <span className="text-[#9ca3af]">(메모 없음)</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEditAssignmentModal(a)}
                          className="text-[#9ca3af] hover:text-[#4fc3a1] cursor-pointer mr-2"
                          title="수정"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(a.id)}
                          className="text-[#9ca3af] hover:text-[#ef4444] cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* 과제 등록/수정 모달 */}
      <Modal
        open={assignmentFormOpen}
        onClose={() => { setAssignmentFormOpen(false); setEditingAssignmentId(null); }}
        title={editingAssignmentId ? '과제 수정' : '과제 등록'}
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => { setAssignmentFormOpen(false); setEditingAssignmentId(null); }}>취소</Button>
            <Button variant="dark" size="md" onClick={handleSubmitAssignment} disabled={assignmentSubmitting}>
              {assignmentSubmitting ? '저장 중...' : editingAssignmentId ? '수정' : '등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-[12px] text-[#6b7280] bg-[#f4f6f8] rounded-[8px] px-3 py-2">
            반: <span className="font-medium text-[#111827]">{selectedClass?.name ?? '-'}</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11.5px] text-[#6b7280]">과제 일자 *</label>
              {scheduleDates.length > 0 && (
                <button
                  type="button"
                  className="text-[10.5px] text-[#4fc3a1] hover:underline cursor-pointer"
                  onClick={() => setUseScheduleDate((v) => !v)}
                >
                  {useScheduleDate ? '직접 입력으로' : '시간표에서 선택'}
                </button>
              )}
            </div>
            {useScheduleDate ? (
              <select
                value={assignmentForm.date}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, date: e.target.value })}
                className={fieldClass}
              >
                <option value="">선택</option>
                {scheduleDates.map((d) => (
                  <option key={d.date} value={d.date}>{d.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                value={assignmentForm.date}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, date: e.target.value })}
                className={fieldClass}
              />
            )}
          </div>

          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">납기일 *</label>
            <input
              type="date"
              value={assignmentForm.dueDate}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">과제 내용 (메모)</label>
            <textarea
              value={assignmentForm.memo}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, memo: e.target.value })}
              rows={5}
              className={`${fieldClass} resize-none`}
              placeholder="예: 교재 23~28쪽 풀이, 단어시험 대비 1~30번"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
