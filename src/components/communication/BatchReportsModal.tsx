'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/shared/Modal';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { ChartPresetRenderer, type ChartPresetKey } from '@/components/reports/charts';

interface LayoutBlock { type: 'chart'; preset: ChartPresetKey; title?: string }

export interface BatchInfo {
  batchId: string;
  kind: 'PER_EXAM' | 'PERIODIC';
  templateName: string;
  examName: string | null;
  periodLabel: string;
  publishedAt: string;
  totalCount: number;
  readCount: number;
}

interface BatchReportRow {
  id: string;
  studentId: string;
  studentName: string;
  className: string | null;
  readAt: string | null;
}

interface ReportDetail {
  id: string;
  kind: 'PER_EXAM' | 'PERIODIC';
  title: string;
  summary: string;
  periodLabel: string;
  publishedAt: string;
  readAt: string | null;
  renderedBody: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  layout?: unknown;
  studentName: string;
  className: string | null;
  exam: { name: string; date: string; totalScore: number } | null;
}

interface Props {
  batch: BatchInfo;
  onClose: () => void;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function BatchReportsModal({ batch, onClose }: Props) {
  const [rows, setRows] = useState<BatchReportRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setLoadingRows(true);
    fetch(`/api/reports/batches/${batch.batchId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.reports)) setRows(data.reports); })
      .finally(() => setLoadingRows(false));
  }, [batch.batchId]);

  const openReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setDetail(null);
    setLoadingDetail(true);
    fetch(`/api/reports/${reportId}`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setDetail(data); })
      .finally(() => setLoadingDetail(false));
  };

  const backToList = () => { setSelectedReportId(null); setDetail(null); };

  return (
    <Modal
      open
      onClose={onClose}
      title={selectedReportId ? '리포트 상세' : '발행 대상 리포트'}
      size="lg"
    >
      {selectedReportId ? (
        <div className="space-y-3">
          <button
            onClick={backToList}
            className="flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#111827] cursor-pointer"
          >
            <ChevronLeft size={14} /> 학생 목록으로
          </button>
          {loadingDetail && <LoadingSpinner />}
          {!loadingDetail && !detail && (
            <div className="text-[12.5px] text-[#ef4444] py-6 text-center">리포트를 불러올 수 없습니다.</div>
          )}
          {detail && <ReportDetailView detail={detail} />}
        </div>
      ) : (
        <div className="space-y-3">
          {/* 발행 묶음 요약 */}
          <div className="bg-[#f9fafb] border border-[#e2e8f0] rounded-[8px] px-3 py-2.5 text-[12px] text-[#374151] space-y-1">
            <div className="font-semibold text-[#111827] text-[12.5px]">{batch.templateName}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[#6b7280]">
              <span>{batch.kind === 'PER_EXAM' ? '시험별' : '주기별'}</span>
              <span>{batch.kind === 'PER_EXAM' ? (batch.examName ?? '-') : batch.periodLabel}</span>
              <span>발행 {formatDateTime(batch.publishedAt)}</span>
              <span>대상 {batch.totalCount}명 · 미열람 {batch.totalCount - batch.readCount}명</span>
            </div>
          </div>

          {loadingRows ? (
            <LoadingSpinner />
          ) : rows.length === 0 ? (
            <div className="text-[12.5px] text-[#9ca3af] py-8 text-center">발행된 리포트가 없습니다.</div>
          ) : (
            <div className="border border-[#e2e8f0] rounded-[8px] divide-y divide-[#f1f5f9] max-h-[440px] overflow-y-auto">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openReport(r.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f4f6f8] cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[#111827] truncate">{r.studentName}</div>
                    {r.className && (
                      <div className="text-[10.5px] text-[#9ca3af] truncate mt-0.5">{r.className}</div>
                    )}
                  </div>
                  {r.readAt ? (
                    <span className="text-[10.5px] font-medium text-[#0D9E7A] bg-[#E1F5EE] px-1.5 py-0.5 rounded">
                      열람
                    </span>
                  ) : (
                    <span className="text-[10.5px] font-medium text-[#9ca3af] bg-[#f1f5f9] px-1.5 py-0.5 rounded">
                      미열람
                    </span>
                  )}
                  <ChevronRight size={14} className="text-[#d1d5db]" />
                </button>
              ))}
            </div>
          )}
          <div className="text-[10.5px] text-[#9ca3af]">학생을 선택하면 발행된 리포트 내용을 볼 수 있습니다.</div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────
// 리포트 상세 (학부모/학생 PWA와 동일한 내용)
// ─────────────────────────────────────────────
function ReportDetailView({ detail }: { detail: ReportDetail }) {
  const blocks = Array.isArray(detail.layout) ? (detail.layout as LayoutBlock[]) : [];
  const charts = detail.data?.charts ?? {};

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-[#111827] truncate">{detail.title}</div>
          <div className="text-[11.5px] text-[#6b7280] mt-0.5">
            {detail.studentName}
            {detail.className ? ` · ${detail.className}` : ''}
            {' · '}{formatDateTime(detail.publishedAt)} 발행
          </div>
        </div>
        <span
          className={clsx(
            'shrink-0 text-[10.5px] font-medium px-1.5 py-0.5 rounded',
            detail.readAt ? 'text-[#0D9E7A] bg-[#E1F5EE]' : 'text-[#9ca3af] bg-[#f1f5f9]',
          )}
        >
          {detail.readAt ? '열람함' : '미열람'}
        </span>
      </div>

      {/* 시험 정보 (PER_EXAM) */}
      {detail.kind === 'PER_EXAM' && detail.exam && (
        <div className="bg-white rounded-[8px] border border-[#e2e8f0] p-3">
          <div className="text-[10.5px] text-[#9ca3af] mb-0.5">시험 정보</div>
          <div className="text-[13px] font-semibold text-[#111827]">{detail.exam.name}</div>
          <div className="text-[11.5px] text-[#6b7280] mt-0.5">
            {detail.exam.date} · 만점 {detail.exam.totalScore}점
            {detail.className ? ` · ${detail.className}` : ''}
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="bg-white rounded-[8px] border border-[#e2e8f0] p-3">
        <div className="text-[12.5px] text-[#111827] whitespace-pre-wrap leading-relaxed">
          {detail.renderedBody || <span className="text-[#9ca3af]">본문 없음</span>}
        </div>
      </div>

      {/* 차트 블록 (PERIODIC) */}
      {detail.kind === 'PERIODIC' && blocks.filter((b) => b?.type === 'chart').map((block, i) => (
        <div key={i} className="bg-white rounded-[8px] border border-[#e2e8f0] p-3">
          <div className="text-[12px] font-semibold text-[#111827] mb-1.5">
            {block.title ?? block.preset}
          </div>
          <ChartPresetRenderer preset={block.preset} data={charts[block.preset]} />
        </div>
      ))}

      {/* 결과 요약 (PER_EXAM) */}
      {detail.kind === 'PER_EXAM' && detail.data?.score !== undefined && (
        <div className="bg-white rounded-[8px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#f1f5f9]">
            <span className="text-[12px] font-semibold text-[#111827]">결과 요약</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#f1f5f9]">
            <div className="p-3 text-center">
              <div className="text-[10.5px] text-[#9ca3af] mb-1">점수</div>
              <div className="text-[16px] font-bold text-[#4fc3a1]">
                {detail.data.score ?? '-'}
                <span className="text-[11px] text-[#9ca3af] font-normal"> / {detail.data.totalScore ?? '-'}</span>
              </div>
            </div>
            <div className="p-3 text-center">
              <div className="text-[10.5px] text-[#9ca3af] mb-1">순위</div>
              <div className="text-[16px] font-bold text-[#111827]">
                {detail.data.rank ?? '-'}
                <span className="text-[11px] text-[#9ca3af] font-normal"> / {detail.data.classCount ?? '-'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#f1f5f9] border-t border-[#f1f5f9]">
            <div className="p-3 text-center">
              <div className="text-[10.5px] text-[#9ca3af] mb-1">반 평균</div>
              <div className="text-[13px] font-semibold text-[#374151]">{detail.data.classAverage ?? '-'}점</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-[10.5px] text-[#9ca3af] mb-1">반 최고</div>
              <div className="text-[13px] font-semibold text-[#374151]">{detail.data.classHighest ?? '-'}점</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
