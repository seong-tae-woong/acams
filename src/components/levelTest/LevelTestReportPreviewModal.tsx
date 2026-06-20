'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import { Settings2 } from 'lucide-react';
import LevelTestReportView from './LevelTestReportView';
import CommentTemplateManagerModal, { type CommentTemplate } from './CommentTemplateManagerModal';
import type { LevelTestReportData } from '@/lib/levelTest/types';

// 채점 후 리포트 미리보기 + 코멘트 편집 → 발행. 코멘트는 양식에서 불러올 수 있음.
export default function LevelTestReportPreviewModal({
  open, examId, data, onClose, onPublished,
}: {
  open: boolean;
  examId: string;
  data: LevelTestReportData | null;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [comment, setComment] = useState('');
  const [templates, setTemplates] = useState<CommentTemplate[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const loadTemplates = () => {
    fetch('/api/level-test-comment-templates')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
  };
  useEffect(() => { if (open) { setComment(''); loadTemplates(); } }, [open]);

  const insertTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setComment((prev) => (prev.trim() ? `${prev.trim()}\n${t.body}` : t.body));
  };

  // 미리보기는 입력 중인 코멘트를 실시간 반영
  const previewData: LevelTestReportData | null = data
    ? { ...data, comment: comment.trim() || undefined }
    : null;

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/level-tests/${examId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
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
