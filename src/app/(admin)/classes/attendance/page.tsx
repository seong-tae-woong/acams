'use client';
import { useState, useCallback, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { AttendanceStatus } from '@/lib/types/attendance';
import { DAY_NAMES } from '@/lib/types/class';
import clsx from 'clsx';
import { CheckCheck, XCircle, Save, Bell, CalendarDays, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import AttendanceCalendarModal from '@/components/admin/AttendanceCalendarModal';

const STATUS_OPTIONS = [
  { value: AttendanceStatus.PRESENT, label: '출석', color: '#065f46', bg: '#D1FAE5' },
  { value: AttendanceStatus.ABSENT, label: '결석', color: '#991B1B', bg: '#FEE2E2' },
  { value: AttendanceStatus.LATE, label: '지각', color: '#92400E', bg: '#FEF3C7' },
  { value: AttendanceStatus.EARLY_LEAVE, label: '조퇴', color: '#1d4ed8', bg: '#DBEAFE' },
];

export default function ClassAttendancePage() {
  const { classes, selectedClassId, loading, setSelectedClass, fetchClasses } = useClassStore();
  const { students, fetchStudents } = useStudentStore();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetchClasses();
    fetchStudents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [attMap, setAttMap] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);
  const [loadingAtt, setLoadingAtt] = useState(false);

  const loadAttendance = useCallback(async (classId: string, date: string) => {
    setLoadingAtt(true);
    try {
      const res = await fetch(`/api/attendance?classId=${classId}&date=${date}`);
      const data = await res.json();
      if (data.records) {
        const map: Record<string, AttendanceStatus> = {};
        data.records.forEach((r: { studentId: string; status: string }) => {
          map[r.studentId] = r.status as AttendanceStatus;
        });
        setAttMap(map);
        setSaved(false);
      }
    } finally {
      setLoadingAtt(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId && selectedDate) loadAttendance(selectedClassId, selectedDate);
  }, [selectedClassId, selectedDate, loadAttendance]);

  // 출결 현황 팝업
  const [attModalStudentId, setAttModalStudentId] = useState<string | null>(null);
  const [attModalStudentName, setAttModalStudentName] = useState('');

  const selected = classes.find((c) => c.id === selectedClassId);
  const classStudents = selected ? students.filter((s) => s.classes.includes(selected.id)) : [];

  const setStatus = useCallback((studentId: string, status: AttendanceStatus) => {
    setAttMap((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }, []);

  const setAll = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus> = {};
    classStudents.forEach((s) => { all[s.id] = status; });
    setAttMap(all);
    setSaved(false);
  };

  const filledCount = Object.keys(attMap).length;
  const allFilled = filledCount === classStudents.length && classStudents.length > 0;

  const absentCount = Object.values(attMap).filter((v) => v === AttendanceStatus.ABSENT).length;

  const handleSave = () => {
    if (!allFilled) { toast('모든 학생의 출결을 입력해주세요.', 'error'); return; }
    setSaved(true);
    toast(`출결 저장 완료. 결석 ${absentCount}명에게 알림톡 발송 예정 (20분 후)`, 'success');
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="출결 체크" badge="입력 전용" />
      {loading ? <LoadingSpinner /> : <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 날짜 + 반 선택 */}
        <div className="w-52 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {/* 날짜 선택 */}
          <div className="p-3 border-b border-[#e2e8f0]">
            <label className="text-[11.5px] text-[#6b7280] block mb-1">날짜 선택</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setAttMap({}); setSaved(false); }}
              className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1]"
            />
          </div>

          {/* 반 목록 */}
          <div className="p-2 space-y-1">
            <p className="text-[10.5px] text-[#9ca3af] px-2 pt-1">수업 목록</p>
            {classes.map((cls) => {
              const dayOfWeek = new Date(selectedDate).getDay() || 7;
              const hasClassToday = cls.schedule.some((s) => s.dayOfWeek === dayOfWeek);
              if (!hasClassToday) return null;
              return (
                <button
                  key={cls.id}
                  onClick={() => { setSelectedClass(cls.id); setAttMap({}); setSaved(false); }}
                  className={clsx(
                    'w-full px-3 py-2.5 rounded-[8px] text-left transition-colors cursor-pointer',
                    selectedClassId === cls.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                    <span className="text-[12.5px] font-medium text-[#111827] truncate">{cls.name}</span>
                  </div>
                  {cls.schedule.filter((s) => s.dayOfWeek === dayOfWeek).map((s, i) => (
                    <div key={i} className="text-[11px] text-[#6b7280] mt-0.5 ml-3.5">
                      {s.startTime}~{s.endTime}
                    </div>
                  ))}
                </button>
              );
            })}
            {!classes.some((cls) => cls.schedule.some((s) => s.dayOfWeek === (new Date(selectedDate).getDay() || 7))) && (
              <div className="p-4 text-center text-[12px] text-[#9ca3af]">선택한 날짜에 수업 없음</div>
            )}
          </div>
        </div>

        {/* 우측: 출결 입력 */}
        {selected && classStudents.length > 0 ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 반 정보 */}
            <div className="bg-white border-b border-[#e2e8f0] px-5 py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selected.color }} />
                  <span className="text-[14px] font-semibold text-[#111827]">{selected.name}</span>
                </div>
                <div className="text-[12px] text-[#6b7280] mt-0.5">
                  {selectedDate} · {selected.schedule
                    .filter((s) => s.dayOfWeek === (new Date(selectedDate).getDay() || 7))
                    .map((s) => `${s.startTime}~${s.endTime}`)
                    .join(', ')}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => loadAttendance(selectedClassId!, selectedDate)} disabled={loadingAtt}>
                  <RefreshCw size={13} className={loadingAtt ? 'animate-spin' : ''} /> 새로고침
                </Button>
                <Button variant="primary" size="sm" onClick={() => setAll(AttendanceStatus.PRESENT)}>
                  <CheckCheck size={13} /> 전체 출석
                </Button>
                <Button variant="danger" size="sm" onClick={() => setAll(AttendanceStatus.ABSENT)}>
                  <XCircle size={13} /> 전체 결석
                </Button>
              </div>
            </div>

            {/* 학생 목록 */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0">
                  <tr className="bg-[#f4f6f8] border-b border-[#e2e8f0]">
                    <th className="text-left px-5 py-3 text-[#6b7280] font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 text-[#6b7280] font-medium">이름</th>
                    <th className="px-4 py-3 text-[#6b7280] font-medium text-center" colSpan={4}>출결</th>
                    <th className="text-left px-4 py-3 text-[#6b7280] font-medium">메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {classStudents.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-[#f9fafb]">
                      <td className="px-5 py-3 text-[#9ca3af] text-[11.5px]">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ backgroundColor: s.avatarColor }}>{s.name[0]}</span>
                          <span className="text-[#111827] font-medium">{s.name}</span>
                          <button
                            onClick={() => { setAttModalStudentId(s.id); setAttModalStudentName(s.name); }}
                            className="ml-0.5 p-1 text-[#9ca3af] hover:text-[#4fc3a1] hover:bg-[#E1F5EE] rounded-[5px] cursor-pointer"
                            title="출결 현황 보기"
                          >
                            <CalendarDays size={13} />
                          </button>
                        </div>
                      </td>
                      {STATUS_OPTIONS.map((opt) => (
                        <td key={opt.value} className="py-3 text-center">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`att-${s.id}`}
                              value={opt.value}
                              checked={attMap[s.id] === opt.value}
                              onChange={() => setStatus(s.id, opt.value)}
                              className="sr-only"
                            />
                            <span
                              className={clsx(
                                'px-2.5 py-1 rounded-[20px] text-[11.5px] font-medium transition-all cursor-pointer',
                                attMap[s.id] === opt.value
                                  ? 'text-white'
                                  : 'bg-[#f1f5f9] text-[#9ca3af] hover:bg-[#e2e8f0]',
                              )}
                              style={attMap[s.id] === opt.value ? { backgroundColor: opt.color } : {}}
                              onClick={() => setStatus(s.id, opt.value)}
                            >
                              {opt.label}
                            </span>
                          </label>
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="메모"
                          className="w-full text-[12px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 focus:outline-none focus:border-[#4fc3a1]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 저장 바 */}
            <div className="border-t border-[#e2e8f0] bg-white px-5 py-3 flex items-center justify-between">
              <div className="text-[12px] text-[#6b7280]">
                입력 완료: <span className="font-semibold text-[#111827]">{filledCount}</span>/{classStudents.length}명
                {absentCount > 0 && (
                  <span className="ml-3 flex items-center gap-1 inline-flex text-[#991B1B]">
                    <Bell size={11} /> 결석 {absentCount}명 보호자에게 알림톡 자동 발송 (저장 20분 후)
                  </span>
                )}
              </div>
              <Button
                variant={saved ? 'default' : 'dark'}
                size="md"
                onClick={handleSave}
                disabled={saved}
              >
                <Save size={13} />
                {saved ? '저장 완료' : '출결 저장'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
            <p className="text-[13px] text-[#9ca3af]">
              {selected ? '수강생이 없습니다' : '날짜와 수업을 선택하세요'}
            </p>
          </div>
        )}
      </div>}

      {/* 출결 현황 팝업 */}
      <AttendanceCalendarModal
        open={!!attModalStudentId}
        onClose={() => setAttModalStudentId(null)}
        studentId={attModalStudentId ?? ''}
        studentName={attModalStudentName}
      />
    </div>
  );
}
