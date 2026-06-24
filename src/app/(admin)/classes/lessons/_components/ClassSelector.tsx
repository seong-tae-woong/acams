'use client';
import clsx from 'clsx';

/**
 * 반 선택 칩 (수업 관리 탭 공용 — 수업 이력 / 시험 목록 / 과제)
 *
 * 줄바꿈(flex-wrap) pill 레이아웃으로 통일. 선택된 반은 반 색상으로 강조.
 * onSelect로 탭별 부가 동작(필터 초기화 등)을 위임받는다.
 */

interface ClassSelectorClass {
  id: string;
  name: string;
  color: string;
}

interface ClassSelectorProps {
  classes: ClassSelectorClass[];
  selectedClassId: string;
  onSelect: (id: string) => void;
  /** '전체' 칩 표시 여부 (전체 = classId '') */
  showAll?: boolean;
}

const CHIP = 'px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium border transition-colors cursor-pointer';

export default function ClassSelector({ classes, selectedClassId, onSelect, showAll = false }: ClassSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {showAll && (
        <button
          onClick={() => onSelect('')}
          className={clsx(
            CHIP,
            selectedClassId === ''
              ? 'text-white border-transparent bg-[#1a2535]'
              : 'text-[#374151] border-[#e2e8f0] bg-white hover:bg-[#f4f6f8]',
          )}
        >
          전체
        </button>
      )}
      {classes.map((cls) => (
        <button
          key={cls.id}
          onClick={() => onSelect(cls.id)}
          className={clsx(
            CHIP,
            selectedClassId === cls.id
              ? 'text-white border-transparent'
              : 'text-[#374151] border-[#e2e8f0] bg-white hover:bg-[#f4f6f8]',
          )}
          style={selectedClassId === cls.id ? { backgroundColor: cls.color } : {}}
        >
          {cls.name}
        </button>
      ))}
    </div>
  );
}
