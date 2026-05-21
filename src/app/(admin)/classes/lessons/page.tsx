'use client';
// edit-flow v1
import { useState, useEffect } from 'react';
import { useClassStore } from '@/lib/stores/classStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { type MainTab } from './_shared';
import LessonHistoryTab from './_tabs/LessonHistoryTab';
import ExamTab from './_tabs/ExamTab';
import AssignmentTab from './_tabs/AssignmentTab';
import PublishTab from './_tabs/PublishTab';
import ReportTemplatesTab from './_tabs/ReportTemplatesTab';

export default function LessonsPage() {
  const { classes, fetchClasses } = useClassStore();
  const { fetchCategories } = useGradeStore();
  const { students, fetchStudents } = useStudentStore();
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? '');

  // 메인 탭 (수업 이력 | 시험 목록 | 과제 | 리포트 발행 | 리포트 양식)
  const [mainTab, setMainTab] = useState<MainTab>('history');

  useEffect(() => {
    if (students.length === 0) fetchStudents();
    if (classes.length === 0) fetchClasses();
    fetchCategories().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 클래스가 늦게 로드되어 selectedClassId가 비었으면 첫번째로 자동 설정
  // 단, 수업 이력 탭은 '전체' 보기 옵션이 있어 빈 값을 허용
  useEffect(() => {
    if (mainTab !== 'history' && !selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [mainTab, classes, selectedClassId]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {mainTab === 'history' && (
        <LessonHistoryTab
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          mainTab={mainTab}
          setMainTab={setMainTab}
        />
      )}
      {mainTab === 'exam' && (
        <ExamTab
          key={selectedClassId}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          mainTab={mainTab}
          setMainTab={setMainTab}
        />
      )}
      {mainTab === 'assignment' && (
        <AssignmentTab
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          mainTab={mainTab}
          setMainTab={setMainTab}
        />
      )}
      {mainTab === 'publish' && (
        <PublishTab mainTab={mainTab} setMainTab={setMainTab} />
      )}
      {mainTab === 'report-templates' && (
        <ReportTemplatesTab mainTab={mainTab} setMainTab={setMainTab} />
      )}
    </div>
  );
}
