'use client';
import { useState, useEffect, useMemo } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useMakeupStore, type OpenSlotCreateInput } from '@/lib/stores/makeupStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { formatKoreanDate } from '@/lib/utils/format';
import { Plus, Trash2, UserPlus, X as XIcon, CheckCheck } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import CommentClinicPanel from '../../lessons/_components/CommentClinicPanel';
import type { RecurrencePattern } from '@/lib/types/calendar';

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

const inputCls =
  'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] bg-white';
const labelCls = 'block text-[11.5px] text-[#6b7280] mb-1';

type RegisterMode = 'single' | 'recurring';

interface SingleForm {
  originalClassId: string;
  teacherId: string;
  reason: string;
  capacity: string;        // text input → number 변환
  makeupDate: string;
  makeupTime: string;
}

interface RecurringForm {
  originalClassId: string;
  teacherId: string;
  reason: string;
  capacity: string;
  daysOfWeek: number[];    // 1=월..7=일
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

const EMPTY_SINGLE: SingleForm = {
  originalClassId: '',
  teacherId: '',
  reason: '정기 보강',
  capacity: '',
  makeupDate: '',
  makeupTime: '',
};

const EMPTY_RECURRING: RecurringForm = {
  originalClassId: '',
  teacherId: '',
  reason: '정기 보강',
  capacity: '',
  daysOfWeek: [],
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
};

function countRecurrence(form: RecurringForm): number {
  if (!form.startDate || !form.endDate || form.daysOfWeek.length === 0) return 0;
  const start = new Date(`${form.startDate}T00:00:00.000Z`);
  const end = new Date(`${form.endDate}T00:00:00.000Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  const targetDows = new Set(form.daysOfWeek);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const jsDow = d.getUTCDay();
    const dow = jsDow === 0 ? 7 : jsDow;
    if (targetDows.has(dow)) count++;
  }
  return count;
}

export default function OpenMakeupTab() {
  const {
    makeupClasses, loading,
    addOpenSlot, fetchMakeupClasses, addStudents, removeStudent, saveAttendance, removeMakeupClass,
  } = useMakeupStore();
  const { classes } = useClassStore();
  const { students } = useStudentStore();
  const { teachers } = useTeacherStore();

  // OPEN 슬롯만 필터
  const openSlots = useMemo(
    () => makeupClasses.filter((m) => m.slotType === 'OPEN').sort((a, b) => b.makeupDate.localeCompare(a.makeupDate)),
    [makeupClasses],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = openSlots.find((m) => m.id === selectedId);
  const targetStudents = selected
    ? students.filter((s) => selected.targetStudents.includes(s.id))
    : [];

  /* ── 출결 입력 상태 ── */
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [memo, setMemo] = useState<Record<string, string>>({});
  const [commentStudentId, setCommentStudentId] = useState<string>('');

  useEffect(() => {
    if (!selected) {
      setChecked({}); setMemo({}); setCommentStudentId(''); return;
    }
    const nextChecked: Record<string, boolean> = {};
    const nextMemo: Record<string, string> = {};
    (selected.attendance ?? []).forEach((a) => {
      if (a.status === '출석') nextChecked[a.studentId] = true;
      else if (a.status === '결석') nextChecked[a.studentId] = false;
      if (a.memo) nextMemo[a.studentId] = a.memo;
    });
    setChecked(nextChecked);
    setMemo(nextMemo);
    setCommentStudentId(selected.targetStudents[0] ?? '');
  }, [selectedId, makeupClasses]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 슬롯 등록 모달 ── */
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerMode, setRegisterMode] = useState<RegisterMode>('single');
  const [singleForm, setSingleForm] = useState<SingleForm>(EMPTY_SINGLE);
  const [recurringForm, setRecurringForm] = useState<RecurringForm>(EMPTY_RECURRING);

  function openRegister() {
    setSingleForm(EMPTY_SINGLE);
    setRecurringForm(EMPTY_RECURRING);
    setRegisterMode('single');
    setRegisterOpen(true);
  }

  function handleClassChange(classId: string, isSingle: boolean) {
    const cls = classes.find((c) => c.id === classId);
    if (isSingle) {
      setSingleForm((f) => ({ ...f, originalClassId: classId, teacherId: cls?.teacherId ?? '' }));
    } else {
      setRecurringForm((f) => ({ ...f, originalClassId: classId, teacherId: cls?.teacherId ?? '' }));
    }
  }

  async function handleSaveSingle() {
    const f = singleForm;
    if (!f.originalClassId || !f.teacherId || !f.makeupDate || !f.makeupTime) {
      toast('필수 항목을 모두 입력해주세요.', 'error');
      return;
    }
    const input: OpenSlotCreateInput = {
      originalClassId: f.originalClassId,
      teacherId: f.teacherId,
      reason: f.reason,
      capacity: f.capacity ? Number(f.capacity) : null,
      makeupDate: f.makeupDate,
      makeupTime: f.makeupTime,
    };
    try {
      await addOpenSlot(input);
      setRegisterOpen(false);
      fetchMakeupClasses(undefined, undefined, 'OPEN');
    } catch { /* toast handled */ }
  }

  async function handleSaveRecurring() {
    const f = recurringForm;
    if (!f.originalClassId || !f.teacherId || f.daysOfWeek.length === 0 || !f.startDate || !f.endDate || !f.startTime) {
      toast('필수 항목을 모두 입력해주세요.', 'error');
      return;
    }
    if (countRecurrence(f) === 0) {
      toast('생성될 슬롯이 없습니다. 기간/요일을 확인해주세요.', 'error');
      return;
    }
    const pattern: RecurrencePattern = {
      daysOfWeek: f.daysOfWeek,
      startDate: f.startDate,
      endDate: f.endDate,
      startTime: f.startTime,
      endTime: f.endTime || undefined,
    };
    const input: OpenSlotCreateInput = {
      originalClassId: f.originalClassId,
      teacherId: f.teacherId,
      reason: f.reason,
      capacity: f.capacity ? Number(f.capacity) : null,
      recurrencePattern: pattern,
    };
    try {
      await addOpenSlot(input);
      setRegisterOpen(false);
      fetchMakeupClasses(undefined, undefined, 'OPEN');
    } catch { /* toast handled */ }
  }

  async function handleDelete(scope: 'this' | 'future') {
    if (!selected) return;
    const msg = scope === 'future'
      ? '이 슬롯과 이후의 같은 반복 그룹 슬롯을 모두 삭제하시겠습니까?'
      : '이 슬롯을 삭제하시겠습니까?';
    if (!confirm(msg)) return;
    await removeMakeupClass(selected.id, scope);
    setSelectedId(null);
    if (scope === 'future') {
      fetchMakeupClasses(undefined, undefined, 'OPEN');
    }
  }

  /* ── 학생 추가 모달 ── */
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [pickedStudents, setPickedStudents] = useState<string[]>([]);

  function openStudentModal() {
    setPickedStudents([]);
    setStudentModalOpen(true);
  }

  function handleAddStudents() {
    if (!selected || pickedStudents.length === 0) {
      toast('추가할 학생을 선택해주세요.', 'error');
      return;
    }
    addStudents(selected.id, pickedStudents);
    setStudentModalOpen(false);
    toast(`${pickedStudents.length}명의 학생이 명단에 추가되었습니다.`, 'success');
  }

  const classStudentsForModal = selected
    ? students.filter(
        (s) => s.classes?.includes(selected.originalClassId) && !selected.targetStudents.includes(s.id),
      )
    : [];

  async function handleSaveAttendance() {
    if (!selected) return;
    const attendance = targetStudents.map((s) => ({
      studentId: s.id,
      status: checked[s.id] === true ? '출석' as const
            : checked[s.id] === false ? '결석' as const
            : null,
      memo: memo[s.id] ?? '',
    }));
    await saveAttendance(selected.id, attendance);
    toast('보강 출결이 저장되었습니다.', 'success');
  }

  const recurringCount = countRecurrence(recurringForm);

  /* ── 슬롯 메타 표시용 ── */
  const formatDeadline = (iso: string | null | undefined) => {
    if (!iso) return '미설정';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── 좌측: 슬롯 목록 ── */}
      <div className="w-72 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
        <div className="px-3 py-2.5 border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[11.5px] text-[#6b7280]">{openSlots.length}개 슬롯</span>
          <Button variant="dark" size="sm" onClick={openRegister}>
            <Plus size={13} /> 슬롯 등록
          </Button>
        </div>
        <div className="p-2 space-y-1">
          {openSlots.length === 0 && (
            <p className="text-[12px] text-[#9ca3af] text-center py-6">등록된 오픈 슬롯이 없습니다</p>
          )}
          {openSlots.map((slot) => {
            const cls = classes.find((c) => c.id === slot.originalClassId);
            const filled = slot.targetStudents.length;
            const cap = slot.capacity;
            return (
              <button
                key={slot.id}
                onClick={() => setSelectedId(slot.id)}
                className={clsx(
                  'w-full px-3 py-3 rounded-[8px] text-left transition-colors cursor-pointer',
                  selectedId === slot.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls?.color ?? '#ccc' }} />
                  <span className="text-[12.5px] font-medium text-[#111827]">{slot.originalClassName}</span>
                  {slot.recurrenceGroupId && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EEEDFE] text-[#5B4FBE]">반복</span>
                  )}
                </div>
                <div className="text-[11.5px] text-[#6b7280] ml-4">
                  {formatKoreanDate(slot.makeupDate)} {slot.makeupTime}
                </div>
                <div className="ml-4 mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-[20px] text-[10.5px] font-medium bg-[#F3F4F6] text-[#374151]">
                    신청 {filled}{cap ? `/${cap}` : ''}
                  </span>
                  <span className="px-2 py-0.5 rounded-[20px] text-[10.5px] font-medium bg-[#FEF3C7] text-[#92400E]">
                    마감 {formatDeadline(slot.applicationDeadline)}
                  </span>
                  {slot.attendanceChecked && (
                    <span className="px-2 py-0.5 rounded-[20px] text-[10.5px] font-medium bg-[#D1FAE5] text-[#065f46]">
                      출결 완료
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 우측: 슬롯 상세 ── */}
      {selected ? (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 슬롯 정보 카드 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-bold text-[#111827]">
                {selected.originalClassName} 오픈 슬롯
              </span>
              <div className="flex gap-2">
                {selected.recurrenceGroupId && (
                  <Button variant="default" size="sm" onClick={() => handleDelete('future')}>
                    <Trash2 size={13} /> 이후 모두 삭제
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => handleDelete('this')}>
                  <Trash2 size={13} /> 이 슬롯만 삭제
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-[12px]">
              <div>
                <div className="text-[#6b7280] mb-0.5">보강 일시</div>
                <div className="font-medium text-[#111827]">
                  {formatKoreanDate(selected.makeupDate)} {selected.makeupTime}
                </div>
              </div>
              <div>
                <div className="text-[#6b7280] mb-0.5">담당 강사</div>
                <div className="font-medium text-[#111827]">{selected.teacherName}</div>
              </div>
              <div>
                <div className="text-[#6b7280] mb-0.5">사유</div>
                <div className="font-medium text-[#111827]">{selected.reason || '-'}</div>
              </div>
              <div>
                <div className="text-[#6b7280] mb-0.5">정원</div>
                <div className="font-medium text-[#111827]">
                  {selected.capacity ? `${selected.targetStudents.length} / ${selected.capacity}명` : `${selected.targetStudents.length}명 (무제한)`}
                </div>
              </div>
              <div>
                <div className="text-[#6b7280] mb-0.5">신청 마감</div>
                <div className="font-medium text-[#111827]">{formatDeadline(selected.applicationDeadline)}</div>
              </div>
              <div>
                <div className="text-[#6b7280] mb-0.5">출결 상태</div>
                <div className={clsx('font-medium', selected.attendanceChecked ? 'text-[#065f46]' : 'text-[#92400E]')}>
                  {selected.attendanceChecked ? '완료' : '미입력'}
                </div>
              </div>
            </div>
          </div>

          {/* 신청자 명단 카드 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <span className="text-[12.5px] font-semibold text-[#111827]">신청자 명단</span>
                <span className="ml-2 text-[11.5px] text-[#9ca3af]">
                  학부모 PWA 신청 + 관리자 직접 추가
                </span>
              </div>
              <Button variant="primary" size="sm" onClick={openStudentModal}>
                <UserPlus size={13} /> 학생 추가
              </Button>
            </div>
            {selected.targetStudents.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-[#9ca3af]">
                <UserPlus size={28} strokeWidth={1.5} />
                <p className="text-[12.5px]">아직 신청자가 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-[#f1f5f9]">
                {targetStudents.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-[#f9fafb]">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                        style={{ backgroundColor: s.avatarColor }}
                      >
                        {s.name[0]}
                      </span>
                      <span className="text-[12.5px] font-medium text-[#111827]">{s.name}</span>
                      <span className="text-[11px] text-[#9ca3af]">{s.school} {s.grade}학년</span>
                    </div>
                    <button
                      onClick={() => removeStudent(selected.id, s.id)}
                      className="text-[#9ca3af] hover:text-[#ef4444] transition-colors cursor-pointer"
                      title="명단에서 제거"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 출결 + Comment/Clinic (개별 보강과 동일) */}
          {targetStudents.length > 0 && (
            <>
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[#111827]">보강 출결 입력</span>
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
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                              style={{ backgroundColor: s.avatarColor }}
                            >
                              {s.name[0]}
                            </span>
                            <span className="font-medium text-[#111827]">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            onClick={() => setChecked((prev) => ({ ...prev, [s.id]: true }))}
                            className={clsx(
                              'px-3 py-1 rounded-[20px] text-[11.5px] font-medium cursor-pointer transition-all',
                              checked[s.id] === true ? 'bg-[#065f46] text-white' : 'bg-[#f1f5f9] text-[#9ca3af] hover:bg-[#e2e8f0]',
                            )}
                          >
                            출석
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            onClick={() => setChecked((prev) => ({ ...prev, [s.id]: false }))}
                            className={clsx(
                              'px-3 py-1 rounded-[20px] text-[11.5px] font-medium cursor-pointer transition-all',
                              checked[s.id] === false ? 'bg-[#991B1B] text-white' : 'bg-[#f1f5f9] text-[#9ca3af] hover:bg-[#e2e8f0]',
                            )}
                          >
                            결석
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={memo[s.id] ?? ''}
                            onChange={(e) => setMemo((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            placeholder="메모"
                            className="w-full text-[12px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 focus:outline-none focus:border-[#4fc3a1]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 border-t border-[#e2e8f0] flex justify-end">
                  <Button variant="dark" size="md" onClick={handleSaveAttendance}>출결 저장</Button>
                </div>
              </div>

              <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between gap-3">
                  <span className="text-[12.5px] font-semibold text-[#111827]">수업 코멘트 & Clinic 체크</span>
                  <div className="flex items-center gap-2">
                    <label className="text-[11.5px] text-[#6b7280]">학생</label>
                    <select
                      value={commentStudentId}
                      onChange={(e) => setCommentStudentId(e.target.value)}
                      className="text-[12px] border border-[#e2e8f0] rounded-[8px] px-2 py-1 focus:outline-none focus:border-[#4fc3a1]"
                    >
                      {targetStudents.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="p-4">
                  <CommentClinicPanel
                    scope={{ kind: 'makeup', makeupClassId: selected.id }}
                    selectedStudentId={commentStudentId || null}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
          <p className="text-[13px] text-[#9ca3af]">좌측에서 오픈 슬롯을 선택하거나 새로 등록하세요</p>
        </div>
      )}

      {/* ════ 슬롯 등록 모달 ════ */}
      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="오픈 보강 슬롯 등록"
        size="md"
        footer={
          <>
            <Button variant="default" size="sm" onClick={() => setRegisterOpen(false)}>취소</Button>
            <Button
              variant="dark"
              size="sm"
              onClick={registerMode === 'single' ? handleSaveSingle : handleSaveRecurring}
            >
              {registerMode === 'recurring' && recurringCount > 0 ? `${recurringCount}개 슬롯 생성` : '등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] px-3 py-2.5 text-[11.5px] text-[#166534]">
            오픈 슬롯은 학부모가 PWA에서 자녀를 신청할 수 있습니다. 해당 반에 등록된 학생만 신청 가능합니다.
          </div>

          {/* 모드 토글 */}
          <div className="inline-flex border border-[#e2e8f0] rounded-[8px] overflow-hidden">
            <button
              type="button"
              onClick={() => setRegisterMode('single')}
              className={clsx(
                'px-4 py-1.5 text-[12px] cursor-pointer',
                registerMode === 'single' ? 'bg-[#4fc3a1] text-white' : 'bg-white text-[#6b7280]',
              )}
            >
              1회성
            </button>
            <button
              type="button"
              onClick={() => setRegisterMode('recurring')}
              className={clsx(
                'px-4 py-1.5 text-[12px] cursor-pointer',
                registerMode === 'recurring' ? 'bg-[#4fc3a1] text-white' : 'bg-white text-[#6b7280]',
              )}
            >
              반복
            </button>
          </div>

          {/* 공통: 반 + 강사 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>대상 반 <span className="text-[#ef4444]">*</span></label>
              <select
                value={registerMode === 'single' ? singleForm.originalClassId : recurringForm.originalClassId}
                onChange={(e) => handleClassChange(e.target.value, registerMode === 'single')}
                className={inputCls}
              >
                <option value="">반을 선택하세요</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>담당 강사 <span className="text-[#ef4444]">*</span></label>
              <select
                value={registerMode === 'single' ? singleForm.teacherId : recurringForm.teacherId}
                onChange={(e) => {
                  if (registerMode === 'single') setSingleForm((f) => ({ ...f, teacherId: e.target.value }));
                  else setRecurringForm((f) => ({ ...f, teacherId: e.target.value }));
                }}
                className={inputCls}
              >
                <option value="">강사를 선택하세요</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
                ))}
              </select>
            </div>
          </div>

          {/* 공통: 사유 + 정원 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>사유</label>
              <input
                type="text"
                value={registerMode === 'single' ? singleForm.reason : recurringForm.reason}
                onChange={(e) => {
                  if (registerMode === 'single') setSingleForm((f) => ({ ...f, reason: e.target.value }));
                  else setRecurringForm((f) => ({ ...f, reason: e.target.value }));
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>정원 (비우면 무제한)</label>
              <input
                type="number"
                min="1"
                value={registerMode === 'single' ? singleForm.capacity : recurringForm.capacity}
                onChange={(e) => {
                  if (registerMode === 'single') setSingleForm((f) => ({ ...f, capacity: e.target.value }));
                  else setRecurringForm((f) => ({ ...f, capacity: e.target.value }));
                }}
                placeholder="예: 10"
                className={inputCls}
              />
            </div>
          </div>

          {/* 1회성: 날짜 + 시간 */}
          {registerMode === 'single' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>보강일 <span className="text-[#ef4444]">*</span></label>
                <input
                  type="date"
                  value={singleForm.makeupDate}
                  onChange={(e) => setSingleForm((f) => ({ ...f, makeupDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>보강 시간 <span className="text-[#ef4444]">*</span></label>
                <input
                  type="time"
                  value={singleForm.makeupTime}
                  onChange={(e) => setSingleForm((f) => ({ ...f, makeupTime: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            <>
              {/* 반복: 요일 다중 선택 */}
              <div>
                <label className={labelCls}>요일 <span className="text-[#ef4444]">*</span></label>
                <div className="flex gap-1.5">
                  {DOW_LABELS.map((label, idx) => {
                    const dow = idx + 1;
                    const active = recurringForm.daysOfWeek.includes(dow);
                    return (
                      <button
                        key={dow}
                        type="button"
                        onClick={() => setRecurringForm((f) => ({
                          ...f,
                          daysOfWeek: active
                            ? f.daysOfWeek.filter((d) => d !== dow)
                            : [...f.daysOfWeek, dow].sort((a, b) => a - b),
                        }))}
                        className={clsx(
                          'w-9 h-9 rounded-[8px] text-[12px] font-medium border cursor-pointer transition-all',
                          active
                            ? 'bg-[#4fc3a1] text-white border-[#4fc3a1]'
                            : 'bg-white text-[#6b7280] border-[#e2e8f0] hover:border-[#4fc3a1]',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 반복: 시간 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>시작 시간 <span className="text-[#ef4444]">*</span></label>
                  <input
                    type="time"
                    value={recurringForm.startTime}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, startTime: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>종료 시간</label>
                  <input
                    type="time"
                    value={recurringForm.endTime}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, endTime: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* 반복: 기간 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>시작일 <span className="text-[#ef4444]">*</span></label>
                  <input
                    type="date"
                    value={recurringForm.startDate}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, startDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>종료일 <span className="text-[#ef4444]">*</span></label>
                  <input
                    type="date"
                    value={recurringForm.endDate}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, endDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {recurringCount > 0 && (
                <div className="bg-[#EEEDFE] border border-[#c4b5fd] rounded-[8px] px-3 py-2 text-[11.5px] text-[#5B4FBE]">
                  총 <span className="font-bold">{recurringCount}개</span>의 슬롯이 생성됩니다.
                </div>
              )}
            </>
          )}

          <div className="text-[10.5px] text-[#9ca3af]">
            ※ 신청 마감은 자동으로 보강 시작 1시간 전으로 설정됩니다 (현재 버전).
          </div>
        </div>
      </Modal>

      {/* ════ 학생 추가 모달 ════ */}
      <Modal
        open={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        title="신청자 직접 추가"
        size="md"
        footer={
          <>
            <Button variant="default" size="sm" onClick={() => setStudentModalOpen(false)}>취소</Button>
            <Button variant="dark" size="sm" onClick={handleAddStudents}>
              추가 ({pickedStudents.length}명)
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-[11.5px] text-[#6b7280]">
            해당 반 ({selected?.originalClassName}) 학생만 노출됩니다. 학부모 PWA 신청을 받지 않고 관리자가 직접 명단에 추가할 때 사용하세요.
          </div>
          {classStudentsForModal.length === 0 ? (
            <p className="text-[12.5px] text-[#9ca3af] text-center py-4">
              추가할 수 있는 학생이 없습니다
            </p>
          ) : (
            <div className="space-y-1">
              {classStudentsForModal.map((s) => {
                const picked = pickedStudents.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors',
                      picked ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() =>
                        setPickedStudents((prev) =>
                          picked ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                        )
                      }
                      className="w-3.5 h-3.5 accent-[#4fc3a1]"
                    />
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                      style={{ backgroundColor: s.avatarColor }}
                    >
                      {s.name[0]}
                    </span>
                    <span className="text-[12.5px] font-medium text-[#111827]">{s.name}</span>
                    <span className="text-[11px] text-[#9ca3af]">{s.school} {s.grade}학년</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
