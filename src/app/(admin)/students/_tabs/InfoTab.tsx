'use client';
import { useState } from 'react';
import Avatar from '@/components/shared/Avatar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useStudentStore } from '@/lib/stores/studentStore';
import type { Student } from '@/lib/types/student';
import { formatKoreanDate, formatPhone } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus, StickyNote, Users, X } from 'lucide-react';
import clsx from 'clsx';

export default function InfoTab({ student }: { student: Student }) {
  const { students, updateStudent, syncSiblings } = useStudentStore();

  const [siblingOpen, setSiblingOpen] = useState(false);
  const [siblingSearch, setSiblingSearch] = useState('');
  const [siblingChecked, setSiblingChecked] = useState<Set<string>>(new Set());

  const openSiblingModal = () => {
    const samePhone = students
      .filter((s) => s.id !== student.id && s.parentPhone && s.parentPhone === student.parentPhone)
      .map((s) => s.id);
    setSiblingChecked(new Set([...student.siblingIds, ...samePhone]));
    setSiblingSearch('');
    setSiblingOpen(true);
  };

  const toggleSiblingCheck = (id: string) => {
    setSiblingChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSiblingsSave = async () => {
    await syncSiblings(student.id, [...siblingChecked]);
    setSiblingOpen(false);
    toast('형제/자매 정보가 저장되었습니다.', 'success');
  };

  const removeSibling = async (siblingId: string) => {
    await syncSiblings(student.id, student.siblingIds.filter((id) => id !== siblingId));
  };

  const siblingCandidateList = students.filter((s) => {
    if (s.id === student.id) return false;
    if (!siblingSearch) return true;
    return s.name.includes(siblingSearch) || s.school.includes(siblingSearch);
  });

  const samePhoneIds = new Set(
    students.filter((s) => s.id !== student.id && s.parentPhone && s.parentPhone === student.parentPhone).map((s) => s.id),
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
          <div className="text-[12.5px] font-semibold text-[#111827] mb-3">인적사항</div>
          <dl className="space-y-2">
            {[
              ['이름', student.name],
              ['학교', `${student.school} ${student.grade}학년`],
              ['학생 연락처', formatPhone(student.phone)],
              ['보호자', student.parentName],
              ['보호자 연락처', formatPhone(student.parentPhone)],
              ['입원일', formatKoreanDate(student.enrollDate)],
            ].map(([label, value]) => (
              <div key={label} className="flex">
                <dt className="w-28 text-[12px] text-[#6b7280] shrink-0">{label}</dt>
                <dd className="text-[12.5px] text-[#111827]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-4">
          {/* 형제/자매 카드 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12.5px] font-semibold text-[#111827] flex items-center gap-1">
                <Users size={13} /> 형제/자매
              </div>
              <button
                onClick={openSiblingModal}
                className="flex items-center gap-1 text-[11.5px] text-[#4fc3a1] hover:text-[#3aab8a] font-medium cursor-pointer"
              >
                <Plus size={12} /> 추가/수정
              </button>
            </div>
            {student.siblingIds.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af]">등록된 형제/자매 없음</p>
            ) : (
              <div className="space-y-1.5">
                {student.siblingIds.map((id) => {
                  const sibling = students.find((s) => s.id === id);
                  return sibling ? (
                    <div key={id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[12px]">
                        <Avatar name={sibling.name} color={sibling.avatarColor} size="sm" />
                        <span className="text-[#111827]">{sibling.name}</span>
                        <span className="text-[#9ca3af]">({sibling.school} {sibling.grade}학년)</span>
                      </div>
                      <button
                        onClick={() => removeSibling(id)}
                        className="text-[#9ca3af] hover:text-[#ef4444] cursor-pointer shrink-0"
                        title="형제/자매 해제"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
            <div className="text-[12.5px] font-semibold text-[#111827] mb-2 flex items-center gap-1">
              <StickyNote size={13} /> 내부 메모 <span className="text-[10px] font-normal text-[#9ca3af]">(보호자 비공개)</span>
            </div>
            <textarea
              defaultValue={student.memo}
              rows={4}
              className="w-full text-[12px] border border-[#e2e8f0] rounded-[8px] p-2 resize-none focus:outline-none focus:border-[#4fc3a1] text-[#374151]"
              placeholder="메모를 입력하세요..."
              onBlur={(e) => updateStudent(student.id, { memo: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* 형제/자매 관리 모달 */}
      <Modal
        open={siblingOpen}
        onClose={() => setSiblingOpen(false)}
        title="형제/자매 관리"
        size="md"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setSiblingOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleSiblingsSave}>저장</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12px] text-[#6b7280]">
            형제/자매로 연결할 학생을 선택하세요. 같은 보호자 번호의 학생은 자동으로 추천됩니다.
          </p>
          <input
            type="text"
            value={siblingSearch}
            onChange={(e) => setSiblingSearch(e.target.value)}
            placeholder="이름, 학교로 검색"
            className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]"
          />
          <div className="max-h-64 overflow-y-auto space-y-1 border border-[#e2e8f0] rounded-[8px] p-1">
            {siblingCandidateList.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-4">검색 결과가 없습니다</p>
            ) : siblingCandidateList.map((s) => {
              const isSamePhone = samePhoneIds.has(s.id);
              const isChecked = siblingChecked.has(s.id);
              return (
                <label
                  key={s.id}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-[6px] cursor-pointer hover:bg-[#f4f6f8]',
                    isChecked && 'bg-[#E1F5EE]',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSiblingCheck(s.id)}
                    className="accent-[#4fc3a1] shrink-0"
                  />
                  <Avatar name={s.name} color={s.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-[#111827]">{s.name}</span>
                      {isSamePhone && (
                        <span className="text-[10px] bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded-full font-medium">
                          보호자 번호 일치
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#6b7280]">{s.school} · {s.grade}학년</div>
                  </div>
                </label>
              );
            })}
          </div>
          {siblingChecked.size > 0 && (
            <p className="text-[11.5px] text-[#4fc3a1] font-medium">{siblingChecked.size}명 선택됨</p>
          )}
        </div>
      </Modal>
    </>
  );
}
