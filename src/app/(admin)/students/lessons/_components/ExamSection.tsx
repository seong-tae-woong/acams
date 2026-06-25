'use client';
import { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { StudentLessonExam } from '@/lib/types/lesson';

function fmt(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

interface CatOption {
  id: string;
  name: string;
}

const SELECT_CLS =
  'text-[11.5px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 bg-white focus:outline-none focus:border-[#4fc3a1] disabled:bg-[#f4f6f8] disabled:text-[#9ca3af]';

function avgPctOf(list: StudentLessonExam[]): number | null {
  const pcts = list.filter((e) => e.totalScore > 0).map((e) => (e.score / e.totalScore) * 100);
  return pcts.length > 0 ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null;
}

export default function ExamSection({ exams }: { exams: StudentLessonExam[] }) {
  const [filterCat1, setFilterCat1] = useState('');
  const [filterCat2, setFilterCat2] = useState('');
  const [filterCat3, setFilterCat3] = useState('');

  // 새 조회(학생/기간 변경)마다 필터 초기화 — exams는 조회 시에만 새 배열로 교체됨
  useEffect(() => {
    setFilterCat1('');
    setFilterCat2('');
    setFilterCat3('');
  }, [exams]);

  // 카테고리 옵션은 실제 시험이 존재하는 카테고리에서만 도출 (계층은 시험의 cat1→2→3 체인으로 구성)
  const cat1Options = useMemo<CatOption[]>(() => {
    const m = new Map<string, string>();
    for (const e of exams) if (e.category1Id) m.set(e.category1Id, e.category1Name ?? '(이름 없음)');
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [exams]);

  const cat2Options = useMemo<CatOption[]>(() => {
    if (!filterCat1) return [];
    const m = new Map<string, string>();
    for (const e of exams) {
      if (e.category1Id === filterCat1 && e.category2Id) m.set(e.category2Id, e.category2Name ?? '(이름 없음)');
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [exams, filterCat1]);

  const cat3Options = useMemo<CatOption[]>(() => {
    if (!filterCat2) return [];
    const m = new Map<string, string>();
    for (const e of exams) {
      if (e.category2Id === filterCat2 && e.category3Id) m.set(e.category3Id, e.category3Name ?? '(이름 없음)');
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [exams, filterCat2]);

  const filtered = useMemo(
    () =>
      exams.filter((e) => {
        if (filterCat1 && e.category1Id !== filterCat1) return false;
        if (filterCat2 && e.category2Id !== filterCat2) return false;
        if (filterCat3 && e.category3Id !== filterCat3) return false;
        return true;
      }),
    [exams, filterCat1, filterCat2, filterCat3],
  );

  // 만점 대비 평균 (SummaryCard avgScorePct와 동일한 환산 방식)
  const overallAvg = useMemo(() => avgPctOf(exams), [exams]);
  const filteredAvg = useMemo(() => avgPctOf(filtered), [filtered]);

  if (exams.length === 0) return null;

  const hasCategories = cat1Options.length > 0;
  const hasFilter = Boolean(filterCat1 || filterCat2 || filterCat3);
  // 선택된 카테고리(가장 깊은 레벨)의 이름 — 비교 평균 라벨용
  const selectedCatName =
    (filterCat3 && cat3Options.find((c) => c.id === filterCat3)?.name) ||
    (filterCat2 && cat2Options.find((c) => c.id === filterCat2)?.name) ||
    (filterCat1 && cat1Options.find((c) => c.id === filterCat1)?.name) ||
    '';
  // 표의 카테고리 칸: 이미 필터로 거른 상위 레벨은 빼서 중복 제거 (전체=0, cat1=1, cat2=2, cat3=3)
  const filterDepth = filterCat3 ? 3 : filterCat2 ? 2 : filterCat1 ? 1 : 0;
  const colCount = hasCategories ? 6 : 5;
  const delta = filteredAvg != null && overallAvg != null ? filteredAvg - overallAvg : null;

  const chipCls = (active: boolean) =>
    clsx(
      'text-[11.5px] px-2.5 py-1 rounded-[7px] border cursor-pointer transition-colors',
      active
        ? 'bg-[#4fc3a1] text-white border-[#4fc3a1] font-medium'
        : 'bg-white text-[#6b7280] border-[#e2e8f0] hover:border-[#cbd5e1]',
    );

  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-baseline gap-2">
        <span className="text-[12.5px] font-semibold text-[#111827]">시험 점수</span>
        <span className="text-[11px] font-normal text-[#9ca3af]">{filtered.length}회</span>
      </div>

      {/* 카테고리 칩 필터 (카테고리가 있는 경우에만) */}
      {hasCategories && (
        <div className="px-4 py-2.5 border-b border-[#e2e8f0] bg-[#fafbfc] flex flex-wrap items-center gap-1.5">
          <button className={chipCls(!filterCat1)} onClick={() => { setFilterCat1(''); setFilterCat2(''); setFilterCat3(''); }}>
            전체
          </button>
          {cat1Options.map((c) => (
            <button
              key={c.id}
              className={chipCls(filterCat1 === c.id)}
              onClick={() => { setFilterCat1(c.id); setFilterCat2(''); setFilterCat3(''); }}
            >
              {c.name}
            </button>
          ))}
          {/* 세부 분류 (선택한 카테고리에 하위가 있을 때만) */}
          {filterCat1 && cat2Options.length > 0 && (
            <select
              value={filterCat2}
              onChange={(e) => { setFilterCat2(e.target.value); setFilterCat3(''); }}
              className={clsx(SELECT_CLS, 'ml-1')}
            >
              <option value="">세부 분류 (전체)</option>
              {cat2Options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {filterCat2 && cat3Options.length > 0 && (
            <select
              value={filterCat3}
              onChange={(e) => setFilterCat3(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">세부 분류 2 (전체)</option>
              {cat3Options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* 비교 평균 (카테고리 필터를 걸었을 때만) */}
      {hasFilter && filteredAvg != null && (
        <div className="px-4 py-2.5 border-b border-[#e2e8f0] flex items-baseline gap-2 flex-wrap">
          <span className="text-[12.5px] text-[#6b7280]">{selectedCatName} 평균</span>
          <span className="text-[19px] font-bold text-[#111827] tabular-nums leading-none">{filteredAvg}점</span>
          {overallAvg != null && (
            <span className="text-[12px] text-[#9ca3af]">· 전체 {overallAvg}점</span>
          )}
          {delta != null && delta !== 0 && (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 text-[11.5px] font-semibold',
                delta > 0 ? 'text-[#0f6e56]' : 'text-[#b45309]',
              )}
            >
              {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
          <span className="text-[11px] text-[#9ca3af] ml-auto">만점 대비</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#f9fafb] text-[#6b7280] text-[11px]">
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">날짜</th>
              <th className="text-left font-medium px-3 py-2 min-w-[140px]">시험</th>
              {hasCategories && <th className="text-left font-medium px-3 py-2 whitespace-nowrap">카테고리</th>}
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">과목</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">점수</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">등수</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-[12px] text-[#9ca3af]">
                  필터 조건에 해당하는 시험이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((ex) => {
                const pct = ex.totalScore > 0 ? Math.round((ex.score / ex.totalScore) * 100) : null;
                // 필터로 거른 상위 레벨은 빼고, 남은 카테고리만 원래 레벨 색으로 표시
                const crumbs = [ex.category1Name, ex.category2Name, ex.category3Name]
                  .map((name, lvl) => ({ name, lvl }))
                  .filter((c) => c.name && c.lvl >= filterDepth) as { name: string; lvl: number }[];
                return (
                  <tr key={ex.id} className="border-t border-[#f1f5f9]">
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#111827] tabular-nums">{fmt(ex.date)}</td>
                    <td className="px-3 py-2.5 text-[#374151]">{ex.name}</td>
                    {hasCategories && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {crumbs.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {crumbs.map((c) => (
                              <span
                                key={c.lvl}
                                className={clsx(
                                  'text-[10.5px] px-1.5 py-0.5 rounded-[4px] font-medium',
                                  c.lvl === 0 && 'bg-[#4fc3a1] text-white',
                                  c.lvl === 1 && 'bg-[#e8f5f1] text-[#2f8f74]',
                                  c.lvl === 2 && 'bg-[#f4f6f8] text-[#6b7280]',
                                )}
                              >
                                {c.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#d1d5db]">–</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#6b7280]">{ex.subject}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className="font-semibold text-[#111827] tabular-nums">{ex.score}</span>
                      <span className="text-[#9ca3af]">
                        {' '}
                        / {ex.totalScore}
                        {pct != null ? ` (${pct}%)` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-[#374151] tabular-nums">
                      {ex.rank != null ? `${ex.rank}등` : '–'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
