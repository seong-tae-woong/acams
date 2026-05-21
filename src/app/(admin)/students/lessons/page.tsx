'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Topbar from '@/components/admin/Topbar';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useLessonStore } from '@/lib/stores/lessonStore';
import { toast } from '@/lib/stores/toastStore';
import FilterBar from './_components/FilterBar';
import SummaryCard from './_components/SummaryCard';
import TimelineList from './_components/TimelineList';

function defaultRange() {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setMonth(fromDate.getMonth() - 3);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

function StudentLessonsInner() {
  const search = useSearchParams();
  const { students, fetchStudents } = useStudentStore();
  const { classes, fetchClasses } = useClassStore();
  const {
    studentHistory,
    studentHistoryLoading,
    fetchStudentHistory,
    clearStudentHistory,
  } = useLessonStore();

  const { from: defFrom, to: defTo } = defaultRange();

  const [studentId, setStudentId] = useState(search.get('studentId') ?? '');
  const [classId, setClassId] = useState(search.get('classId') ?? '');
  const [from, setFrom] = useState(search.get('from') ?? defFrom);
  const [to, setTo] = useState(search.get('to') ?? defTo);
  const [searched, setSearched] = useState(false);

  // 데이터 로드
  useEffect(() => {
    if (students.length === 0) fetchStudents();
    if (classes.length === 0) fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 페이지 떠날 때 이력 클리어
  useEffect(() => {
    return () => {
      clearStudentHistory();
    };
  }, [clearStudentHistory]);

  // URL 쿼리로 자동 조회 (학생 상세 모달에서 진입 시)
  useEffect(() => {
    const queryStudentId = search.get('studentId');
    if (queryStudentId && from && to) {
      // students 로딩 후 자동 조회
      if (students.length > 0) {
        runSearch(queryStudentId, search.get('classId') ?? '', from, to);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.length]);

  const runSearch = async (sid: string, cid: string, f: string, t: string) => {
    try {
      await fetchStudentHistory({
        studentId: sid,
        classId: cid || undefined,
        from: f,
        to: t,
      });
      setSearched(true);
    } catch {
      toast('수업 이력 조회에 실패했습니다.', 'error');
    }
  };

  const handleSearch = () => {
    if (!studentId) {
      toast('학생을 선택해 주세요.', 'error');
      return;
    }
    runSearch(studentId, classId, from, to);
  };

  return (
    <>
      <Topbar title="수업 이력" actions={<div />} />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <FilterBar
          studentId={studentId}
          classId={classId}
          from={from}
          to={to}
          loading={studentHistoryLoading}
          setStudentId={setStudentId}
          setClassId={setClassId}
          setFrom={setFrom}
          setTo={setTo}
          onSearch={handleSearch}
        />

        {studentHistoryLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : !searched ? (
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-8 text-center">
            <div className="text-[13px] text-[#6b7280]">
              학생과 기간을 선택한 후 <span className="font-semibold text-[#111827]">조회</span> 버튼을 눌러주세요.
            </div>
          </div>
        ) : studentHistory ? (
          <>
            <SummaryCard data={studentHistory} />
            <TimelineList timeline={studentHistory.timeline} />
          </>
        ) : null}
      </div>
    </>
  );
}

export default function StudentLessonsPage() {
  return (
    <Suspense fallback={<div className="p-5 text-[12.5px] text-[#9ca3af]">로딩 중...</div>}>
      <StudentLessonsInner />
    </Suspense>
  );
}
