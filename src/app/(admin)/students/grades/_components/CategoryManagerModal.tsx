'use client';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

// ─────────────────────────────────────────────
// 카테고리 관리 모달
// ─────────────────────────────────────────────

interface CategoryManagerModalProps {
  open: boolean;
  onClose: () => void;
  categories: ReturnType<typeof useGradeStore.getState>['categories'];
  cat1List: ReturnType<typeof useGradeStore.getState>['categories'];
  cat2ByParent: Map<string, ReturnType<typeof useGradeStore.getState>['categories']>;
  cat3ByParent: Map<string, ReturnType<typeof useGradeStore.getState>['categories']>;
  onAdd: ReturnType<typeof useGradeStore.getState>['addCategory'];
  onDelete: ReturnType<typeof useGradeStore.getState>['deleteCategory'];
}

export default function CategoryManagerModal({
  open, onClose, cat1List, cat2ByParent, cat3ByParent, onAdd, onDelete,
}: CategoryManagerModalProps) {
  const [newCat1, setNewCat1] = useState('');
  const [expanded1, setExpanded1] = useState<Set<string>>(new Set());
  const [expanded2, setExpanded2] = useState<Set<string>>(new Set());
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null); // 추가 입력창을 띄울 부모 id
  const [childInput, setChildInput] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const handleAddTop = async () => {
    const name = newCat1.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onAdd({ name, level: 1, parentId: null });
      setNewCat1('');
      toast(`카테고리 1 '${name}'이(가) 등록되었습니다.`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '등록 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAddChild = async (parentId: string, level: 2 | 3) => {
    const name = childInput.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onAdd({ name, level, parentId });
      setChildInput('');
      setAddingChildOf(null);
      toast(`카테고리 ${level} '${name}'이(가) 등록되었습니다.`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '등록 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string, hasChildren: boolean) => {
    const msg = hasChildren
      ? `'${name}'을(를) 삭제하시겠습니까?\n하위 카테고리도 함께 삭제되며, 이 카테고리를 사용 중인 시험의 카테고리는 해제됩니다.`
      : `'${name}'을(를) 삭제하시겠습니까?\n이 카테고리를 사용 중인 시험의 카테고리는 해제됩니다.`;
    if (!window.confirm(msg)) return;
    try {
      await onDelete(id);
      toast('카테고리가 삭제되었습니다.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제 실패', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="시험 카테고리 관리"
      size="md"
      footer={<Button variant="dark" size="md" onClick={onClose}>닫기</Button>}
    >
      <div className="space-y-4">
        <div className="text-[12px] text-[#6b7280] bg-[#f4f6f8] rounded-[8px] px-3 py-2">
          카테고리 1 → 2 → 3 순서로 계층을 구성하세요. 시험 등록 시 카테고리 1은 필수입니다.
        </div>

        {/* 카테고리 1 추가 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newCat1}
            onChange={(e) => setNewCat1(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTop(); }}
            placeholder="카테고리 1 이름 (예: 중간고사)"
            className="flex-1 text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]"
          />
          <Button variant="dark" size="md" onClick={handleAddTop} disabled={busy || !newCat1.trim()}>
            <Plus size={13} /> 추가
          </Button>
        </div>

        {/* 트리 */}
        <div className="border border-[#e2e8f0] rounded-[8px] divide-y divide-[#f1f5f9] max-h-[420px] overflow-y-auto">
          {cat1List.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-[#9ca3af]">등록된 카테고리가 없습니다.</div>
          ) : cat1List.map((c1) => {
            const c2list = cat2ByParent.get(c1.id) ?? [];
            const isExpanded1 = expanded1.has(c1.id);
            return (
              <div key={c1.id}>
                {/* level 1 */}
                <div className="flex items-center gap-2 px-3 py-2 hover:bg-[#f4f6f8] group">
                  <button
                    onClick={() => toggle(expanded1, c1.id, setExpanded1)}
                    className="text-[#9ca3af] hover:text-[#374151] cursor-pointer"
                  >
                    {isExpanded1 ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <span className="text-[13px] font-medium text-[#111827] flex-1">{c1.name}</span>
                  <span className="text-[10.5px] text-[#9ca3af] bg-[#f4f6f8] px-1.5 py-0.5 rounded">L1</span>
                  <button
                    onClick={() => { setAddingChildOf(c1.id); setChildInput(''); setExpanded1(new Set([...expanded1, c1.id])); }}
                    className="text-[11px] text-[#4fc3a1] hover:underline cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    + 하위 추가
                  </button>
                  <button
                    onClick={() => handleDelete(c1.id, c1.name, c2list.length > 0)}
                    className="text-[#d1d5db] hover:text-[#ef4444] cursor-pointer opacity-0 group-hover:opacity-100"
                    title="삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {isExpanded1 && (
                  <div className="bg-[#fafbfc]">
                    {/* level 2 추가 입력 */}
                    {addingChildOf === c1.id && (
                      <div className="flex gap-2 pl-9 pr-3 py-2 border-t border-[#f1f5f9]">
                        <input
                          type="text"
                          value={childInput}
                          onChange={(e) => setChildInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddChild(c1.id, 2); if (e.key === 'Escape') setAddingChildOf(null); }}
                          autoFocus
                          placeholder="카테고리 2 이름"
                          className="flex-1 text-[12px] border border-[#4fc3a1] rounded-[6px] px-2 py-1 focus:outline-none"
                        />
                        <Button variant="dark" size="sm" onClick={() => handleAddChild(c1.id, 2)} disabled={busy || !childInput.trim()}>추가</Button>
                        <Button variant="default" size="sm" onClick={() => setAddingChildOf(null)}>취소</Button>
                      </div>
                    )}

                    {c2list.length === 0 && addingChildOf !== c1.id ? (
                      <div className="pl-9 pr-3 py-2 text-[11.5px] text-[#9ca3af]">하위 카테고리 없음</div>
                    ) : c2list.map((c2) => {
                      const c3list = cat3ByParent.get(c2.id) ?? [];
                      const isExpanded2 = expanded2.has(c2.id);
                      return (
                        <div key={c2.id}>
                          <div className="flex items-center gap-2 pl-9 pr-3 py-2 hover:bg-[#f4f6f8] group border-t border-[#f1f5f9]">
                            <button
                              onClick={() => toggle(expanded2, c2.id, setExpanded2)}
                              className="text-[#9ca3af] hover:text-[#374151] cursor-pointer"
                            >
                              {isExpanded2 ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </button>
                            <span className="text-[12.5px] text-[#111827] flex-1">{c2.name}</span>
                            <span className="text-[10.5px] text-[#9ca3af] bg-[#f4f6f8] px-1.5 py-0.5 rounded">L2</span>
                            <button
                              onClick={() => { setAddingChildOf(c2.id); setChildInput(''); setExpanded2(new Set([...expanded2, c2.id])); }}
                              className="text-[11px] text-[#4fc3a1] hover:underline cursor-pointer opacity-0 group-hover:opacity-100"
                            >
                              + 하위 추가
                            </button>
                            <button
                              onClick={() => handleDelete(c2.id, c2.name, c3list.length > 0)}
                              className="text-[#d1d5db] hover:text-[#ef4444] cursor-pointer opacity-0 group-hover:opacity-100"
                              title="삭제"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {isExpanded2 && (
                            <div className="bg-[#f6f8fa]">
                              {addingChildOf === c2.id && (
                                <div className="flex gap-2 pl-16 pr-3 py-2 border-t border-[#f1f5f9]">
                                  <input
                                    type="text"
                                    value={childInput}
                                    onChange={(e) => setChildInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddChild(c2.id, 3); if (e.key === 'Escape') setAddingChildOf(null); }}
                                    autoFocus
                                    placeholder="카테고리 3 이름"
                                    className="flex-1 text-[12px] border border-[#4fc3a1] rounded-[6px] px-2 py-1 focus:outline-none"
                                  />
                                  <Button variant="dark" size="sm" onClick={() => handleAddChild(c2.id, 3)} disabled={busy || !childInput.trim()}>추가</Button>
                                  <Button variant="default" size="sm" onClick={() => setAddingChildOf(null)}>취소</Button>
                                </div>
                              )}

                              {c3list.length === 0 && addingChildOf !== c2.id ? (
                                <div className="pl-16 pr-3 py-2 text-[11.5px] text-[#9ca3af]">하위 카테고리 없음</div>
                              ) : c3list.map((c3) => (
                                <div key={c3.id} className="flex items-center gap-2 pl-16 pr-3 py-2 hover:bg-[#f4f6f8] group border-t border-[#f1f5f9]">
                                  <span className="text-[12px] text-[#374151] flex-1">{c3.name}</span>
                                  <span className="text-[10.5px] text-[#9ca3af] bg-[#f4f6f8] px-1.5 py-0.5 rounded">L3</span>
                                  <button
                                    onClick={() => handleDelete(c3.id, c3.name, false)}
                                    className="text-[#d1d5db] hover:text-[#ef4444] cursor-pointer opacity-0 group-hover:opacity-100"
                                    title="삭제"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
