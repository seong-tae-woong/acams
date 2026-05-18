'use client';
import Avatar from '@/components/shared/Avatar';
import { useTeacherStore } from '@/lib/stores/teacherStore';
import { Plus } from 'lucide-react';
import clsx from 'clsx';

export default function TeachersList({
  selectedId,
  setSelectedId,
  openRegister,
}: {
  selectedId: string;
  setSelectedId: (id: string) => void;
  openRegister: () => void;
}) {
  const { teachers } = useTeacherStore();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 강사 추가 버튼 */}
      <div className="p-3 border-b border-[#e2e8f0] shrink-0">
        <button
          onClick={openRegister}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-[12px] font-medium bg-[#1a2535] text-white hover:bg-[#263347] transition-colors cursor-pointer"
        >
          <Plus size={13} /> 강사 추가
        </button>
      </div>
      {/* 강사 목록 */}
      <div className="flex-1 overflow-y-auto">
        {teachers.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-3 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer',
              selectedId === t.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
            )}
          >
            <Avatar name={t.name} color={t.avatarColor} size="sm" />
            <div>
              <div className="text-[12.5px] font-medium text-[#111827]">{t.name}</div>
              <div className="text-[11px] text-[#6b7280]">
                {t.subject} · {t.isActive ? '활성' : '비활성'}
              </div>
            </div>
            {!t.isActive && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-[#f1f5f9] text-[#9ca3af] rounded">비활성</span>
            )}
          </button>
        ))}
        {teachers.length === 0 && (
          <div className="p-4 text-center text-[12px] text-[#9ca3af]">등록된 강사가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
