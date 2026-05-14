'use client';
import { useEffect, useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import { ChevronLeft, ClipboardList, FileText, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMobileChild } from '@/contexts/MobileChildContext';

type ExamInfo = {
  id: string;
  name: string;
  subject: string;
  date: string;
  totalScore: number;
  description?: string;
  className: string;
  classSubject: string;
};

type UpcomingAssignment = {
  id: string;
  date: string;
  dueDate: string;
  memo: string;
  className: string;
  classSubject: string;
};

type ReportListItem = {
  id: string;
  kind: 'PER_EXAM' | 'PERIODIC';
  title: string;
  summary: string;
  periodLabel: string;
  publishedAt: string;
  unread: boolean;
};

export default function MobileGradesPage() {
  const { selectedChildId } = useMobileChild();
  const [studentName, setStudentName] = useState('');
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingExams, setUpcomingExams] = useState<ExamInfo[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<UpcomingAssignment[]>([]);
  const [expandedExamIds, setExpandedExamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const toggleExpandedExam = (id: string) => {
    setExpandedExamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/mobile/grades?studentId=${selectedChildId}`).then((r) => r.json()),
      fetch(`/api/mobile/reports?studentId=${selectedChildId}`).then((r) => r.json()),
    ])
      .then(([grades, reps]) => {
        if (grades.error) { setError(grades.error); return; }
        setStudentName(grades.studentName);
        setUpcomingExams(grades.upcomingExams ?? []);
        setUpcomingAssignments(grades.upcomingAssignments ?? []);
        if (Array.isArray(reps.reports)) {
          setReports(reps.reports);
          setUnreadCount(reps.unreadCount ?? 0);
        }
      })
      .catch(() => setError('데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  function formatPublishedAt(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  return (
    <div className="flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">리포트</span>
        </div>
        {studentName && (
          <div className="text-[12px] text-white/50 uppercase tracking-wide font-semibold">
            {studentName} 학생
          </div>
        )}
        {error ? (
          <div className="text-[13px] text-red-400 mt-2">{error}</div>
        ) : (
          <div className="text-[12px] text-white/60 mt-2">
            {reports.length === 0 ? '발행된 리포트 없음' : `리포트 ${reports.length}건${unreadCount > 0 ? ` · 미열람 ${unreadCount}건` : ''}`}
          </div>
        )}
      </div>

      <MobileContentLoader loading={loading}>
      <div className="px-4 py-4 space-y-3">
        {/* 다가오는 시험 */}
        {upcomingExams.length > 0 && (
          <div className="bg-white rounded-[12px] border border-[#e2e8f0]">
            <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center gap-1.5">
              <ClipboardList size={14} className="text-[#4fc3a1]" />
              <span className="text-[13px] font-semibold text-[#111827]">예정된 시험</span>
              <span className="text-[11px] text-[#9ca3af]">{upcomingExams.length}건</span>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {upcomingExams.map((e) => {
                const expanded = expandedExamIds.has(e.id);
                const hasDesc = !!e.description?.trim();
                return (
                  <div key={e.id} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => hasDesc && toggleExpandedExam(e.id)}
                      className={`w-full text-left ${hasDesc ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="text-[13px] font-semibold text-[#111827] truncate">{e.name}</div>
                          {hasDesc && (
                            expanded
                              ? <ChevronUp size={14} className="text-[#9ca3af] shrink-0" />
                              : <ChevronDown size={14} className="text-[#9ca3af] shrink-0" />
                          )}
                        </div>
                        <span className="text-[11px] text-[#4fc3a1] font-medium shrink-0 ml-2">{e.date}</span>
                      </div>
                      <div className="text-[11.5px] text-[#6b7280] mt-0.5">
                        {e.className} · 만점 {e.totalScore}점
                      </div>
                    </button>
                    {hasDesc && expanded && (
                      <div className="mt-2 px-3 py-2 bg-[#f4f6f8] rounded-[8px] text-[12px] text-[#374151] whitespace-pre-wrap leading-relaxed">
                        {e.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 다가오는 과제 */}
        {upcomingAssignments.length > 0 && (
          <div className="bg-white rounded-[12px] border border-[#e2e8f0]">
            <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center gap-1.5">
              <FileText size={14} className="text-[#5B4FBE]" />
              <span className="text-[13px] font-semibold text-[#111827]">과제</span>
              <span className="text-[11px] text-[#9ca3af]">{upcomingAssignments.length}건</span>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {upcomingAssignments.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-[#111827]">{a.className}</span>
                    <span className="text-[11px] text-[#5B4FBE] font-medium">~{a.dueDate} 까지</span>
                  </div>
                  {a.memo && (
                    <div className="text-[12px] text-[#374151] whitespace-pre-wrap leading-relaxed">{a.memo}</div>
                  )}
                  <div className="text-[10.5px] text-[#9ca3af] mt-1">출제일: {a.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 발행된 리포트 List */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0]">
          <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#111827]">받은 리포트</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#4fc3a1] text-white text-[10.5px] font-bold">
                미열람 {unreadCount}
              </span>
            )}
          </div>
          <div className="divide-y divide-[#f1f5f9]">
            {reports.length === 0 && (
              <div className="p-6 text-center text-[13px] text-[#9ca3af]">발행된 리포트 없음</div>
            )}
            {reports.map((r) => (
              <Link
                key={r.id}
                href={`/mobile/reports/${r.id}`}
                className="flex items-center gap-3 px-4 py-3.5 active:bg-[#f4f6f8]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {r.unread && <span className="w-2 h-2 rounded-full bg-[#4fc3a1] shrink-0" />}
                    <span className="text-[13px] font-semibold text-[#111827] truncate">{r.title}</span>
                  </div>
                  {r.summary && (
                    <div className="text-[11.5px] text-[#6b7280] mt-0.5 truncate">{r.summary}</div>
                  )}
                  <div className="text-[10.5px] text-[#9ca3af] mt-1">
                    {formatPublishedAt(r.publishedAt)} · {r.kind === 'PER_EXAM' ? '시험별' : '주기별'}
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#9ca3af] shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
      </MobileContentLoader>
      <BottomTabBar />
    </div>
  );
}
