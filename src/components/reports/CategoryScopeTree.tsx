'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ExamCategory } from '@/lib/types/grade';

// 기간 리포트 "대상 시험 카테고리" 선택 트리 (Level 1·2·3 계층)
// 양식 편집기와 리포트 발행 모달에서 공용. readOnly=true면 양식에서 가져온 값 고정 표시.
export interface CategoryScope {
  category1Ids: string[];
  category2Ids: string[];
  category3Ids: string[];
}

export const EMPTY_SCOPE: CategoryScope = { category1Ids: [], category2Ids: [], category3Ids: [] };

export function scopeCount(s: CategoryScope): number {
  return s.category1Ids.length + s.category2Ids.length + s.category3Ids.length;
}

interface Props {
  categories: ExamCategory[];
  value: CategoryScope;
  onChange: (next: CategoryScope) => void;
  readOnly?: boolean;
  maxHeightClass?: string;
}

export default function CategoryScopeTree({
  categories, value, onChange, readOnly = false, maxHeightClass = 'max-h-60',
}: Props) {
  const cat1List = categories.filter((c) => c.level === 1);
  const cat2ByParent = (pid: string) => categories.filter((c) => c.level === 2 && c.parentId === pid);
  const cat3ByParent = (pid: string) => categories.filter((c) => c.level === 3 && c.parentId === pid);

  // 펼침 상태 — 초기엔 이미 선택된 노드가 보이도록 펼침. 읽기전용이어도 펼침/접힘은 허용.
  const [expanded1, setExpanded1] = useState<Set<string>>(() => new Set(value.category1Ids));
  const [expanded2, setExpanded2] = useState<Set<string>>(() => new Set(value.category2Ids));

  const toggleExpand1 = (id: string) => setExpanded1((p) => {
    const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const toggleExpand2 = (id: string) => setExpanded2((p) => {
    const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  const toggleCategory1 = (id: string) => {
    if (readOnly) return;
    if (value.category1Ids.includes(id)) {
      // 해제 시 자식들도 함께 해제
      const children2 = cat2ByParent(id).map((c) => c.id);
      const children3 = children2.flatMap((c2id) => cat3ByParent(c2id).map((c) => c.id));
      onChange({
        category1Ids: value.category1Ids.filter((x) => x !== id),
        category2Ids: value.category2Ids.filter((x) => !children2.includes(x)),
        category3Ids: value.category3Ids.filter((x) => !children3.includes(x)),
      });
    } else {
      onChange({ ...value, category1Ids: [...value.category1Ids, id] });
    }
  };
  const toggleCategory2 = (id: string) => {
    if (readOnly) return;
    if (value.category2Ids.includes(id)) {
      const children3 = cat3ByParent(id).map((c) => c.id);
      onChange({
        ...value,
        category2Ids: value.category2Ids.filter((x) => x !== id),
        category3Ids: value.category3Ids.filter((x) => !children3.includes(x)),
      });
    } else {
      onChange({ ...value, category2Ids: [...value.category2Ids, id] });
    }
  };
  const toggleCategory3 = (id: string) => {
    if (readOnly) return;
    onChange({
      ...value,
      category3Ids: value.category3Ids.includes(id)
        ? value.category3Ids.filter((x) => x !== id)
        : [...value.category3Ids, id],
    });
  };

  return (
    <div className={`border border-[#e2e8f0] rounded-[8px] p-2 ${readOnly ? 'bg-[#f9fafb]' : 'bg-white'} ${maxHeightClass} overflow-y-auto`}>
      {cat1List.length === 0 ? (
        <div className="text-[11.5px] text-[#9ca3af] p-1">등록된 카테고리 없음</div>
      ) : (
        <div className="space-y-0.5">
          {cat1List.map((c1) => {
            const cat2s = cat2ByParent(c1.id);
            const c1Expanded = expanded1.has(c1.id);
            const c1Checked = value.category1Ids.includes(c1.id);
            return (
              <div key={c1.id}>
                <div className="flex items-center gap-1 hover:bg-[#f3f4f6] rounded px-1 py-0.5">
                  {cat2s.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand1(c1.id)}
                      className="text-[#9ca3af] hover:text-[#374151] cursor-pointer"
                    >
                      {c1Expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  ) : (
                    <span className="w-3" />
                  )}
                  <label className={`flex items-center gap-1.5 flex-1 text-[12px] ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={c1Checked}
                      disabled={readOnly}
                      onChange={() => toggleCategory1(c1.id)}
                      className="w-3 h-3"
                    />
                    <span className="font-medium text-[#111827]">{c1.name}</span>
                    <span className="text-[10px] text-[#9ca3af]">L1</span>
                  </label>
                </div>
                {c1Expanded && cat2s.map((c2) => {
                  const cat3s = cat3ByParent(c2.id);
                  const c2Expanded = expanded2.has(c2.id);
                  const c2Checked = value.category2Ids.includes(c2.id);
                  return (
                    <div key={c2.id} className="pl-5">
                      <div className="flex items-center gap-1 hover:bg-[#f3f4f6] rounded px-1 py-0.5">
                        {cat3s.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand2(c2.id)}
                            className="text-[#9ca3af] hover:text-[#374151] cursor-pointer"
                          >
                            {c2Expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                        ) : (
                          <span className="w-3" />
                        )}
                        <label className={`flex items-center gap-1.5 flex-1 text-[12px] ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={c2Checked}
                            disabled={readOnly}
                            onChange={() => toggleCategory2(c2.id)}
                            className="w-3 h-3"
                          />
                          <span className="text-[#374151]">{c2.name}</span>
                          <span className="text-[10px] text-[#9ca3af]">L2</span>
                        </label>
                      </div>
                      {c2Expanded && cat3s.map((c3) => {
                        const c3Checked = value.category3Ids.includes(c3.id);
                        return (
                          <div key={c3.id} className="pl-5">
                            <label className={`flex items-center gap-1.5 hover:bg-[#f3f4f6] rounded px-1 py-0.5 text-[12px] ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                              <span className="w-3" />
                              <input
                                type="checkbox"
                                checked={c3Checked}
                                disabled={readOnly}
                                onChange={() => toggleCategory3(c3.id)}
                                className="w-3 h-3"
                              />
                              <span className="text-[#374151]">{c3.name}</span>
                              <span className="text-[10px] text-[#9ca3af]">L3</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
