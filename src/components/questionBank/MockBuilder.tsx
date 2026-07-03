'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { Plus, Trash2, Sparkles, ChevronLeft, Layers } from 'lucide-react';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import { DIFFICULTY_LABELS, type QuestionFormat } from '@/lib/types/questionBank';

const MAX_COUNT = 20;
const MAX_SECTIONS = 10;

interface SectionInput {
  label: string;
  type: string;
  count: number;
  difficulty: number;
  format: QuestionFormat;
}

function blankSection(): SectionInput {
  return { label: '', type: '', count: 5, difficulty: 3, format: 'choice' };
}

export default function MockBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [sections, setSections] = useState<SectionInput[]>([
    { label: '어법', type: '어법', count: 5, difficulty: 3, format: 'choice' },
    { label: '독해', type: '독해', count: 5, difficulty: 3, format: 'choice' },
  ]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ cur: number; total: number; label: string } | null>(null);

  const update = (i: number, patch: Partial<SectionInput>) =>
    setSections((s) => s.map((sec, j) => (j === i ? { ...sec, ...patch } : sec)));
  const addSection = () => {
    if (sections.length >= MAX_SECTIONS) return toast(`영역은 최대 ${MAX_SECTIONS}개입니다.`, 'error');
    setSections((s) => [...s, blankSection()]);
  };
  const removeSection = (i: number) => setSections((s) => s.filter((_, j) => j !== i));

  const totalQ = sections.reduce((n, s) => n + (Number.isFinite(s.count) ? s.count : 0), 0);

  const generate = async () => {
    if (!subject.trim() || !gradeLevel.trim()) return toast('과목·학년은 필수입니다.', 'error');
    if (sections.length === 0) return toast('영역을 최소 1개 추가하세요.', 'error');
    if (sections.some((s) => !s.type.trim())) return toast('각 영역의 유형을 입력하세요.', 'error');

    setGenerating(true);
    try {
      const res = await fetch('/api/question-bank/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          subject: subject.trim(),
          gradeLevel: gradeLevel.trim(),
          sections: sections.map((s) => ({
            label: s.label.trim() || undefined,
            type: s.type.trim(),
            count: s.count,
            difficulty: s.difficulty,
            format: s.format,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '모의고사 생성 실패');
      const draftId: string = d.draftId;

      // 섹션 순차 생성(각 ≤10문항 → 60초 안전)
      for (let i = 0; i < sections.length; i++) {
        setProgress({ cur: i + 1, total: sections.length, label: sections[i].label || sections[i].type });
        const sres = await fetch(`/api/question-bank/drafts/${draftId}/section`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionIndex: i }),
        });
        const sd = await sres.json();
        if (!sres.ok) throw new Error(sd.error ?? `${i + 1}번째 영역 생성 실패`);
        if (sd.refused) toast(`'${sd.label ?? i + 1}' 영역 생성이 거부됨 — 상세에서 재생성하세요.`, 'error');
      }
      toast('모의고사 초안을 생성했습니다.', 'success');
      router.push(`/questions/${draftId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : '모의고사 생성 실패', 'error');
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  const inputCls = 'border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 text-[13px]';

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="max-w-3xl space-y-4">
        <Link href="/questions" className="inline-flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#111827]">
          <ChevronLeft size={14} /> 문제 출제
        </Link>

        {/* 공통 정보 */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-[#4fc3a1]" />
            <span className="text-[14px] font-semibold text-[#111827]">모의고사 만들기</span>
            <span className="text-[11px] text-[#9ca3af]">여러 영역을 순차 생성해 한 시험지로</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[12px] text-[#6b7280]">시험명 (선택)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="3월 모의고사" className={clsx(inputCls, 'mt-1 w-full')} />
            </label>
            <label className="block">
              <span className="text-[12px] text-[#6b7280]">과목 *</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="영어" className={clsx(inputCls, 'mt-1 w-full')} />
            </label>
            <label className="block">
              <span className="text-[12px] text-[#6b7280]">학년 *</span>
              <input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="고1" className={clsx(inputCls, 'mt-1 w-full')} />
            </label>
          </div>
        </div>

        {/* 영역(섹션) */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[#6b7280]">영역 · 각 영역은 유형·문항수·난이도·형식 (영역당 최대 {MAX_COUNT}문항)</span>
            <button onClick={addSection} className="text-[12px] text-[#12B886] flex items-center gap-1">
              <Plus size={14} /> 영역 추가
            </button>
          </div>
          <div className="space-y-2">
            {/* 헤더 */}
            <div className="flex items-center gap-2 text-[11px] text-[#9ca3af] px-1">
              <span className="w-24">영역명</span>
              <span className="flex-1">유형</span>
              <span className="w-16 text-center">문항</span>
              <span className="w-20">난이도</span>
              <span className="w-20">형식</span>
              <span className="w-6" />
            </div>
            {sections.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={s.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="어법" aria-label="영역명" className={clsx(inputCls, 'w-24')} />
                <input value={s.type} onChange={(e) => update(i, { type: e.target.value })} placeholder="어법 / 어휘 / 독해" aria-label="유형" className={clsx(inputCls, 'flex-1')} />
                <input type="number" min={1} max={MAX_COUNT} value={s.count}
                  onChange={(e) => update(i, { count: Math.max(1, Math.min(MAX_COUNT, Number(e.target.value))) })}
                  className={clsx(inputCls, 'w-16 text-center tabular-nums')} aria-label="문항수" />
                <select value={s.difficulty} onChange={(e) => update(i, { difficulty: Number(e.target.value) })} className={clsx(inputCls, 'w-20 bg-white')} aria-label="난이도">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{DIFFICULTY_LABELS[n]}</option>
                  ))}
                </select>
                <select value={s.format} onChange={(e) => update(i, { format: e.target.value as QuestionFormat })} className={clsx(inputCls, 'w-20 bg-white')} aria-label="형식">
                  <option value="choice">객관식</option>
                  <option value="text">주관식</option>
                </select>
                <button onClick={() => removeSection(i)} className="p-1.5 text-[#9ca3af] hover:text-red-500 w-6" aria-label="영역 삭제">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {sections.length === 0 && <div className="text-[12px] text-[#9ca3af] py-2">영역을 추가하세요 (예: 어법 5 + 독해 5).</div>}
          </div>
        </div>

        {/* 생성 */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#6b7280]">
            {progress
              ? `[${progress.cur}/${progress.total}] '${progress.label}' 영역 생성 중… (영역당 최대 1분)`
              : `총 ${sections.length}개 영역 · ${totalQ}문항 — 영역별로 순차 생성됩니다.`}
          </span>
          <Button variant="dark" size="lg" onClick={generate} disabled={generating}>
            <Sparkles size={15} /> {generating ? '생성 중…' : '모의고사 생성'}
          </Button>
        </div>
      </div>
    </div>
  );
}
