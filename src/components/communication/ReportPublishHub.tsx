'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/shared/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PublishReportModal from '@/components/communication/PublishReportModal';
import BatchReportsModal from '@/components/communication/BatchReportsModal';
import { Send } from 'lucide-react';
import clsx from 'clsx';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { StudentStatus } from '@/lib/types/student';

interface Batch {
  batchId: string;
  kind: 'PER_EXAM' | 'PERIODIC';
  templateName: string;
  examName: string | null;
  periodLabel: string;
  publishedAt: string;
  publishedByName: string;
  totalCount: number;
  readCount: number;
}

const KIND_STYLE: Record<'PER_EXAM' | 'PERIODIC', { bg: string; text: string; label: string }> = {
  PER_EXAM: { bg: '#DBEAFE', text: '#1d4ed8', label: '시험별' },
  PERIODIC: { bg: '#EDE9FE', text: '#5B4FBE', label: '주기별' },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const PAGE_SIZE = 10;

export default function ReportPublishHub() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'PER_EXAM' | 'PERIODIC'>('all');
  const [publishOpen, setPublishOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  const { classes, fetchClasses } = useClassStore();
  const { students, fetchStudents } = useStudentStore();
  const { exams, fetchExams } = useGradeStore();

  useEffect(() => { fetchClasses(); fetchStudents(); fetchExams(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 발행 이력 1페이지 로드 (발행일 최신순)
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/batches?skip=0&take=${PAGE_SIZE}`);
      const data = await res.json();
      if (Array.isArray(data.batches)) setBatches(data.batches);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setLoading(false);
    }
  };

  // 발행 이력 다음 페이지 로드 (스크롤)
  const loadMoreBatches = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/reports/batches?skip=${batches.length}&take=${PAGE_SIZE}`);
      const data = await res.json();
      if (Array.isArray(data.batches)) setBatches((prev) => [...prev, ...data.batches]);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { fetchBatches(); }, []);

  const studentsByClass: Record<string, { id: string; name: string }[]> = {};
  for (const c of classes) {
    studentsByClass[c.id] = students
      .filter((s) => s.status === StudentStatus.ACTIVE && (s.classes ?? []).includes(c.id))
      .map((s) => ({ id: s.id, name: s.name }));
  }

  const filtered = batches.filter((b) => filter === 'all' || b.kind === filter);

  return (
    <div
      className="flex-1 overflow-y-auto p-5 space-y-4"
      onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) loadMoreBatches();
      }}
    >
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] font-semibold text-[#111827]">발행 이력</span>
            <span className="text-[11px] text-[#9ca3af]">{filtered.length}건</span>
            <div className="flex gap-1 ml-2">
              {(['all', 'PER_EXAM', 'PERIODIC'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={clsx(
                    'px-2 py-0.5 rounded-[6px] text-[10.5px] font-medium cursor-pointer',
                    filter === k ? 'bg-[#1a2535] text-white' : 'bg-[#f1f5f9] text-[#6b7280]',
                  )}
                >
                  {k === 'all' ? '전체' : k === 'PER_EXAM' ? '시험별' : '주기별'}
                </button>
              ))}
            </div>
          </div>
          <Button variant="dark" size="sm" onClick={() => setPublishOpen(true)}>
            <Send size={13} /> 발행
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[12.5px] text-[#9ca3af]">발행 이력이 없습니다.</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-[#f4f6f8]">
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium w-20">종류</th>
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">양식</th>
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">대상 시험·기간</th>
                <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium w-24">대상 인원</th>
                <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium w-24">미열람</th>
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium w-40">발행일시</th>
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium w-24">발행자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((b) => {
                const style = KIND_STYLE[b.kind];
                const unread = b.totalCount - b.readCount;
                return (
                  <tr
                    key={b.batchId}
                    onClick={() => setSelectedBatch(b)}
                    className="hover:bg-[#f4f6f8] cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-[6px] text-[10.5px] font-medium"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#111827] font-medium">{b.templateName}</td>
                    <td className="px-4 py-3 text-[#374151]">
                      {b.kind === 'PER_EXAM' ? (b.examName ?? '-') : b.periodLabel}
                    </td>
                    <td className="px-4 py-3 text-center text-[#111827]">{b.totalCount}명</td>
                    <td className="px-4 py-3 text-center">
                      {unread === 0 ? (
                        <span className="text-[#0D9E7A] font-medium">전원 열람</span>
                      ) : (
                        <span className="text-[#6b7280]">{unread}/{b.totalCount}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#6b7280]">{formatDateTime(b.publishedAt)}</td>
                    <td className="px-4 py-3 text-[#6b7280]">{b.publishedByName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {loadingMore && (
          <div className="p-3 text-center text-[11px] text-[#9ca3af]">불러오는 중…</div>
        )}
      </div>

      {/* 발행 모달 (탭 진입 — 시험별/주기별 토글, 시험별은 반·시험 드롭다운) */}
      {publishOpen && (
        <PublishReportModal
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          source="tab"
          allClasses={classes.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          studentsByClass={studentsByClass}
          allExams={exams.map((e) => ({
            id: e.id, name: e.name, classId: e.classId, totalScore: e.totalScore, date: e.date,
          }))}
          onPublished={fetchBatches}
        />
      )}

      {/* 발행 묶음 상세 — 대상 학생 목록 + 학생별 리포트 보기 */}
      {selectedBatch && (
        <BatchReportsModal
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
        />
      )}
    </div>
  );
}
