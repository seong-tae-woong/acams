'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import { Settings2 } from 'lucide-react';
import LevelTestReportView from './LevelTestReportView';
import CommentTemplateManagerModal, { type CommentTemplate } from './CommentTemplateManagerModal';
import type { LevelTestReportData, LevelTestBand } from '@/lib/levelTest/types';
import { buildNarrative, deriveRead } from '@/lib/levelTest/report';

// 채점 후 리포트 미리보기 + 배치 판정·코멘트 편집 → 발행. (설계 §D)
// 밴드/추천반/내러티브는 GET 제안값으로 시작, 원장이 모달에서 확정/수정(클라 재계산, 라운드트립 0).
export default function LevelTestReportPreviewModal({
  open, examId, data, bandOptions, onClose, onPublished,
}: {
  open: boolean;
  examId: string;
  data: LevelTestReportData | null;
  bandOptions: LevelTestBand[];
  onClose: () => void;
  onPublished: () => void;
}) {
  const [comment, setComment] = useState('');
  const [templates, setTemplates] = useState<CommentTemplate[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // 배치 판정 컨트롤
  const [bandKey, setBandKey] = useState('');
  const [recommendClass, setRecommendClass] = useState('');
  const [narrative, setNarrative] = useState('');
  const [narrativeDirty, setNarrativeDirty] = useState(false);

  const loadTemplates = () => {
    fetch('/api/level-test-comment-templates')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
  };
  useEffect(() => {
    if (open && data) {
      setComment('');
      loadTemplates();
      setBandKey(data.placement?.bandKey ?? '');
      setRecommendClass(data.placement?.recommendClass ?? '');
      setNarrative(data.narrative ?? '');
      setNarrativeDirty(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // showAverage는 averageLabel로 역추론(빌더: !showAverage면 averageLabel=null)
  const showAverage = data ? data.averageLabel != null : true;
  const autoNarrative = (band: LevelTestBand | undefined, rec: string): string => {
    if (!data || !band) return '';
    const reads = data.sections.map((s) => ({ name: s.name, score: s.score, read: deriveRead(s.score, s.average) }));
    return buildNarrative({
      studentName: data.studentName,
      sections: reads,
      bandLabel: band.label,
      recommendClass: rec.trim() || null,
      showAverage,
    });
  };

  const onBandChange = (key: string) => {
    setBandKey(key);
    const band = bandOptions.find((b) => b.key === key);
    const rec = band?.recommendClass ?? '';
    setRecommendClass(rec);
    if (!narrativeDirty) setNarrative(autoNarrative(band, rec));
  };
  const onRecommendChange = (v: string) => {
    setRecommendClass(v);
    if (!narrativeDirty) setNarrative(autoNarrative(bandOptions.find((b) => b.key === bandKey), v));
  };
  const onNarrativeChange = (v: string) => {
    setNarrative(v);
    setNarrativeDirty(true);
  };

  const insertTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setComment((prev) => (prev.trim() ? `${prev.trim()}\n${t.body}` : t.body));
  };

  // 미리보기는 입력 중인 판정·코멘트를 실시간 반영
  const selectedBand = bandOptions.find((b) => b.key === bandKey);
  const previewData: LevelTestReportData | null = data
    ? {
        ...data,
        comment: comment.trim() || undefined,
        narrative: narrative.trim() || data.narrative,
        placement: selectedBand
          ? {
              bandKey: selectedBand.key,
              bandLabel: selectedBand.label,
              recommendClass: recommendClass.trim() || null,
              ladder: data.placement?.ladder ?? bandOptions.map((b) => ({ key: b.key, label: b.label })),
              source: selectedBand.key === data.placement?.bandKey ? 'suggested' : 'overridden',
            }
          : data.placement,
      }
    : null;

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/level-tests/${examId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: comment.trim(),
          bandKey,
          recommendClass: recommendClass.trim(),
          narrative: narrative.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast('리포트를 발행하고 학부모에게 알렸습니다.', 'success');
      onPublished();
    } catch (e) {
      toast(e instanceof Error ? e.message : '발행 실패', 'error');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <Modal
        open={open && !!previewData}
        onClose={onClose}
        title="리포트 미리보기"
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={publishing}>취소</Button>
            <Button variant="primary" size="sm" onClick={publish} disabled={publishing}>{publishing ? '발행 중…' : '발행'}</Button>
          </>
        }
      >
        {previewData && (
          <div className="space-y-3">
            <div className="text-[12px] text-[#6b7280]">
              {previewData.studentName} · {previewData.subject || '레벨 테스트'} · {previewData.date}
            </div>
            <LevelTestReportView data={previewData} />

            {/* 배치 판정 컨트롤 */}
            {bandOptions.length > 0 && (
              <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4 space-y-2">
                <div className="text-[13px] font-semibold text-[#111827]">배치 판정</div>
                <div className="flex gap-2">
                  <select
                    value={bandKey}
                    onChange={(e) => onBandChange(e.target.value)}
                    className="flex-1 border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px] bg-white text-[#374151]"
                  >
                    {bandOptions.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                  <input
                    value={recommendClass}
                    onChange={(e) => onRecommendChange(e.target.value)}
                    placeholder="추천 반"
                    className="flex-1 border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px]"
                  />
                </div>
                <textarea
                  value={narrative}
                  onChange={(e) => onNarrativeChange(e.target.value)}
                  rows={2}
                  placeholder="한 줄 판정 (밴드 변경 시 자동 갱신, 직접 고치면 유지)"
                  className="w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px] leading-relaxed resize-none"
                />
                <div className="text-[11px] text-[#9ca3af]">제안 밴드가 맞으면 그대로 발행하세요. 바꾸면 위 미리보기·문장이 즉시 반영됩니다.</div>
              </div>
            )}

            {/* 코멘트 편집 */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-[#111827]">선생님 코멘트</span>
                <button onClick={() => setManagerOpen(true)} className="text-[12px] text-[#0F6E56] flex items-center gap-1">
                  <Settings2 size={13} /> 코멘트 양식 관리
                </button>
              </div>
              {templates.length > 0 && (
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) insertTemplate(e.target.value); }}
                  className="mb-2 w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px] bg-white text-[#374151]"
                >
                  <option value="">코멘트 양식 불러오기…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              )}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="학부모에게 전달할 코멘트 (선택). 양식을 불러오거나 직접 입력하세요."
                className="w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px] leading-relaxed resize-none"
              />
              <div className="text-[11px] text-[#9ca3af] mt-1">입력하면 위 미리보기에 바로 반영됩니다.</div>
            </div>
          </div>
        )}
      </Modal>

      <CommentTemplateManagerModal open={managerOpen} onClose={() => setManagerOpen(false)} onChanged={loadTemplates} />
    </>
  );
}
