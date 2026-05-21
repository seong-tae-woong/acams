'use client';
import { useMemo, useState, useRef, useEffect } from 'react';
import Button from '@/components/shared/Button';
import { Search, ChevronDown, Check } from 'lucide-react';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useClassStore } from '@/lib/stores/classStore';
import { StudentStatus } from '@/lib/types/student';

interface FilterBarProps {
  classIds: string[];        // 선택된 반 ID 배열 (빈 배열 = 전체)
  studentId: string;
  from: string;
  to: string;
  loading: boolean;
  setClassIds: (ids: string[]) => void;
  setStudentId: (id: string) => void;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  onSearch: () => void;
}

const fieldClass =
  'text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] bg-white';

// ── 반 다중선택 드롭다운 ──────────────────────────────────────
interface ClassMultiSelectProps {
  classes: { id: string; name: string; color: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function ClassMultiSelect({ classes, selectedIds, onChange }: ClassMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAllSelected = selectedIds.length === 0;

  const label = isAllSelected
    ? '전체'
    : selectedIds.length === 1
    ? (classes.find((c) => c.id === selectedIds[0])?.name ?? '반 선택')
    : `${selectedIds.length}개 반`;

  const toggleAll = () => onChange([]);

  const toggleClass = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          fieldClass +
          ' min-w-[160px] flex items-center justify-between gap-2 cursor-pointer'
        }
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className={`shrink-0 text-[#9ca3af] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-[#e2e8f0] rounded-[8px] shadow-lg min-w-[180px] py-1 max-h-60 overflow-y-auto">
          {/* 전체 옵션 */}
          <button
            type="button"
            onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f9fafb] text-left"
          >
            <span
              className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                isAllSelected ? 'bg-[#1a2535] border-[#1a2535]' : 'border-[#d1d5db]'
              }`}
            >
              {isAllSelected && <Check size={10} className="text-white" strokeWidth={3} />}
            </span>
            <span className="text-[12.5px] font-medium text-[#111827]">전체</span>
          </button>

          {classes.length > 0 && <div className="border-t border-[#f3f4f6] mx-2 my-1" />}

          {classes.map((c) => {
            const checked = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleClass(c.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f9fafb] text-left"
              >
                <span
                  className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                    checked ? 'bg-[#1a2535] border-[#1a2535]' : 'border-[#d1d5db]'
                  }`}
                >
                  {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: c.color }}
                />
                <span className="text-[12.5px] text-[#111827] truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 메인 FilterBar ────────────────────────────────────────────
export default function FilterBar({
  classIds,
  studentId,
  from,
  to,
  loading,
  setClassIds,
  setStudentId,
  setFrom,
  setTo,
  onSearch,
}: FilterBarProps) {
  const { students } = useStudentStore();
  const { classes } = useClassStore();

  // 활성 학생만
  const activeStudents = useMemo(
    () =>
      students
        .filter((s) => s.status === StudentStatus.ACTIVE)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );

  // 선택된 반이 있으면 해당 반 소속 학생만, 없으면 전체
  const availableStudents = useMemo(() => {
    if (classIds.length === 0) return activeStudents;
    return activeStudents.filter((s) => classIds.some((cId) => s.classes.includes(cId)));
  }, [classIds, activeStudents]);

  // 반 변경 시 선택된 학생이 대상 목록에 없으면 리셋
  const onClassIdsChange = (ids: string[]) => {
    setClassIds(ids);
    if (studentId) {
      const student = students.find((s) => s.id === studentId);
      if (student) {
        const stillValid =
          ids.length === 0 || ids.some((cId) => student.classes.includes(cId));
        if (!stillValid) setStudentId('');
      }
    }
  };

  const validRange = !!from && !!to && from <= to;
  const canSearch = !!studentId && validRange && !loading;

  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* ① 반 (다중선택 드롭다운) */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6b7280]">반</label>
          <ClassMultiSelect
            classes={classes}
            selectedIds={classIds}
            onChange={onClassIdsChange}
          />
        </div>

        {/* ② 학생 (반 필터 기준 목록) */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6b7280]">학생</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={fieldClass + ' min-w-[140px]'}
          >
            <option value="">학생 선택</option>
            {availableStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* ③ 시작일 */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6b7280]">시작일</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={fieldClass}
          />
        </div>

        {/* ④ 종료일 */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6b7280]">종료일</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={fieldClass}
          />
        </div>

        <Button variant="dark" size="md" onClick={onSearch} disabled={!canSearch}>
          <Search size={13} /> {loading ? '조회 중...' : '조회'}
        </Button>
      </div>

      {!validRange && (from || to) && (
        <div className="mt-2 text-[11.5px] text-[#ef4444]">시작일은 종료일 이전이어야 합니다.</div>
      )}
    </div>
  );
}
