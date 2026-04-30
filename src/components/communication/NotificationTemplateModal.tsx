'use client';
import { useState } from 'react';
import { X, Plus, Trash2, FileText } from 'lucide-react';
import clsx from 'clsx';
import Button from '@/components/shared/Button';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { toast } from '@/lib/stores/toastStore';
import type { NotificationType, NotificationTemplate } from '@/lib/types/notification';

const TYPES: NotificationType[] = ['공지', '출결알림', '수납알림', '상담알림', '일반'];

const TYPE_STYLE: Record<NotificationType, { bg: string; text: string }> = {
  '공지':    { bg: '#E1F5EE', text: '#0D9E7A' },
  '출결알림': { bg: '#DBEAFE', text: '#1d4ed8' },
  '수납알림': { bg: '#FEF3C7', text: '#92400E' },
  '상담알림': { bg: '#EDE9FE', text: '#5B4FBE' },
  '일반':    { bg: '#f1f5f9', text: '#374151' },
};

interface Props {
  onClose: () => void;
  onApply: (template: NotificationTemplate) => void;
}

export default function NotificationTemplateModal({ onClose, onApply }: Props) {
  const { templates, addTemplate, deleteTemplate } = useCommunicationStore();

  const [catFilter, setCatFilter] = useState<NotificationType | 'all'>('all');
  const [newCategory, setNewCategory] = useState<NotificationType>('공지');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = templates.filter((t) => catFilter === 'all' || t.category === catFilter);

  const handleSave = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast('제목과 내용을 입력해주세요.', 'error');
      return;
    }
    setSaving(true);
    await addTemplate({ category: newCategory, title: newTitle.trim(), content: newContent.trim() });
    setNewTitle('');
    setNewContent('');
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteTemplate(id);
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl mx-4 bg-white rounded-[12px] shadow-xl flex flex-col max-h-[90vh]">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] shrink-0">
          <span className="text-[14px] font-semibold text-[#111827]">알림 템플릿</span>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#374151] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* 본문: 좌우 2열 */}
        <div className="flex flex-1 overflow-hidden">

          {/* 좌측: 템플릿 목록 */}
          <div className="w-[55%] border-r border-[#e2e8f0] flex flex-col overflow-hidden">
            {/* 카테고리 탭 */}
            <div className="px-4 pt-4 pb-2 flex gap-1.5 flex-wrap shrink-0">
              <button
                onClick={() => setCatFilter('all')}
                className={clsx(
                  'px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                  catFilter === 'all' ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]',
                )}
              >
                전체
              </button>
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setCatFilter(t)}
                  className={clsx(
                    'px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                    catFilter === t ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* 목록 */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <FileText size={28} className="text-[#d1d5db]" />
                  <p className="text-[12.5px] text-[#9ca3af]">저장된 템플릿이 없습니다</p>
                </div>
              ) : (
                filtered.map((t) => {
                  const ts = TYPE_STYLE[t.category as NotificationType];
                  return (
                    <div
                      key={t.id}
                      className="border border-[#e2e8f0] rounded-[10px] p-3 bg-white hover:border-[#4fc3a1] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="px-2 py-0.5 rounded-[20px] text-[10.5px] font-medium shrink-0"
                            style={{ backgroundColor: ts.bg, color: ts.text }}
                          >
                            {t.category}
                          </span>
                          <span className="text-[12.5px] font-semibold text-[#111827] truncate">{t.title}</span>
                        </div>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          className="text-[#d1d5db] hover:text-[#ef4444] cursor-pointer shrink-0 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p className="text-[11.5px] text-[#6b7280] line-clamp-2 mb-2.5 leading-relaxed">{t.content}</p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => { onApply(t); onClose(); }}
                      >
                        적용
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 우측: 새 템플릿 만들기 */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Plus size={14} className="text-[#4fc3a1]" />
              <span className="text-[13px] font-semibold text-[#111827]">새 템플릿 만들기</span>
            </div>

            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">카테고리</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as NotificationType)}
                className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1] cursor-pointer"
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">제목</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="템플릿 제목"
                className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1]"
              />
            </div>

            <div className="flex-1 flex flex-col">
              <label className="text-[11.5px] text-[#6b7280] block mb-1">내용</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="자주 사용하는 알림 내용을 입력하세요"
                className="flex-1 w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1] resize-none min-h-[120px]"
              />
            </div>

            <Button
              variant="dark"
              size="md"
              onClick={handleSave}
            >
              {saving ? '저장 중...' : '템플릿 저장'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
