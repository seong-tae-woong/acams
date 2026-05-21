'use client';
import { useMemo } from 'react';
import Button from '@/components/shared/Button';
import { Search } from 'lucide-react';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useClassStore } from '@/lib/stores/classStore';
import { StudentStatus } from '@/lib/types/student';

interface FilterBarProps {
  studentId: string;
  classId: string;
  from: string;
  to: string;
  loading: boolean;
  setStudentId: (id: string) => void;
  setClassId: (id: string) => void;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  onSearch: () => void;
}

const fieldClass =
  'text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] bg-white';

export default function FilterBar({
  studentId,
  classId,
  from,
  to,
  loading,
  setStudentId,
  setClassId,
  setFrom,
  setTo,
  onSearch,
}: FilterBarProps) {
  const { students } = useStudentStore();
  const { classes } = useClassStore();

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === StudentStatus.ACTIVE).sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );

  // 선택된 학생이 속한 반만 옵션으로
  const studentClasses = useMemo(() => {
    if (!studentId) return [];
    const s = students.find((x) => x.id === studentId);
    if (!s) return [];
    return classes.filter((c) => s.classes.includes(c.id));
  }, [studentId, students, classes]);

  const onStudentChange = (newId: string) => {
    setStudentId(newId);
    setClassId(''); // 학생 바뀌면 반 선택 리셋
  };

  const validRange = !!from && !!to && from <= to;
  const canSearch = !!studentId && validRange && !loading;

  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6b7280]">학생</label>
          <select
            value={studentId}
            onChange={(e) => onStudentChange(e.target.value)}
            className={fieldClass + ' min-w-[140px]'}
          >
            <option value="">학생 선택</option>
            {activeStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6b7280]">반</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={!studentId || studentClasses.length === 0}
            className={fieldClass + ' min-w-[140px] disabled:bg-[#f9fafb] disabled:text-[#9ca3af]'}
          >
            <option value="">전체</option>
            {studentClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6b7280]">시작일</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={fieldClass}
          />
        </div>

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
