'use client';
// edit-flow v1
import { useState, useEffect } from 'react';
import { useClassStore } from '@/lib/stores/classStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { type MainTab } from './_shared';
import ExamTab from './_tabs/ExamTab';
import AssignmentTab from './_tabs/AssignmentTab';
import PublishTab from './_tabs/PublishTab';
import ReportTemplatesTab from './_tabs/ReportTemplatesTab';

export default function GradesPage() {
  const { classes, fetchClasses } = useClassStore();
  const { fetchCategories } = useGradeStore();
  const { students, fetchStudents } = useStudentStore();
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? '');

  // 메인 탭 (시험 목록 | 과제)
  const [mainTab, setMainTab] = useState<MainTab>('exam');

  useEffect(() => {
    if (students.length === 0) fetchStudents();
    if (classes.length === 0) fetchClasses();
    fetchCategories().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 클래스가 늦게 로드되어 selectedClassId가 비었으면 첫번째로 자동 설정
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
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
