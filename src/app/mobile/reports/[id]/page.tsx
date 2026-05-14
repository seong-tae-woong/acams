'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import { ChevronLeft } from 'lucide-react';
import { useMobileChild } from '@/contexts/MobileChildContext';
import { ChartPresetRenderer, type ChartPresetKey } from '@/components/reports/charts';

interface LayoutBlock { type: 'chart'; preset: ChartPresetKey; title?: string }

type ReportDetail = {
  id: string;
  kind: 'PER_EXAM' | 'PERIODIC';
  title: string;
  summary: string;
  periodLabel: string;
  publishedAt: string;
  renderedBody: string;
  data: {
    score?: number | null;
    rank?: number | null;
    totalScore?: number;
    classAverage?: number | null;
    classHighest?: number | null;
    classCount?: number;
    examName?: string;
    examDate?: string;
    className?: string;
  };
  layout?: unknown;
  studentName: string;
  className: string | null;
  exam: { name: string; date: string; totalScore: number } | null;
};

export default function MobileReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { selectedChildId } = useMobileChild();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    fetch(`/api/mobile/reports/${id}?studentId=${selectedChildId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setReport(data);
      })
      .catch(() => setError('데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [id, selectedChildId]);

  return (
    <div className="flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/mobile/grades"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[16px] font-bold text-white truncate">
            {report?.title ?? '리포트'}
          </span>
        </div>
        {report && (
          <div className="text-[12px] text-white/60">
            {report.studentName} · {new Date(report.publishedAt).toLocaleDateString('ko-KR')}
          </div>
        )}
      </div>

      <MobileContentLoader loading={loading}>
        {error && (
          <div className="px-4 py-6 text-[13px] text-red-500">{error}</div>
        )}

        {report && (
          <div className="px-4 py-4 space-y-3">
            {/* 시험 정보 (PER_EXAM) */}
            {report.kind === 'PER_EXAM' && report.exam && (
              <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
                <div className="text-[11.5px] text-[#9ca3af] mb-1">시험 정보</div>
                <div className="text-[14px] font-bold text-[#111827]">{report.exam.name}</div>
                <div className="text-[12px] text-[#6b7280] mt-0.5">
                  {report.exam.date} · 만점 {report.exam.totalScore}점
                  {report.className ? ` · ${report.className}` : ''}
                </div>
              </div>
            )}

            {/* 본문 (글) */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
              <div className="text-[13px] text-[#111827] whitespace-pre-wrap leading-relaxed">
                {report.renderedBody || '본문 없음'}
              </div>
            </div>

            {/* 차트 블록 (PERIODIC) */}
            {report.kind === 'PERIODIC' && Array.isArray(report.layout) && (() => {
              const blocks = report.layout as LayoutBlock[];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const charts = (report.data as any)?.charts ?? {};
              return blocks.filter((b) => b?.type === 'chart').map((block, i) => (
                <div key={i} className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
                  <div className="text-[13px] font-semibold text-[#111827] mb-2">
                    {block.title ?? block.preset}
                  </div>
                  <ChartPresetRenderer preset={block.preset} data={charts[block.preset]} />
                </div>
              ));
            })()}

            {/* 표 (PER_EXAM) */}
            {report.kind === 'PER_EXAM' && report.data?.score !== undefined && (
              <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f5f9]">
                  <span className="text-[13px] font-semibold text-[#111827]">결과 요약</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[#f1f5f9]">
                  <div className="p-3 text-center">
                    <div className="text-[11px] text-[#9ca3af] mb-1">점수</div>
                    <div className="text-[18px] font-bold text-[#4fc3a1]">
                      {report.data.score ?? '-'}
                      <span className="text-[12px] text-[#9ca3af] font-normal"> / {report.data.totalScore ?? '-'}</span>
                    </div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[11px] text-[#9ca3af] mb-1">순위</div>
                    <div className="text-[18px] font-bold text-[#111827]">
                      {report.data.rank ?? '-'}
                      <span className="text-[12px] text-[#9ca3af] font-normal"> / {report.data.classCount ?? '-'}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[#f1f5f9] border-t border-[#f1f5f9]">
                  <div className="p-3 text-center">
                    <div className="text-[11px] text-[#9ca3af] mb-1">반 평균</div>
                    <div className="text-[14px] font-semibold text-[#374151]">
                      {report.data.classAverage ?? '-'}점
                    </div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[11px] text-[#9ca3af] mb-1">반 최고</div>
                    <div className="text-[14px] font-semibold text-[#374151]">
                      {report.data.classHighest ?? '-'}점
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </MobileContentLoader>
      <BottomTabBar />
    </div>
  );
}
