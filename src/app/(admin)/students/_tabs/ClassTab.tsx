'use client';
import { useClassStore } from '@/lib/stores/classStore';
import type { Student } from '@/lib/types/student';

export default function ClassTab({ student }: { student: Student }) {
  const { classes } = useClassStore();
  const studentClasses = classes.filter((c) => student.classes.includes(c.id));

  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
      <div className="text-[12.5px] font-semibold text-[#111827] mb-3">수강 중인 반</div>
      {studentClasses.length === 0 ? (
        <p className="text-[12px] text-[#9ca3af]">배정된 반 없음</p>
      ) : (
        <div className="space-y-2">
          {studentClasses.map((cls) => (
            <div key={cls.id} className="flex items-center justify-between p-3 bg-[#f4f6f8] rounded-[8px]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                  <span className="text-[13px] font-medium text-[#111827]">{cls.name}</span>
                </div>
                <div className="text-[11.5px] text-[#6b7280] mt-0.5 ml-4">
                  {cls.teacherName} · {cls.schedule.map((s) => `${['','월','화','수','목','금','토','일'][s.dayOfWeek]}${s.startTime}`).join(', ')}
                </div>
              </div>
              <span className="text-[12px] text-[#6b7280]">{cls.fee.toLocaleString()}원/월</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
