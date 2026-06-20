'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Trash2, Pencil } from 'lucide-react';

export interface CommentTemplate { id: string; title: string; body: string }

// 코멘트 양식(원장/강사 사전 작성) 관리 모달 — 리포트 미리보기에서 호출.
export default function CommentTemplateManagerModal({
  open, onClose, onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [list, setList] = useState<CommentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<null | { id?: string; title: string; body: string }>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/level-test-comment-templates')
      .then((r) => r.json())
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => toast('코멘트 양식을 불러오지 못했습니다.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (open) { load(); setEditing(null); } }, [open]);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) return toast('제목을 입력하세요.', 'error');
    if (!editing.body.trim()) return toast('코멘트 내용을 입력하세요.', 'error');
    setBusy(true);
    try {
      const res = await fetch(
        editing.id ? `/api/level-test-comment-templates/${editing.id}` : '/api/level-test-comment-templates',
        {
          method: editing.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: editing.title.trim(), body: editing.body.trim() }),
        },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast('저장했습니다.', 'success');
      setEditing(null);
      load();
      onChanged?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : '저장 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm('이 코멘트 양식을 삭제할까요?')) return;
    const res = await fetch(`/api/level-test-comment-templates/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('삭제했습니다.', 'success'); load(); onChanged?.(); }
    else toast('삭제 실패', 'error');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="코멘트 양식 관리"
      size="md"
      footer={editing ? (
        <>
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>취소</Button>
          <Button variant="primary" size="sm" onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
      )}
    >
      {editing ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[12px] text-[#6b7280]">제목</span>
            <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="예: 기초 보강 권장"
              className="mt-1 w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px]" />
          </label>
          <label className="block">
            <span className="text-[12px] text-[#6b7280]">코멘트 내용</span>
            <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              rows={5} placeholder="학부모에게 전달할 코멘트를 입력하세요."
              className="mt-1 w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px] leading-relaxed resize-none" />
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={() => setEditing({ title: '', body: '' })}
            className="w-full border border-dashed border-[#cbd5e1] rounded-[8px] py-2.5 text-[13px] text-[#0F6E56] flex items-center justify-center gap-1">
            <Plus size={14} /> 새 코멘트 양식
          </button>
          {loading ? (
            <div className="text-[12px] text-[#9ca3af] py-4 text-center">불러오는 중…</div>
          ) : list.length === 0 ? (
            <div className="text-[12px] text-[#9ca3af] py-4 text-center">아직 코멘트 양식이 없습니다.</div>
          ) : (
            list.map((t) => (
              <div key={t.id} className="border border-[#e2e8f0] rounded-[8px] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#111827]">{t.title}</div>
                    <div className="text-[12px] text-[#6b7280] mt-0.5 whitespace-pre-wrap line-clamp-2">{t.body}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing({ id: t.id, title: t.title, body: t.body })} className="p-1.5 text-[#6b7280] hover:text-[#111827]" title="수정"><Pencil size={14} /></button>
                    <button onClick={() => del(t.id)} className="p-1.5 text-[#9ca3af] hover:text-red-500" title="삭제"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
