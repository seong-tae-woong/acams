'use client';
import { useEffect } from 'react';
import { useClassStore } from '@/lib/stores/classStore';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import type { ClassInfo } from '@/lib/types/class';
import { Phone, Mail, ToggleLeft, ToggleRight } from 'lucide-react';
import { PERMISSION_LABELS } from '../_shared';

export default function TeacherTab({ selected }: { selected: ClassInfo }) {
  const { classes } = useClassStore();
  const { teachers, fetchTeachers } = useTeacherStore();

  // 강사 탭 진입 시 강사 목록 리로드
  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  // 강사 탭: teacherId 우선 조회 → teacher.classes 기반 → 이름 기반 순으로 폴백
  const assignedTeacher = (selected.teacherId ? teachers.find((t) => t.id === selected.teacherId) : null)
    ?? teachers.find((t) => t.classes.includes(selected.id))
    ?? teachers.find((t) => t.name === selected.teacherName);

  return (
    <div className="space-y-4">
      {assignedTeacher ? (
        <>
          {/* 강사 기본 정보 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white shrink-0" style={{ backgroundColor: assignedTeacher.avatarColor }}>{assignedTeacher.name[0]}</span>
              <div>
                <div className="text-[14px] font-bold text-[#111827]">{assignedTeacher.name}</div>
                <div className="text-[12px] text-[#6b7280]">{assignedTeacher.subject}</div>
              </div>
            </div>
            <dl className="space-y-2">
              <div className="flex">
                <dt className="w-24 text-[12px] text-[#6b7280] shrink-0 flex items-center gap-1"><Phone size={11} /> 연락처</dt>
                <dd className="text-[12.5px] text-[#111827]">{assignedTeacher.phone}</dd>
              </div>
              <div className="flex">
                <dt className="w-24 text-[12px] text-[#6b7280] shrink-0 flex items-center gap-1"><Mail size={11} /> 이메일</dt>
                <dd className="text-[12.5px] text-[#111827]">{assignedTeacher.email}</dd>
              </div>
            </dl>
          </div>
          {/* 권한 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
            <div className="text-[12.5px] font-semibold text-[#111827] mb-3">권한 현황</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(assignedTeacher.permissions).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between px-3 py-2 bg-[#f4f6f8] rounded-[8px]">
                  <span className="text-[12px] text-[#374151]">{PERMISSION_LABELS[key] ?? key}</span>
                  {value
                    ? <ToggleRight size={18} className="text-[#4fc3a1]" />
                    : <ToggleLeft size={18} className="text-[#d1d5db]" />
                  }
                </div>
              ))}
            </div>
          </div>
          {/* 담당 반 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
            <div className="text-[12.5px] font-semibold text-[#111827] mb-3">담당 반</div>
            <div className="flex flex-wrap gap-2">
              {classes
                .filter((c) => c.teacherId === assignedTeacher.id || assignedTeacher.classes.includes(c.id))
                .map((c) => (
                  <span key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] text-white font-medium" style={{ backgroundColor: c.color }}>{c.name}</span>
                ))
              }
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-8 text-center">
          <p className="text-[13px] text-[#9ca3af]">배정된 강사가 없습니다.</p>
          <p className="text-[12px] text-[#9ca3af] mt-1">반 수정에서 강사를 선택하거나, 계정 관리에서 강사를 먼저 등록하세요.</p>
        </div>
      )}
    </div>
  );
}
