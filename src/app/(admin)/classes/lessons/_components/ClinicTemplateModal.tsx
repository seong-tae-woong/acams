'use client';
import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import Button from '@/components/shared/Button';
import { useLessonStore } from '@/lib/stores/lessonStore';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import type { ClinicTemplateItem } from '@/lib/types/lesson';

interface ClinicTemplateModalProps {
  open: boolean;
  onClose: () => void;
}

function newItemId() {
  return `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ClinicTemplateModal({ open, onClose }: ClinicTemplateModalProps) {
  const { templates, fetchTemplates, addTemplate, updateTemplate, deleteTemplate } = useLessonStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ClinicTemplateItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (open) fetchTemplates().catch(() => {});
  }, [open, fetchTemplates]);

  // 양식 선택 시 폼 채우기
  useEffect(() => {
    if (!selectedId) {
      setName('');
      setDescription('');
      setItems([]);
      return;
    }
    const t = templates.find((x) => x.id === selectedId);
    if (t) {
      setName(t.name);
      setDescription(t.description);
      setItems([...t.items].sort((a, b) => a.order - b.order));
      setIsNew(false);
    }
  }, [selectedId, templates]);

  const startNew = () => {
    setSelectedId(null);
    setIsNew(true);
    setName('');
    setDescription('');
    setItems([]);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { id: newItemId(), label: '', order: prev.length }]);
  };

  const updateItemLabel = (id: string, label: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, label } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id).map((it, i) => ({ ...it, order: i })));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast('양식 이름을 입력해 주세요.', 'error');
      return;
    }
    const cleanItems = items
      .map((it, i) => ({ ...it, label: it.label.trim(), order: i }))
      .filter((it) => it.label !== '');

    setSaving(true);
    try {
      if (isNew) {
        const created = await addTemplate({
          name: name.trim(),
          description: description.trim(),
          items: cleanItems,
        });
        setIsNew(false);
        setSelectedId(created.id);
        toast('양식이 생성되었습니다.', 'success');
      } else if (selectedId) {
        await updateTemplate(selectedId, {
          name: name.trim(),
          description: description.trim(),
          items: cleanItems,
        });
        toast('양식이 수정되었습니다.', 'success');
      }
    } catch {
      toast('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm('이 양식을 삭제하시겠습니까? 이미 입력된 결과는 그대로 유지됩니다.')) return;
    setSaving(true);
    try {
      await deleteTemplate(selectedId);
      setSelectedId(null);
      setIsNew(false);
      toast('양식이 삭제되었습니다.', 'success');
    } catch {
      toast('삭제에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const editable = isNew || !!selectedId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[720px] mx-4 bg-white rounded-[10px] shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
          <span className="text-[14px] font-semibold text-[#111827]">Clinic 양식 관리</span>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#374151] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 양식 목록 */}
          <div className="w-[200px] border-r border-[#e2e8f0] flex flex-col">
            <div className="p-3 border-b border-[#e2e8f0]">
              <Button variant="dark" size="sm" onClick={startNew} className="w-full">
                <Plus size={13} /> 신규 양식
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {templates.length === 0 && !isNew ? (
                <div className="p-4 text-[12px] text-[#9ca3af]">등록된 양식 없음</div>
              ) : (
                <>
                  {isNew && (
                    <div className="px-4 py-2.5 text-[12.5px] bg-[#eef2ff] text-[#1a2535] font-medium border-b border-[#f1f5f9]">
                      (새 양식)
                    </div>
                  )}
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedId(t.id);
                        setIsNew(false);
                      }}
                      className={clsx(
                        'w-full text-left px-4 py-2.5 text-[12.5px] border-b border-[#f1f5f9] cursor-pointer',
                        selectedId === t.id && !isNew
                          ? 'bg-[#eef2ff] text-[#1a2535] font-medium'
                          : 'text-[#374151] hover:bg-[#f9fafb]',
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* 편집 영역 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!editable ? (
              <div className="text-[13px] text-[#9ca3af]">좌측에서 양식을 선택하거나 "신규 양식" 버튼을 눌러 시작하세요.</div>
            ) : (
              <>
                <div>
                  <label className="block text-[12px] font-semibold text-[#111827] mb-1.5">양식 이름</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 기본 점검"
                    className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#111827] mb-1.5">설명 (선택)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="이 양식의 용도"
                    className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] font-semibold text-[#111827]">체크 항목</label>
                    <button
                      onClick={addItem}
                      className="text-[11.5px] text-[#4fc3a1] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={11} /> 항목 추가
                    </button>
                  </div>
                  {items.length === 0 ? (
                    <div className="text-[12px] text-[#9ca3af] py-3 px-3 bg-[#f9fafb] rounded-[8px]">
                      항목이 없습니다. "항목 추가"를 눌러 시작하세요.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <span className="text-[11px] text-[#9ca3af] w-5">{idx + 1}.</span>
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateItemLabel(item.id, e.target.value)}
                            placeholder="예: 단어 시험 통과"
                            className="flex-1 text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-1.5 focus:outline-none focus:border-[#4fc3a1]"
                          />
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-[#9ca3af] hover:text-[#ef4444] cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#e2e8f0] flex justify-between gap-2">
          <div>
            {selectedId && !isNew && (
              <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
                삭제
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={onClose}>닫기</Button>
            <Button
              variant="dark"
              size="sm"
              onClick={handleSave}
              disabled={saving || !editable}
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
