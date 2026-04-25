'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useMakeupStore } from '@/lib/stores/makeupStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { formatKoreanDate } from '@/lib/utils/format';
import { Plus, CheckCheck, UserPlus, X as XIcon } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

/* ─── 보강 등록/수정 폼 기본값 ─── */
const EMPTY_FORM = {
  originalClassId: '',
  originalDate: '',
  makeupDate: '',
  makeupTime: '',
  teacherId: '',
  teacherName: '',
  reason: '결석',
};

type FormState = typeof EMPTY_FORM;

/* ─── 입력 필드 공용 스타일 ─── */
const inputCls =
  'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] bg-white';
const labelCls = 'block text-[11.5px] text-[#6b7280] mb-1';

export default function MakeupPage() {
  const { makeupClasses, loading, addMakeupClass, updateMakeupClass, addStudents, removeStudent, setAttendanceChecked, fetchMakeupClasses } =
    useMakeupStore();
  const { classes, fetchClasses } = useClassStore();
  const { students, fetchStudents } = useStudentStore();
  const { teachers, fetchTeachers } = useTeacherStore();

  useEffect(() => {
    fetchMakeupClasses();
    fetchClasses();
    fetchStudents();
    fetchTeachers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [memo, setMemo] = useState<Record<string, string>>({});

  /* ── 보강 등록/수정 모달 ── */
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  /* ── 학생 추가 모달 ── */
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [pickedStudents, setPickedStudents] = useState<string[]>([]);

  /* ── 선택된 보강 수업 ── */
  const selected = makeupClasses.find((m) => m.id === selectedId);
  const targetStudents = selected
    ? students.filter((s) => selected.targetStudents.includes(s.id))
    : [];

  /* ── 반 선택 시 담당 강사 자동 세팅 ── */
  function handleClassChange(classId: string) {
    const cls = classes.find((c) => c.id === classId);
    setForm((f) => ({
      ...f,
      originalClassId: classId,
      teacherId: cls?.teacherId ?? '',
      teacherName: cls?.teacherName ?? '',
    }));
  }

  /* ── 보강 등록 열기 ── */
  function openRegister() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setRegisterOpen(true);
  }

  /* ── 보강 수정 열기 ── */
  function openEdit() {
    if (!selected) return;
    setEditingId(selected.id);
    setForm({
      originalClassId: selected.originalClassId,
      originalDate: selected.originalDate,
      makeupDate: selected.makeupDate,
      makeupTime: selected.makeupTime,
      teacherId: selected.teacherId,
      teacherName: selected.teacherName,
      reason: selected.reason,
    });
    setRegisterOpen(true);
  }

  /* ── 보강 저장 (등록 or 수정) ── */
  async function handleSaveForm() {
    if (!form.originalClassId || !form.originalDate || !form.makeupDate || !form.makeupTime) {
      toast('필수 항목을 모두 입력해주세요.', 'error');
      return;
    }
    const cls = classes.find((c) => c.id === form.originalClassId);
    const originalClassName = cls?.name ?? '';

    if (editingId) {
      await updateMakeupClass(editingId, { ...form, originalClassName });
      toast('보강 수업이 수정되었습니다.', 'success');
    } else {
      const newId = await addMakeupClass({ ...form, originalClassName, targetStudents: [] });
      setSelectedId(newId);
      toast('보강 수업이 등록되었습니다.', 'success');
    }
    setRegisterOpen(false);
  }

  /* ── 학생 추가 모달 열기 ── */
  function openStudentModal() {
    setPickedStudents([]);
    setStudentModalOpen(true);
  }

  /* ── 학생 추가 저장 ── */
  function handleAddStudents() {
    if (!selected || pickedStudents.length === 0) {
      toast('추가할 학생을 선택해주세요.', 'error');
      return;
    }
    addStudents(selected.id, pickedStudents);
    setStudentModalOpen(false);
    toast(`${pickedStudents.length}명의 학생이 명단에 추가되었습니다.`, 'success');
  }

  /* ── 출결 저장 ── */
  function handleSaveAttendance() {
    if (!selected) return;
    setAttendanceChecked(selected.id, true);
    toast('보강 출결이 저장되었습니다.', 'success');
  }

  /* ── 학생 추가 모달: 해당 반 학생 목록 ── */
  const classStudentsForModal = selected
    ? students.filter(
        (s) =>
          s.classes?.includes(selected.originalClassId) &&
          !selected.targetStudents.includes(s.id),
      )
    : [];
  /* 반 소속 외 다른 학생도 검색용 */
  const otherStudentsForModal = selected
    ? students.filter(
        (s) =>
          !s.classes?.includes(selected.originalClassId) &&
          !selected.targetStudents.includes(s.id),
      )
    : [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="보강 수업 관리"
        badge={`${makeupClasses.length}건`}
        actions={
          <Button variant="dark" size="sm" onClick={openRegister}>
            <Plus size={13} /> 보강 등록
          </Button>
        }
      />

      {loading ? <LoadingSpinner /> : <div className="flex flex-1 overflow-hidden">
        {/* ── 좌측: 보강 목록 ── */}
        <div className="w-64 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          <div className="p-2 space-y-1">
            {makeupClasses.length === 0 && (
              <p className="text-[12px] text-[#9ca3af] text-center py-6">등록된 보강이 없습니다</p>
            )}
            {makeupClasses.map((mc) => {
              const cls = classes.find((c) => c.id === mc.originalClassId);
              return (
                <button
                  key={mc.id}
                  onClick={() => {
                    setSelectedId(mc.id);
                    setChecked({});
                    setMemo({});
                  }}
                  className={clsx(
                    'w-full px-3 py-3 rounded-[8px] text-left transition-colors cursor-pointer',
                    selectedId === mc.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cls?.color ?? '#ccc' }}
                    />
                    <span className="text-[12.5px] font-medium text-[#111827]">{mc.originalClassName}</span>
                  </div>
                  <div className="text-[11.5px] text-[#6b7280] ml-4">
                    보강일: {formatKoreanDate(mc.makeupDate)} {mc.makeupTime}
                  </div>
                  <div className="text-[11px] text-[#9ca3af] ml-4 mt-0.5">
                    원래 수업: {formatKoreanDate(mc.originalDate)}
                  </div>
                  <div className="ml-4 mt-1.5 flex items-center gap-1.5">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-[20px] text-[10.5px] font-medium',
                        mc.attendanceChecked
                          ? 'bg-[#D1FAE5] text-[#065f46]'
                          : 'bg-[#FEF3C7] text-[#92400E]',
                      )}
                    >
                      {mc.attendanceChecked ? '출결 완료' : '출결 미확인'}
                    </span>
                    {mc.targetStudents.length === 0 && (
                      <span className="px-2 py-0.5 rounded-[20px] text-[10.5px] font-medium bg-[#F3F4F6] text-[#6b7280]">
                        명단 미등록
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 우측: 보강 상세 ── */}
        {selected ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 보강 정보 카드 */}
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[14px] font-bold text-[#111827]">
                  {selected.originalClassName} 보강
                </span>
                <Button variant="default" size="sm" onClick={openEdit}>
                  수정
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-[12px]">
                <div>
                  <div className="text-[#6b7280] mb-0.5">원래 수업일</div>
                  <div className="font-medium text-[#111827]">{formatKoreanDate(selected.originalDate)}</div>
                </div>
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
                  <div className="text-[#6b7280] mb-0.5">보강 사유</div>
                  <div className="font-medium text-[#111827]">{selected.reason}</div>
                </div>
                <div>
                  <div className="text-[#6b7280] mb-0.5">수강 학생</div>
                  <div className="font-medium text-[#111827]">{selected.targetStudents.length}명</div>
                </div>
                <div>
                  <div className="text-[#6b7280] mb-0.5">출결 상태</div>
                  <div
                    className={clsx(
                      'font-medium',
                      selected.attendanceChecked ? 'text-[#065f46]' : 'text-[#92400E]',
                    )}
                  >
                    {selected.attendanceChecked ? '완료' : '미입력'}
                  </div>
                </div>
              </div>
            </div>

            {/* 수강학생 명단 카드 */}
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                <div>
                  <span className="text-[12.5px] font-semibold text-[#111827]">수강학생 명단</span>
                  {selected.targetStudents.length === 0 && (
                    <span className="ml-2 text-[11.5px] text-[#9ca3af]">
                      강의 시작 전 학생 명단을 등록해주세요
                    </span>
                  )}
                </div>
                <Button variant="primary" size="sm" onClick={openStudentModal}>
                  <UserPlus size={13} /> 학생 추가
                </Button>
              </div>

              {selected.targetStudents.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-[#9ca3af]">
                  <UserPlus size={28} strokeWidth={1.5} />
                  <p className="text-[12.5px]">등록된 수강학생이 없습니다</p>
                  <p className="text-[11.5px]">위 버튼을 눌러 학생을 추가하세요</p>
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

            {/* 출결 입력 — 학생이 있을 때만 표시 */}
            {targetStudents.length > 0 && (
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[#111827]">출결 입력</span>
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
                              checked[s.id] === true
                                ? 'bg-[#065f46] text-white'
                                : 'bg-[#f1f5f9] text-[#9ca3af] hover:bg-[#e2e8f0]',
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
                              checked[s.id] === false
                                ? 'bg-[#991B1B] text-white'
                                : 'bg-[#f1f5f9] text-[#9ca3af] hover:bg-[#e2e8f0]',
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
                  <Button variant="dark" size="md" onClick={handleSaveAttendance}>
                    출결 저장
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
            <p className="text-[13px] text-[#9ca3af]">좌측에서 보강 수업을 선택하세요</p>
          </div>
        )}
      </div>}

      {/* ════ 보강 등록 / 수정 모달 ════ */}
      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title={editingId ? '보강 수업 수정' : '보강 수업 등록'}
        size="md"
        footer={
          <>
            <Button variant="default" size="sm" onClick={() => setRegisterOpen(false)}>
              취소
            </Button>
            <Button variant="dark" size="sm" onClick={handleSaveForm}>
              {editingId ? '수정 저장' : '등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 안내 문구 */}
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] px-3 py-2.5 text-[11.5px] text-[#166534]">
            보강 수업을 먼저 등록하고, 수업 시작 시 수강학생 명단을 등록합니다.
          </div>

          {/* 원래 수업 (반) */}
          <div>
            <label className={labelCls}>원래 수업 (반) <span className="text-[#ef4444]">*</span></label>
            <select
              value={form.originalClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className={inputCls}
            >
              <option value="">반을 선택하세요</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 원래 수업일 / 보강일 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>원래 수업일 <span className="text-[#ef4444]">*</span></label>
              <input
                type="date"
                value={form.originalDate}
                onChange={(e) => setForm((f) => ({ ...f, originalDate: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>보강일 <span className="text-[#ef4444]">*</span></label>
              <input
                type="date"
                value={form.makeupDate}
                onChange={(e) => setForm((f) => ({ ...f, makeupDate: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          {/* 보강 시간 / 보강 사유 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>보강 시간 <span className="text-[#ef4444]">*</span></label>
              <input
                type="time"
                value={form.makeupTime}
                onChange={(e) => setForm((f) => ({ ...f, makeupTime: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>보강 사유</label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="예: 결석, 휴강 등"
                className={inputCls}
              />
            </div>
          </div>

          {/* 담당 강사 */}
          <div>
            <label className={labelCls}>담당 강사</label>
            <select
              value={form.teacherId}
              onChange={(e) => {
                const t = teachers.find((t) => t.id === e.target.value);
                setForm((f) => ({ ...f, teacherId: e.target.value, teacherName: t?.name ?? '' }));
              }}
              className={inputCls}
            >
              <option value="">강사를 선택하세요</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.subject})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* ════ 학생 추가 모달 ════ */}
      <Modal
        open={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        title="수강학생 명단 등록"
        size="md"
        footer={
          <>
            <Button variant="default" size="sm" onClick={() => setStudentModalOpen(false)}>
              취소
            </Button>
            <Button variant="dark" size="sm" onClick={handleAddStudents}>
              추가 ({pickedStudents.length}명)
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* 해당 반 학생 */}
          {classStudentsForModal.length > 0 && (
            <div>
              <p className="text-[11.5px] text-[#6b7280] font-medium mb-2">
                해당 반 학생 ({selected?.originalClassName})
              </p>
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
            </div>
          )}

          {/* 구분선 */}
          {classStudentsForModal.length > 0 && otherStudentsForModal.length > 0 && (
            <div className="border-t border-[#e2e8f0]" />
          )}

          {/* 다른 반 / 기타 학생 */}
          {otherStudentsForModal.length > 0 && (
            <div>
              <p className="text-[11.5px] text-[#6b7280] font-medium mb-2">기타 학생</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {otherStudentsForModal.map((s) => {
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
            </div>
          )}

          {classStudentsForModal.length === 0 && otherStudentsForModal.length === 0 && (
            <p className="text-[12.5px] text-[#9ca3af] text-center py-4">
              추가할 수 있는 학생이 없습니다
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
