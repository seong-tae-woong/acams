'use client';
import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useClassStore } from '@/lib/stores/classStore';
import type { ClassInfo, CurriculumPalette } from '@/lib/types/class';
import { CURRICULUM_PALETTES } from '@/lib/types/class';
import { toast } from '@/lib/stores/toastStore';
import { Plus, BookOpen, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import {
  type Textbook, type CurriculumRow, type CurriculumUnitType,
  UNIT_TYPE_OPTIONS, unitSuffix, resolveBarColor,
} from '../_shared';

export default function CurriculumTab({ selected }: { selected: ClassInfo }) {
  const { updateClass } = useClassStore();
  const selectedClassId = selected.id;

  // ── 커리큘럼/교재 상태 ──────────────────────────────────
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumRow[]>([]);
  const [curriculumSubTab, setCurriculumSubTab] = useState<'curriculum' | 'textbook'>('curriculum');

  const fetchTextbooks = useCallback(async (classId: string) => {
    try {
      const res = await fetch(`/api/classes/${classId}/textbooks`);
      if (res.ok) setTextbooks(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchCurriculumData = useCallback(async (classId: string) => {
    try {
      const res = await fetch(`/api/classes/${classId}/curriculum`);
      if (res.ok) setCurriculum(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchTextbooks(selectedClassId);
      fetchCurriculumData(selectedClassId);
    }
  }, [selectedClassId, fetchTextbooks, fetchCurriculumData]);

  const toggleCurriculumDone = async (row: CurriculumRow) => {
    if (!selectedClassId) return;
    const updated = { ...row, done: !row.done };
    setCurriculum((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    try {
      await fetch(`/api/classes/${selectedClassId}/curriculum/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: updated.done }),
      });
    } catch { /* silent */ }
  };

  // ── 커리큘럼 추가/수정 모달 ────────────────────────────
  const [currModalOpen, setCurrModalOpen] = useState(false);
  const [currEditId, setCurrEditId] = useState<string | null>(null);
  const [currForm, setCurrForm] = useState<{ unitType: CurriculumUnitType; startWeek: string; endWeek: string; topic: string; detail: string; color: string }>({ unitType: 'WEEK', startWeek: '1', endWeek: '1', topic: '', detail: '', color: '' });

  const openCurrAdd = () => {
    if (!selectedClassId) { toast('먼저 반을 선택해주세요.', 'error'); return; }
    setCurrEditId(null);
    setCurrForm({ unitType: 'WEEK', startWeek: '1', endWeek: '1', topic: '', detail: '', color: '' });
    setCurrModalOpen(true);
  };

  const openCurrEdit = (row: CurriculumRow) => {
    setCurrEditId(row.id);
    setCurrForm({
      unitType: row.unitType,
      startWeek: String(row.startWeek),
      endWeek: String(row.endWeek),
      topic: row.topic,
      detail: row.detail,
      color: row.color ?? '',
    });
    setCurrModalOpen(true);
  };

  const handleSaveCurriculum = async () => {
    if (!selectedClassId) return;
    if (!currForm.topic.trim()) { toast('단원명을 입력해주세요.', 'error'); return; }
    const start = parseInt(currForm.startWeek);
    let end = currForm.endWeek.trim() === '' ? start : parseInt(currForm.endWeek);
    if (isNaN(start) || start < 1) { toast('시작 차수는 1 이상이어야 합니다.', 'error'); return; }
    if (isNaN(end) || end < start) end = start;
    const payload = {
      unitType: currForm.unitType,
      startWeek: start,
      endWeek: end,
      topic: currForm.topic.trim(),
      detail: currForm.detail.trim(),
      color: currForm.color.trim() || null,
    };
    try {
      if (currEditId) {
        const res = await fetch(`/api/classes/${selectedClassId}/curriculum/${currEditId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || ''); }
        const updated: CurriculumRow = await res.json();
        setCurriculum((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        toast('커리큘럼이 수정되었습니다.', 'success');
      } else {
        const res = await fetch(`/api/classes/${selectedClassId}/curriculum`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || ''); }
        const newRow: CurriculumRow = await res.json();
        setCurriculum((prev) => [...prev, newRow]);
        toast(`'${newRow.topic}' 단원이 추가되었습니다.`, 'success');
      }
      setCurrModalOpen(false);
    } catch (err) {
      toast((err as Error).message || '저장에 실패했습니다.', 'error');
    }
  };

  const handleDeleteCurriculum = async (row: CurriculumRow) => {
    if (!selectedClassId) return;
    if (!confirm(`'${row.topic}' 단원을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/curriculum/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCurriculum((prev) => prev.filter((r) => r.id !== row.id));
      toast('삭제되었습니다.', 'info');
    } catch {
      toast('삭제에 실패했습니다.', 'error');
    }
  };

  // ── 팔레트 선택기 ─────────────────────────────────────
  const currentPalette: CurriculumPalette = (selected?.curriculumPalette as CurriculumPalette) ?? 'green';
  const handlePaletteChange = async (p: CurriculumPalette) => {
    if (!selected) return;
    if (p === currentPalette) return;
    try {
      await updateClass(selected.id, { curriculumPalette: p });
    } catch { /* store handles toast */ }
  };

  // ── 교재 추가/수정 모달 ────────────────────────────────
  const blankTbForm = { name: '', publisher: '', unit: '권', totalUnits: '1', price: '', currentUnit: '1', isbn: '', purchaseDate: '', memo: '' };
  const [tbModalOpen, setTbModalOpen] = useState(false);
  const [tbEditId, setTbEditId] = useState<string | null>(null);
  const [tbForm, setTbForm] = useState(blankTbForm);

  const openTbAdd = () => {
    if (!selectedClassId) { toast('먼저 반을 선택해주세요.', 'error'); return; }
    setTbEditId(null);
    setTbForm(blankTbForm);
    setTbModalOpen(true);
  };

  const openTbEdit = (tb: Textbook) => {
    setTbEditId(tb.id);
    setTbForm({
      name: tb.name, publisher: tb.publisher, unit: tb.unit || '권',
      totalUnits: String(tb.totalUnits), price: String(tb.price),
      currentUnit: String(tb.currentUnit), isbn: tb.isbn,
      purchaseDate: tb.purchaseDate || '', memo: tb.memo,
    });
    setTbModalOpen(true);
  };

  const handleSaveTextbook = async () => {
    if (!selectedClassId) return;
    if (!tbForm.name.trim()) { toast('교재명을 입력해주세요.', 'error'); return; }
    const payload = {
      name: tbForm.name.trim(),
      publisher: tbForm.publisher.trim(),
      unit: tbForm.unit.trim() || '권',
      totalUnits: parseInt(tbForm.totalUnits) || 1,
      currentUnit: parseInt(tbForm.currentUnit) || 1,
      price: parseInt(tbForm.price) || 0,
      isbn: tbForm.isbn.trim(),
      purchaseDate: tbForm.purchaseDate || null,
      memo: tbForm.memo.trim(),
    };
    try {
      if (tbEditId) {
        const res = await fetch(`/api/classes/${selectedClassId}/textbooks/${tbEditId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const updated: Textbook = await res.json();
        setTextbooks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        toast('교재 정보가 수정되었습니다.', 'success');
      } else {
        const res = await fetch(`/api/classes/${selectedClassId}/textbooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const newTb: Textbook = await res.json();
        setTextbooks((prev) => [...prev, newTb]);
        toast(`'${newTb.name}' 교재가 추가되었습니다.`, 'success');
      }
      setTbModalOpen(false);
    } catch {
      toast('저장에 실패했습니다.', 'error');
    }
  };

  const handleDeleteTextbook = async (tb: Textbook) => {
    if (!selectedClassId) return;
    if (!confirm(`'${tb.name}' 교재를 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/textbooks/${tb.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTextbooks((prev) => prev.filter((t) => t.id !== tb.id));
      toast('교재가 삭제되었습니다.', 'info');
    } catch {
      toast('삭제에 실패했습니다.', 'error');
    }
  };

  const doneCurriculum = curriculum.filter((r) => r.done).length;
  const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

  return (
    <>
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        {/* 서브 탭 */}
        <div className="flex border-b border-[#e2e8f0] items-center">
          {[{ value: 'curriculum' as const, label: '커리큘럼' }, { value: 'textbook' as const, label: '교재 목록' }].map((t) => (
            <button key={t.value} onClick={() => setCurriculumSubTab(t.value)}
              className={clsx('px-5 py-3 text-[12.5px] font-medium border-b-2 transition-colors cursor-pointer',
                curriculumSubTab === t.value ? 'border-[#4fc3a1] text-[#4fc3a1]' : 'border-transparent text-[#6b7280] hover:text-[#374151]'
              )}
            >{t.label}</button>
          ))}
          <div className="flex-1" />
          {curriculumSubTab === 'curriculum' ? (
            <>
              <div className="flex items-center px-4 text-[11.5px] text-[#6b7280]">
                진행 {doneCurriculum}/{curriculum.length}
                {curriculum.length > 0 && (
                  <div className="ml-2 w-24 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden inline-block">
                    <div className="h-full bg-[#4fc3a1] rounded-full" style={{ width: `${Math.round((doneCurriculum / curriculum.length) * 100)}%` }} />
                  </div>
                )}
              </div>
              <div className="pr-4">
                <Button variant="default" size="sm" onClick={openCurrAdd}><Plus size={12} /> 단원 추가</Button>
              </div>
            </>
          ) : (
            <div className="pr-4">
              <Button variant="default" size="sm" onClick={openTbAdd}><Plus size={12} /> 교재 추가</Button>
            </div>
          )}
        </div>
        {curriculumSubTab === 'curriculum' && (
          <>
            {/* 팔레트 선택기 */}
            <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center gap-3">
              <span className="text-[11.5px] text-[#6b7280]">색상 테마</span>
              <div className="flex gap-1.5">
                {(['red', 'orange', 'green', 'custom'] as CurriculumPalette[]).map((p) => {
                  const swatches = CURRICULUM_PALETTES[p].colors.slice(0, 4);
                  const active = currentPalette === p;
                  return (
                    <button key={p} onClick={() => handlePaletteChange(p)}
                      className={clsx('px-2 py-1 rounded-[8px] border flex items-center gap-1.5 cursor-pointer transition-colors',
                        active ? 'border-[#1a2535] bg-[#f4f6f8]' : 'border-[#e2e8f0] hover:border-[#1a2535]'
                      )}
                      title={CURRICULUM_PALETTES[p].label}
                    >
                      {p === 'custom' ? (
                        <span className="text-[11px] text-[#374151]">직접</span>
                      ) : (
                        <span className="flex">
                          {swatches.map((c, i) => (
                            <span key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c, marginLeft: i === 0 ? 0 : -2 }} />
                          ))}
                        </span>
                      )}
                      <span className="text-[10.5px] text-[#374151]">{CURRICULUM_PALETTES[p].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {curriculum.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-[#9ca3af]">등록된 커리큘럼이 없습니다.</div>
            ) : (
              <div className="p-4 space-y-5">
                {(['MONTH', 'WEEK', 'SESSION'] as CurriculumUnitType[]).map((ut) => {
                  const groupRows = curriculum.filter((r) => r.unitType === ut);
                  if (groupRows.length === 0) return null;
                  const minWeek = Math.min(...groupRows.map((r) => r.startWeek));
                  const maxWeek = Math.max(...groupRows.map((r) => r.endWeek));
                  const cols = maxWeek - minWeek + 1;
                  return (
                    <div key={ut} className="border border-[#e2e8f0] rounded-[10px] overflow-hidden">
                      <div className="px-3 py-2 bg-[#f4f6f8] text-[11.5px] font-semibold text-[#374151]">
                        {UNIT_TYPE_OPTIONS.find((u) => u.value === ut)?.label} 커리큘럼
                      </div>
                      <div className="overflow-x-auto">
                        <table className="border-collapse text-[11.5px]" style={{ minWidth: '100%' }}>
                          <thead>
                            <tr>
                              <th className="sticky left-0 bg-white z-10 px-3 py-2 text-left font-medium text-[#6b7280] border-b border-[#e2e8f0] w-[180px] min-w-[180px]">단원</th>
                              {Array.from({ length: cols }).map((_, i) => (
                                <th key={i} className="px-2 py-2 text-center font-medium text-[#6b7280] border-b border-[#e2e8f0] min-w-[44px]">
                                  {minWeek + i}{unitSuffix(ut)}
                                </th>
                              ))}
                              <th className="px-2 py-2 border-b border-[#e2e8f0] w-[60px]"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupRows.map((row, idx) => {
                              const barColor = resolveBarColor(row, idx, currentPalette);
                              const startOffset = row.startWeek - minWeek;
                              const span = row.endWeek - row.startWeek + 1;
                              return (
                                <tr key={row.id} className="border-t border-[#f1f5f9] hover:bg-[#f9fafb] group">
                                  <td className="sticky left-0 bg-white z-10 px-3 py-2 group-hover:bg-[#f9fafb]">
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => toggleCurriculumDone(row)}
                                        className={clsx('w-4 h-4 rounded border flex items-center justify-center text-[10px] cursor-pointer shrink-0',
                                          row.done ? 'bg-[#4fc3a1] border-[#4fc3a1] text-white' : 'border-[#cbd5e1] hover:border-[#4fc3a1]'
                                        )}
                                        title={row.done ? '완료' : '예정'}
                                      >{row.done ? '✓' : ''}</button>
                                      <span className="font-medium text-[#111827] truncate" title={row.topic}>{row.topic}</span>
                                    </div>
                                    {row.detail && <div className="text-[10.5px] text-[#9ca3af] mt-0.5 ml-6 truncate" title={row.detail}>{row.detail}</div>}
                                  </td>
                                  {/* 빈 셀 + 막대 셀 + 빈 셀 */}
                                  {Array.from({ length: cols }).map((_, i) => {
                                    if (i === startOffset) {
                                      return (
                                        <td key={i} colSpan={span} className="p-1 align-middle">
                                          <div className="rounded-[6px] text-white text-[10.5px] font-medium px-2 py-1 truncate text-center"
                                            style={{ backgroundColor: barColor, opacity: row.done ? 0.6 : 1 }}
                                            title={`${row.topic} (${row.startWeek}${unitSuffix(ut)}~${row.endWeek}${unitSuffix(ut)})`}
                                          >
                                            {row.topic}
                                          </div>
                                        </td>
                                      );
                                    }
                                    if (i > startOffset && i < startOffset + span) return null;
                                    return <td key={i} className="border-l border-[#f8fafc]"></td>;
                                  })}
                                  <td className="px-2 py-1 text-right whitespace-nowrap">
                                    <button onClick={() => openCurrEdit(row)} className="p-1 text-[#6b7280] hover:text-[#4fc3a1] cursor-pointer" title="수정"><Pencil size={13} /></button>
                                    <button onClick={() => handleDeleteCurriculum(row)} className="p-1 ml-1 text-[#6b7280] hover:text-[#ef4444] cursor-pointer" title="삭제"><Trash2 size={13} /></button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {curriculumSubTab === 'textbook' && (
          textbooks.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-[#9ca3af]">등록된 교재가 없습니다.</div>
          ) : (
            <div className="divide-y divide-[#f1f5f9]">
              {textbooks.map((tb) => (
                <div key={tb.id} className="px-4 py-3 flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-[6px] bg-[#EDE9FE] flex items-center justify-center shrink-0">
                    <BookOpen size={14} className="text-[#5B4FBE]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[#111827]">{tb.name}</div>
                    <div className="text-[11px] text-[#6b7280]">
                      {tb.publisher && `${tb.publisher} · `}{tb.price.toLocaleString()}원{tb.unit && ` / ${tb.unit}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11.5px] text-[#374151]">{tb.currentUnit} / {tb.totalUnits}{tb.unit || '단원'}</div>
                    <div className="w-20 h-1.5 bg-[#f1f5f9] rounded-full mt-1">
                      <div className="h-full bg-[#4fc3a1] rounded-full" style={{ width: `${tb.totalUnits > 0 ? Math.round((tb.currentUnit / tb.totalUnits) * 100) : 0}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button onClick={() => openTbEdit(tb)} className="p-1.5 text-[#6b7280] hover:text-[#4fc3a1] cursor-pointer" title="수정"><Pencil size={13} /></button>
                    <button onClick={() => handleDeleteTextbook(tb)} className="p-1.5 text-[#6b7280] hover:text-[#ef4444] cursor-pointer" title="삭제"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── 커리큘럼 추가/수정 모달 ───────────────────────── */}
      <Modal open={currModalOpen} onClose={() => setCurrModalOpen(false)}
        title={currEditId ? '단원 수정' : '단원 추가'} size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setCurrModalOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleSaveCurriculum}>{currEditId ? '저장' : '추가'}</Button></>}
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1.5">구분 *</label>
            <div className="flex gap-1.5">
              {UNIT_TYPE_OPTIONS.map((u) => (
                <button key={u.value} type="button" onClick={() => setCurrForm((f) => ({ ...f, unitType: u.value }))}
                  className={clsx('flex-1 text-[11.5px] py-1.5 rounded-[8px] border transition-colors cursor-pointer',
                    currForm.unitType === u.value ? 'bg-[#1a2535] text-white border-[#1a2535]' : 'bg-[#f4f6f8] text-[#6b7280] border-[#e2e8f0] hover:border-[#1a2535]'
                  )}
                >{u.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">시작 {unitSuffix(currForm.unitType)} *</label>
              <input type="number" min={1} className={fieldCls} value={currForm.startWeek}
                onChange={(e) => setCurrForm((f) => ({ ...f, startWeek: e.target.value }))}
                placeholder={`예: 1`} />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">끝 {unitSuffix(currForm.unitType)}</label>
              <input type="number" min={1} className={fieldCls} value={currForm.endWeek}
                onChange={(e) => setCurrForm((f) => ({ ...f, endWeek: e.target.value }))}
                placeholder="비워두면 시작과 동일" />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">단원명 *</label>
            <input className={fieldCls} value={currForm.topic}
              onChange={(e) => setCurrForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="예: 기초입문" />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">세부 내용</label>
            <textarea className={fieldCls + ' resize-none'} rows={2} value={currForm.detail}
              onChange={(e) => setCurrForm((f) => ({ ...f, detail: e.target.value }))}
              placeholder="예: 시험에 꼭 나오는 핵심이론을 이해/암기" />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">막대 색상 (선택)</label>
            <div className="flex items-center gap-2">
              <input type="color" className="w-9 h-9 border border-[#e2e8f0] rounded-[8px] cursor-pointer"
                value={currForm.color || '#4fc3a1'}
                onChange={(e) => setCurrForm((f) => ({ ...f, color: e.target.value }))} />
              <input type="text" className={fieldCls} value={currForm.color}
                onChange={(e) => setCurrForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="비워두면 팔레트에서 자동 부여" />
              {currForm.color && (
                <button type="button" onClick={() => setCurrForm((f) => ({ ...f, color: '' }))}
                  className="text-[11px] text-[#6b7280] hover:text-[#ef4444] px-2 cursor-pointer">초기화</button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── 교재 추가/수정 모달 ───────────────────────────── */}
      <Modal open={tbModalOpen} onClose={() => setTbModalOpen(false)}
        title={tbEditId ? '교재 수정' : '교재 추가'} size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setTbModalOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleSaveTextbook}>{tbEditId ? '저장' : '추가'}</Button></>}
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">교재명 *</label>
            <input className={fieldCls} value={tbForm.name} onChange={(e) => setTbForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 개념수학 5학년" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">출판사</label><input className={fieldCls} value={tbForm.publisher} onChange={(e) => setTbForm((f) => ({ ...f, publisher: e.target.value }))} placeholder="예: 천재교육" /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">가격 (원)</label><input type="number" className={fieldCls} value={tbForm.price} onChange={(e) => setTbForm((f) => ({ ...f, price: e.target.value }))} placeholder="예: 18000" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">단위</label><input className={fieldCls} value={tbForm.unit} onChange={(e) => setTbForm((f) => ({ ...f, unit: e.target.value }))} placeholder="권" /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">총 권수</label><input type="number" className={fieldCls} value={tbForm.totalUnits} onChange={(e) => setTbForm((f) => ({ ...f, totalUnits: e.target.value }))} min={1} /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">현재 권</label><input type="number" className={fieldCls} value={tbForm.currentUnit} onChange={(e) => setTbForm((f) => ({ ...f, currentUnit: e.target.value }))} min={1} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">ISBN</label><input className={fieldCls} value={tbForm.isbn} onChange={(e) => setTbForm((f) => ({ ...f, isbn: e.target.value }))} placeholder="978-..." /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">구입일</label><input type="date" className={fieldCls} value={tbForm.purchaseDate} onChange={(e) => setTbForm((f) => ({ ...f, purchaseDate: e.target.value }))} /></div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">메모</label>
            <input className={fieldCls} value={tbForm.memo} onChange={(e) => setTbForm((f) => ({ ...f, memo: e.target.value }))} placeholder="예: 상·하 2권 세트" />
          </div>
        </div>
      </Modal>
    </>
  );
}
