'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { Sparkles, ChevronRight, Bookmark, X, Layers } from 'lucide-react';
import Button from '@/components/shared/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from '@/lib/stores/toastStore';
import { DIFFICULTY_LABELS, LAYOUT_LABELS, type QuestionFormat, type TestLayout } from '@/lib/types/questionBank';
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  diffLabel,
  isMockSpec,
  type DraftListItem,
  type DraftStatus,
  type PresetListItem,
} from './types';

// Hobby(Vercel 60초 상한) 안전 여유 — 서버 spec.ts와 동일. Pro 전환 시 함께 상향.
const MAX_COUNT = 10;

function StatusBadge({ status }: { status: DraftStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-[20px] text-[11px] font-medium whitespace-nowrap',
        STATUS_BADGE_CLASS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

export default function QuestionGenerator() {
  const router = useRouter();

  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [count, setCount] = useState(10);
  const [isKiller, setIsKiller] = useState(false);
  const [format, setFormat] = useState<QuestionFormat>('choice');
  const [layout, setLayout] = useState<TestLayout>('BASIC');
  const [comment, setComment] = useState('');
  const [generating, setGenerating] = useState(false);

  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [presets, setPresets] = useState<PresetListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDrafts = () => {
    setLoading(true);
    fetch('/api/question-bank/drafts')
      .then((r) => r.json())
      .then((d) => setDrafts(Array.isArray(d?.drafts) ? d.drafts : []))
      .catch(() => toast('초안 목록을 불러오지 못했습니다.', 'error'))
      .finally(() => setLoading(false));
  };
  const loadPresets = () => {
    fetch('/api/question-bank/presets')
      .then((r) => r.json())
      .then((d) => setPresets(Array.isArray(d?.presets) ? d.presets : []))
      .catch(() => {
        /* 프리셋 로드 실패는 조용히 무시(핵심 흐름 아님) */
      });
  };
  useEffect(() => {
    loadDrafts();
    loadPresets();
  }, []);

  const applyPreset = (p: PresetListItem) => {
    setSubject(p.spec?.subject ?? '');
    setGradeLevel(p.spec?.gradeLevel ?? '');
    setType(p.spec?.type ?? '');
    setDifficulty(p.spec?.difficulty ?? 3);
    setCount(Math.min(MAX_COUNT, Math.max(1, p.spec?.count ?? 10)));
    setIsKiller(!!p.spec?.isKiller);
    setFormat(p.spec?.format ?? 'choice');
    setComment(p.spec?.comment ?? '');
    setLayout(p.layout ?? 'BASIC');
    toast(`양식 "${p.name}"을 불러왔습니다.`, 'info');
  };

  const savePreset = async () => {
    if (!subject.trim() || !gradeLevel.trim() || !type.trim()) {
      return toast('과목·학년·유형을 먼저 입력하세요.', 'error');
    }
    const name = window.prompt('양식 이름을 입력하세요 (예: 중3 데일리 어법)');
    if (name == null) return; // 취소
    if (!name.trim()) return toast('양식 이름을 입력하세요.', 'error');
    try {
      const res = await fetch('/api/question-bank/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim(),
          gradeLevel: gradeLevel.trim(),
          type: type.trim(),
          difficulty,
          count,
          isKiller,
          format,
          layout,
          comment: comment.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '양식 저장 실패');
      toast('양식을 저장했습니다.', 'success');
      loadPresets();
    } catch (e) {
      toast(e instanceof Error ? e.message : '양식 저장 실패', 'error');
    }
  };

  const deletePreset = async (p: PresetListItem) => {
    if (!confirm(`양식 "${p.name}"을 삭제할까요?`)) return;
    const res = await fetch(`/api/question-bank/presets/${p.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast('양식을 삭제했습니다.', 'success');
      loadPresets();
    } else {
      toast('삭제 실패', 'error');
    }
  };

  const generate = async () => {
    if (!subject.trim() || !gradeLevel.trim() || !type.trim()) {
      return toast('과목·학년·유형은 필수입니다.', 'error');
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
      return toast(`문항수는 1~${MAX_COUNT} 사이여야 합니다.`, 'error');
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/question-bank/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          gradeLevel: gradeLevel.trim(),
          type: type.trim(),
          difficulty,
          count,
          isKiller,
          format,
          layout,
          comment: comment.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '생성에 실패했습니다.');

      if (d.refused) {
        toast('AI가 생성을 거부했습니다. 초안에서 코멘트를 조정해 다시 시도하세요.', 'error');
      } else {
        if (d.incomplete) {
          toast(`요청 ${d.requested}개 중 ${d.generated}개 생성됨(부족분은 초안에서 재생성).`, 'info');
        }
        if (d.reviewSkipped) toast('자동 검수를 건너뛰었습니다 — 전수 검토가 필요합니다.', 'info');
        toast('초안을 생성했습니다.', 'success');
      }
      if (d.draft?.id) router.push(`/questions/${d.draft.id}`);
      else loadDrafts();
    } catch (e) {
      toast(e instanceof Error ? e.message : '생성에 실패했습니다.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const inputCls = 'mt-1 w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px]';

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="max-w-3xl space-y-5">
        {/* 생성 폼 */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#4fc3a1]" />
              <span className="text-[14px] font-semibold text-[#111827]">AI 문제 생성</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href="/questions/mock"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] text-[#4338ca] border border-[#c7d2fe] bg-[#eef2ff] rounded-[8px] hover:bg-[#e0e7ff]"
              >
                <Layers size={13} /> 모의고사 만들기
              </Link>
              <Button variant="ghost" size="sm" onClick={savePreset}>
                <Bookmark size={14} /> 양식으로 저장
              </Button>
            </div>
          </div>

          {/* 저장된 양식(프리셋) */}
          {presets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[11px] text-[#9ca3af]">저장된 양식</span>
              {presets.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-[20px] bg-[#f1f5f9] text-[12px]"
                >
                  <button onClick={() => applyPreset(p)} className="text-[#374151] hover:text-[#111827]" title="이 양식 불러오기">
                    {p.name}
                  </button>
                  <button onClick={() => deletePreset(p)} className="text-[#9ca3af] hover:text-red-500" title="삭제">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[12px] text-[#6b7280]">과목 *</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="영어" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[12px] text-[#6b7280]">학년 *</span>
              <input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="중3" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[12px] text-[#6b7280]">유형 *</span>
              <input value={type} onChange={(e) => setType(e.target.value)} placeholder="어법 / 어휘 / 독해" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[12px] text-[#6b7280]">난이도</span>
              <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className={clsx(inputCls, 'bg-white')}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} · {DIFFICULTY_LABELS[n]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] text-[#6b7280]">문항수 (1~{MAX_COUNT})</span>
              <input
                type="number"
                min={1}
                max={MAX_COUNT}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(MAX_COUNT, Number(e.target.value))))}
                className={clsx(inputCls, 'text-center tabular-nums')}
              />
            </label>
            <label className="block">
              <span className="text-[12px] text-[#6b7280]">형식</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as QuestionFormat)} className={clsx(inputCls, 'bg-white')}>
                <option value="choice">객관식</option>
                <option value="text">주관식</option>
              </select>
            </label>
          </div>

          <div className="flex items-end gap-5 mt-3">
            <label className="block w-44">
              <span className="text-[12px] text-[#6b7280]">인쇄 양식</span>
              <select value={layout} onChange={(e) => setLayout(e.target.value as TestLayout)} className={clsx(inputCls, 'bg-white')}>
                {(Object.keys(LAYOUT_LABELS) as TestLayout[]).map((k) => (
                  <option key={k} value={k}>
                    {LAYOUT_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2.5">
              <input type="checkbox" checked={isKiller} onChange={(e) => setIsKiller(e.target.checked)} className="w-4 h-4 accent-[#1a2535]" />
              <span className="text-[12.5px] text-[#374151]">고난도(킬러) 문항</span>
            </label>
          </div>

          <label className="block mt-3">
            <span className="text-[12px] text-[#6b7280]">코멘트 (선택) — 세부 주제·요구사항</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="예: 자동사/타동사 구분에 집중. 헷갈리기 쉬운 동사 위주로."
              rows={2}
              className={clsx(inputCls, 'resize-none')}
            />
          </label>

          <div className="flex items-center justify-between mt-3">
            <span className="text-[11.5px] text-[#9ca3af]">
              한 번에 최대 {MAX_COUNT}문항 · 생성 후 자동 검수 → 강사 검토·피드백 → 승인
            </span>
            <Button variant="dark" size="lg" onClick={generate} disabled={generating}>
              <Sparkles size={15} /> {generating ? '생성 중… (최대 1분)' : '문제 생성'}
            </Button>
          </div>
        </div>

        {/* 최근 초안 */}
        <div>
          <div className="text-[13px] font-medium text-[#111827] mb-2">최근 초안</div>
          {loading ? (
            <div className="py-10 grid place-items-center">
              <LoadingSpinner />
            </div>
          ) : drafts.length === 0 ? (
            <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-10 text-center text-[13px] text-[#9ca3af]">
              아직 생성한 초안이 없습니다. 위에서 첫 문제를 만들어보세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {drafts.map((d) => {
                const spec = d.spec;
                return (
                  <button
                    key={d.id}
                    onClick={() => router.push(`/questions/${d.id}`)}
                    className="text-left bg-white border border-[#e2e8f0] rounded-[12px] p-4 hover:border-[#cbd5e1] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-[#111827] truncate">
                          {isMockSpec(spec)
                            ? spec.title?.trim() || `${spec.subject} 모의고사`
                            : `${spec.subject} · ${spec.type}${spec.isKiller ? ' · 킬러' : ''}`}
                        </div>
                        <div className="text-[12px] text-[#6b7280] mt-0.5 tabular-nums">
                          {isMockSpec(spec)
                            ? `${spec.gradeLevel} · 모의고사 ${spec.sections?.length ?? 0}영역 · ${d._count?.items ?? 0}문항 · ${formatDate(d.createdAt)}`
                            : `${spec.gradeLevel} · 난이도 ${diffLabel(spec.difficulty)} · ${d._count?.items ?? 0}문항 · ${formatDate(d.createdAt)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <StatusBadge status={d.status} />
                        <ChevronRight size={16} className="text-[#cbd5e1]" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
