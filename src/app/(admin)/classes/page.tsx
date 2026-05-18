'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import Modal from '@/components/shared/Modal';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { StudentStatus } from '@/lib/types/student';
import type { FeeType } from '@/lib/types/class';
import { FEE_TYPE_LABELS, FEE_TYPE_NAMES } from '@/lib/types/class';
import { toast } from '@/lib/stores/toastStore';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { FEE_TYPES, PRESET_COLORS, CLASS_DETAIL_TABS } from './_shared';
import ScheduleTab from './_tabs/ScheduleTab';
import TeacherTab from './_tabs/TeacherTab';
import CurriculumTab from './_tabs/CurriculumTab';

export default function ClassesPage() {
  const { classes, selectedClassId, loading, setSelectedClass, addClass, updateClass, fetchClasses, fetchClassEvents } = useClassStore();
  const { students, fetchStudents } = useStudentStore();
  const { teachers, fetchTeachers } = useTeacherStore();

  useEffect(() => {
    fetchClasses();
    fetchStudents();
    fetchTeachers();
    fetchClassEvents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = classes.find((c) => c.id === selectedClassId);

  // ── 반 상세 탭 ─────────────────────────────────────────
  const [classDetailTab, setClassDetailTab] = useState('schedule');

  // 반 변경 시 탭 초기화
  useEffect(() => {
    setClassDetailTab('schedule');
  }, [selectedClassId]);

  // ── 반 추가 ───────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const blankAddForm = { name: '', teacherId: '', fee: '', feeType: 'monthly' as FeeType, room: '', maxStudents: '', description: '' };
  const [addForm, setAddForm] = useState(blankAddForm);

  const handleAddClass = async () => {
    if (!addForm.name.trim()) { toast('반 이름을 입력해주세요.', 'error'); return; }
    const selectedTeacher = teachers.find((t) => t.id === addForm.teacherId);
    try {
      await addClass({
        name: addForm.name.trim(), subject: '',
        teacherId: addForm.teacherId,
        teacherName: selectedTeacher?.name ?? '',
        maxStudents: parseInt(addForm.maxStudents) || 0,
        schedule: [],
        color: PRESET_COLORS[classes.length % PRESET_COLORS.length],
        room: addForm.room.trim(), fee: parseInt(addForm.fee) || 0,
        feeType: addForm.feeType,
        description: addForm.description.trim(),
      });
      setAddForm(blankAddForm);
      setAddOpen(false);
    } catch { /* store handles error toast */ }
  };

  // ── 반 수정 ───────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', teacherId: '', fee: '', feeType: 'monthly' as FeeType, room: '', maxStudents: '', description: '' });

  const openEdit = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name, teacherId: selected.teacherId,
      fee: String(selected.fee), feeType: selected.feeType ?? 'monthly',
      room: selected.room, maxStudents: String(selected.maxStudents),
      description: selected.description ?? '',
    });
    setEditOpen(true);
  };

  const handleEditClass = async () => {
    if (!selected) return;
    if (!editForm.name.trim()) { toast('반 이름을 입력해주세요.', 'error'); return; }
    const selectedTeacher = teachers.find((t) => t.id === editForm.teacherId);
    try {
      await updateClass(selected.id, {
        name: editForm.name.trim(),
        teacherId: editForm.teacherId,
        teacherName: selectedTeacher?.name ?? '',
        fee: parseInt(editForm.fee) || 0,
        feeType: editForm.feeType,
        room: editForm.room.trim(),
        maxStudents: parseInt(editForm.maxStudents) || 0,
        description: editForm.description.trim(),
      });
      setEditOpen(false);
    } catch { /* store handles error toast */ }
  };

  const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="반 편성 및 시간표" actions={<Button variant="dark" size="sm" onClick={() => setAddOpen(true)}><Plus size={13} /> 반 추가</Button>} />
      {loading ? <LoadingSpinner /> : <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 반 목록 */}
        <div className="w-56 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {classes.map((cls) => {
            const clsMembers = students.filter((s) => s.classes.includes(cls.id));
            const activeN = clsMembers.filter((s) => s.status === StudentStatus.ACTIVE).length;
            const onLeaveN = clsMembers.filter((s) => s.status === StudentStatus.ON_LEAVE).length;
            const pct = cls.maxStudents > 0 ? Math.round((activeN / cls.maxStudents) * 100) : 0;
            const isFull = cls.maxStudents > 0 && activeN >= cls.maxStudents;
            return (
              <button key={cls.id} onClick={() => setSelectedClass(cls.id)}
                className={clsx('w-full px-3 py-3 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer', selectedClassId === cls.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                  <span className="text-[12.5px] font-medium text-[#111827] truncate">{cls.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#6b7280]">{cls.teacherName}</span>
                  <span className={clsx('text-[11px] font-medium', isFull ? 'text-[#991B1B]' : 'text-[#065f46]')}>재원 {activeN}/{cls.maxStudents}</span>
                </div>
                {onLeaveN > 0 && <div className="text-[10.5px] text-[#92400E] mt-0.5">휴원 {onLeaveN}명</div>}
                <div className="mt-1.5 h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isFull ? '#ef4444' : '#4fc3a1' }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* 우측: 반 상세 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (() => {
            const classStudents = students.filter((s) => s.classes.includes(selected.id));
            const activeStudents = classStudents.filter((s) => s.status === StudentStatus.ACTIVE);
            const onLeaveStudents = classStudents.filter((s) => s.status === StudentStatus.ON_LEAVE);
            const activeCount = activeStudents.length;
            const onLeaveCount = onLeaveStudents.length;

            return (
              <>
                {/* 반 정보 카드 */}
                <div className="p-5 pb-0 shrink-0">
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selected.color }} />
                        <span className="text-[15px] font-bold text-[#111827]">{selected.name}</span>
                      </div>
                      <Button variant="default" size="sm" onClick={openEdit}>반 수정</Button>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-[12px]">
                      <div>
                        <div className="text-[#6b7280] mb-0.5">강사</div>
                        <div className="font-medium text-[#111827]">{selected.teacherName}</div>
                      </div>
                      <div>
                        <div className="text-[#6b7280] mb-0.5">정원 / 재원 / 휴원</div>
                        <div className="font-medium text-[#111827]">
                          {selected.maxStudents}명 · <span className="text-[#065f46]">재원 {activeCount}</span>
                          {onLeaveCount > 0 && <> · <span className="text-[#92400E]">휴원 {onLeaveCount}</span></>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#6b7280] mb-0.5">수강료</div>
                        <div className="font-medium text-[#111827]">{selected.fee.toLocaleString()}{FEE_TYPE_LABELS[selected.feeType ?? 'monthly']}</div>
                      </div>
                      <div>
                        <div className="text-[#6b7280] mb-0.5">강의실</div>
                        <div className="font-medium text-[#111827]">{selected.room}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 탭 네비게이션 */}
                <Tabs tabs={CLASS_DETAIL_TABS} value={classDetailTab} onChange={setClassDetailTab} className="bg-white px-5 mt-4 shrink-0" />

                {/* 탭 컨텐츠 */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {classDetailTab === 'schedule' && <ScheduleTab key={selected.id} selected={selected} />}
                  {classDetailTab === 'teacher' && <TeacherTab key={selected.id} selected={selected} />}
                  {classDetailTab === 'curriculum' && <CurriculumTab key={selected.id} selected={selected} />}
                </div>
              </>
            );
          })() : (
            <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
              <p className="text-[13px] text-[#9ca3af]">좌측에서 반을 선택하세요</p>
            </div>
          )}
        </div>
      </div>}

      {/* ── 반 추가 모달 ─────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="반 추가" size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setAddOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleAddClass}>등록</Button></>}
      >
        <div className="space-y-3">
          <div><label className="text-[11.5px] text-[#6b7280] block mb-1">반 이름 *</label><input className={fieldCls} value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 초등수학 기초반" /></div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">담당 강사</label>
            <select className={fieldCls} value={addForm.teacherId} onChange={(e) => setAddForm((f) => ({ ...f, teacherId: e.target.value }))}>
              <option value="">강사를 선택하세요</option>
              {teachers.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.subject ? ` (${t.subject})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">정원</label><input type="number" className={fieldCls} value={addForm.maxStudents} onChange={(e) => setAddForm((f) => ({ ...f, maxStudents: e.target.value }))} placeholder="예: 8" min={1} /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">강의실</label><input className={fieldCls} value={addForm.room} onChange={(e) => setAddForm((f) => ({ ...f, room: e.target.value }))} placeholder="예: A강의실" /></div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">수강료</label>
            <div className="flex gap-1.5 mb-2">
              {FEE_TYPES.map((ft) => (
                <button key={ft} type="button" onClick={() => setAddForm((f) => ({ ...f, feeType: ft }))}
                  className={clsx('flex-1 text-[11.5px] py-1.5 rounded-[8px] border transition-colors cursor-pointer', addForm.feeType === ft ? 'bg-[#1a2535] text-white border-[#1a2535]' : 'bg-[#f4f6f8] text-[#6b7280] border-[#e2e8f0] hover:border-[#1a2535]')}
                >{FEE_TYPE_NAMES[ft]}</button>
              ))}
            </div>
            <input type="number" className={fieldCls} value={addForm.fee} onChange={(e) => setAddForm((f) => ({ ...f, fee: e.target.value }))} placeholder={`예: 280000 (${FEE_TYPE_LABELS[addForm.feeType]})`} />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">반 소개글</label>
            <textarea className={fieldCls + ' resize-none'} rows={3} value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="공개 페이지에 노출되는 반 소개입니다. 예: 기초부터 차근차근 다지는 영어 입문반입니다." />
          </div>
        </div>
      </Modal>

      {/* ── 반 수정 모달 ─────────────────────────────────── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="반 수정" size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setEditOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleEditClass}>저장</Button></>}
      >
        <div className="space-y-3">
          <div><label className="text-[11.5px] text-[#6b7280] block mb-1">반 이름 *</label><input className={fieldCls} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">담당 강사</label>
            <select className={fieldCls} value={editForm.teacherId} onChange={(e) => setEditForm((f) => ({ ...f, teacherId: e.target.value }))}>
              <option value="">강사를 선택하세요</option>
              {teachers.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.subject ? ` (${t.subject})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">정원</label><input type="number" className={fieldCls} value={editForm.maxStudents} onChange={(e) => setEditForm((f) => ({ ...f, maxStudents: e.target.value }))} min={1} /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">강의실</label><input className={fieldCls} value={editForm.room} onChange={(e) => setEditForm((f) => ({ ...f, room: e.target.value }))} /></div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">수강료</label>
            <div className="flex gap-1.5 mb-2">
              {FEE_TYPES.map((ft) => (
                <button key={ft} type="button" onClick={() => setEditForm((f) => ({ ...f, feeType: ft }))}
                  className={clsx('flex-1 text-[11.5px] py-1.5 rounded-[8px] border transition-colors cursor-pointer', editForm.feeType === ft ? 'bg-[#1a2535] text-white border-[#1a2535]' : 'bg-[#f4f6f8] text-[#6b7280] border-[#e2e8f0] hover:border-[#1a2535]')}
                >{FEE_TYPE_NAMES[ft]}</button>
              ))}
            </div>
            <input type="number" className={fieldCls} value={editForm.fee} onChange={(e) => setEditForm((f) => ({ ...f, fee: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">반 소개글</label>
            <textarea className={fieldCls + ' resize-none'} rows={3} value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="공개 페이지에 노출되는 반 소개입니다." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
