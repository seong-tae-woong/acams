'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  ChevronLeft,
  Check,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Sparkles,
  Send,
} from 'lucide-react';
import Button from '@/components/shared/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from '@/lib/stores/toastStore';
import { DIFFICULTY_LABELS, LAYOUT_LABELS } from '@/lib/types/questionBank';
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  FLAG_LABELS,
  blocksToPlainText,
  diffLabel,
  isMockSpec,
  type DraftDetail,
  type DraftItem,
} from './types';

// 모의고사: 문항을 섹션별로 그룹핑(전역 순번 gi 보존)
function groupBySection(
  items: DraftItem[],
): { section: number; items: { item: DraftItem; gi: number }[] }[] {
  const map = new Map<number, { item: DraftItem; gi: number }[]>();
  items.forEach((item, gi) => {
    const sk = item.section ?? 0;
    const arr = map.get(sk) ?? [];
    arr.push({ item, gi });
    map.set(sk, arr);
  });
  return [...map.keys()].sort((a, b) => a - b).map((section) => ({ section, items: map.get(section)! }));
}

function ItemCard({ item, index }: { item: DraftItem; index: number }) {
  const choices = item.content?.choices ?? [];
  const answer = item.answer;
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[13px] font-semibold text-[#111827]">{index + 1}번</span>
        {item.difficulty != null && (
          <span className="text-[11px] text-[#6b7280]">난이도 {DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty}</span>
        )}
        {item.isKiller && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] text-[10.5px] font-medium bg-[#FEE2E2] text-[#991B1B]">
            고난도
          </span>
        )}
      </div>

      <div className="text-[13.5px] text-[#111827] leading-relaxed whitespace-pre-wrap">
        {blocksToPlainText(item.content?.stem)}
      </div>

      {choices.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {choices.map((c, ci) => {
            const correct = answer?.kind === 'choice' && answer.index === ci;
            return (
              <div
                key={ci}
                className={clsx(
                  'flex items-center gap-2 px-2 py-1 rounded-[6px] text-[13px]',
                  correct ? 'bg-[#ECFDF5] text-[#065f46] font-medium' : 'text-[#374151]',
                )}
              >
                <span className="text-[#9ca3af]">({ci + 1})</span>
                <span className="flex-1">{blocksToPlainText(c)}</span>
                {correct && <Check size={14} className="text-[#12B886]" />}
              </div>
            );
          })}
        </div>
      )}

      {answer?.kind === 'text' && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-[#065f46] bg-[#ECFDF5] rounded-[6px] px-2.5 py-1">
          <Check size={14} className="text-[#12B886]" /> 정답: {answer.value}
        </div>
      )}

      {item.explanation && (
        <div className="text-[12px] text-[#6b7280] mt-2 leading-relaxed">
          <span className="text-[#9ca3af]">해설 </span>
          {item.explanation}
        </div>
      )}

      {item.conceptTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.conceptTags.map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded-[6px] text-[10.5px] bg-[#f1f5f9] text-[#6b7280]">
              #{t}
            </span>
          ))}
        </div>
      )}

      {item.flags.length > 0 && (
        <div className="mt-2.5 space-y-1">
          {item.flags.map((f) => (
            <div
              key={f.id}
              className={clsx(
                'flex items-start gap-1.5 text-[11.5px] px-2 py-1 rounded-[6px]',
                f.resolved
                  ? 'bg-[#f1f5f9] text-[#6b7280] line-through'
                  : f.severity === 'ERROR'
                    ? 'bg-[#FEE2E2] text-[#991B1B]'
                    : 'bg-[#FEF3C7] text-[#92400E]',
              )}
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                <b>{FLAG_LABELS[f.code] ?? f.code}</b>
                {f.message ? ` — ${f.message}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QuestionDraftDetail({ id }: { id: string }) {
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/question-bank/drafts/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? '초안을 불러오지 못했습니다.');
        setDraft(d.draft as DraftDetail);
      })
      .catch((e) => toast(e instanceof Error ? e.message : '초안을 불러오지 못했습니다.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(load, [load]);

  const submitFeedback = async () => {
    if (!feedback.trim()) return toast('피드백 내용을 입력하세요.', 'error');
    setBusy(true);
    try {
      const res = await fetch(`/api/question-bank/drafts/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '재생성에 실패했습니다.');
      if (d.refused) toast('AI가 재생성을 거부했습니다. 피드백을 조정해 다시 시도하세요.', 'error');
      else toast(`${d.round}차 재생성 완료.`, 'success');
      setFeedback('');
      setDraft(d.draft as DraftDetail);
    } catch (e) {
      toast(e instanceof Error ? e.message : '재생성에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const approve = async (override = false) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/question-bank/drafts/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ override }),
      });
      const d = await res.json();
      if (res.status === 422 && d.unresolvedErrors) {
        if (
          confirm(
            `미해결 오류(ERROR) 플래그가 ${d.unresolvedErrors}건 있습니다.\n검토를 마쳤다면 그래도 승인할까요?`,
          )
        ) {
          setBusy(false);
          return approve(true);
        }
        return;
      }
      if (!res.ok) throw new Error(d.error ?? '승인에 실패했습니다.');
      toast(`승인 완료 · 문항 ${d.promoted}개를 문항은행에 적재했습니다.`, 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '승인에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 grid place-items-center">
        <LoadingSpinner />
      </div>
    );
  }
  if (!draft) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <Link href="/questions" className="inline-flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#111827] mb-3">
          <ChevronLeft size={14} /> 문제 출제
        </Link>
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-10 text-center text-[13px] text-[#9ca3af]">
          초안을 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const spec = draft.spec;
  const mockSpec = isMockSpec(spec) ? spec : null;
  const single = isMockSpec(spec) ? null : spec;
  const isApproved = draft.status === 'APPROVED';
  const unresolved = draft.items.flatMap((i) => i.flags).filter((f) => !f.resolved);
  const errorCount = unresolved.filter((f) => f.severity === 'ERROR').length;
  const warnCount = unresolved.filter((f) => f.severity === 'WARNING').length;
  const rounds = draft.turns.length;
  const expectedCount = mockSpec
    ? mockSpec.sections.reduce((n, s) => n + (s.count ?? 0), 0)
    : (single?.count ?? 0);
  const incomplete = expectedCount > 0 && draft.items.length < expectedCount;
  const headerTitle = mockSpec
    ? mockSpec.title?.trim() || `${mockSpec.subject} 모의고사`
    : `${single!.subject} · ${single!.type}`;
  const pdfBtn =
    'inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] text-[#0F6E56] border border-[#cfeee2] bg-[#f0faf6] rounded-[8px] hover:bg-[#e4f5ee]';

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="max-w-3xl space-y-4">
        <Link href="/questions" className="inline-flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#111827]">
          <ChevronLeft size={14} /> 문제 출제
        </Link>

        {/* 헤더 */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-[#111827]">{headerTitle}</span>
                <span
                  className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-[20px] text-[11px] font-medium',
                    STATUS_BADGE_CLASS[draft.status],
                  )}
                >
                  {STATUS_LABELS[draft.status]}
                </span>
                {rounds > 1 && <span className="text-[11px] text-[#9ca3af]">{rounds}회차</span>}
              </div>
              <div className="text-[12px] text-[#6b7280] mt-1 tabular-nums">
                {mockSpec
                  ? `${mockSpec.gradeLevel} · 모의고사 ${mockSpec.sections.length}영역 · ${draft.items.length}문항`
                  : `${single!.gradeLevel} · 난이도 ${diffLabel(single!.difficulty)} · ${draft.items.length}문항 · ${single!.format === 'text' ? '주관식' : '객관식'} · ${LAYOUT_LABELS[draft.layout] ?? '기본형'}${single!.isKiller ? ' · 킬러' : ''}`}
              </div>
              {!mockSpec && single!.comment && (
                <div className="text-[12px] text-[#6b7280] mt-1">“{single!.comment}”</div>
              )}
            </div>
            {draft.items.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <a href={`/api/question-bank/drafts/${id}/pdf?variant=exam`} target="_blank" rel="noopener noreferrer" className={pdfBtn}>
                  <FileText size={13} /> 시험지
                </a>
                <a href={`/api/question-bank/drafts/${id}/pdf?variant=answer`} target="_blank" rel="noopener noreferrer" className={pdfBtn}>
                  <FileText size={13} /> 정답지
                </a>
              </div>
            )}
          </div>

          {/* 요약 배너 */}
          {(errorCount > 0 || warnCount > 0 || incomplete) && (
            <div className="flex flex-wrap items-center gap-2 mt-3 text-[11.5px]">
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#FEE2E2] text-[#991B1B]">
                  <AlertTriangle size={12} /> 오류 {errorCount}
                </span>
              )}
              {warnCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#FEF3C7] text-[#92400E]">
                  <AlertTriangle size={12} /> 경고 {warnCount}
                </span>
              )}
              {incomplete && (
                <span className="text-[#9ca3af]">
                  요청 {expectedCount}개 중 {draft.items.length}개 생성됨 —{' '}
                  {mockSpec ? '영역에서 재생성 가능' : '피드백으로 재생성 가능'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 승인 완료 배너 */}
        {isApproved && (
          <div className="flex items-center gap-2 bg-[#ECFDF5] border border-[#a7f3d0] rounded-[12px] px-4 py-3 text-[13px] text-[#065f46]">
            <CheckCircle2 size={16} /> 승인 완료 — 문항이 문항은행에 적재되었습니다.
          </div>
        )}

        {/* 문항 */}
        {draft.items.length === 0 ? (
          <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-10 text-center text-[13px] text-[#9ca3af]">
            생성된 문항이 없습니다. 아래 피드백으로 재생성해보세요.
          </div>
        ) : mockSpec ? (
          <div className="space-y-3">
            {groupBySection(draft.items).map(({ section, items }) => (
              <div key={section} className="space-y-3">
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[13px] font-semibold text-[#1a2535]">
                    [{section + 1}] {mockSpec.sections[section]?.label || `영역 ${section + 1}`}
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">{items.length}문항</span>
                </div>
                {items.map(({ item, gi }) => (
                  <ItemCard key={item.id} item={item} index={gi} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {draft.items.map((item, i) => (
              <ItemCard key={item.id} item={item} index={i} />
            ))}
          </div>
        )}

        {/* 피드백 · 승인 (미승인 상태만) */}
        {!isApproved && (
          <>
            {!mockSpec && (
            <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={15} className="text-[#4fc3a1]" />
                <span className="text-[13px] font-medium text-[#111827]">AI에게 수정 요청 (피드백 재생성)</span>
              </div>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="예: 3번 정답이 애매합니다. 보기를 명확히 구분되게 다시 만들어주세요. 난이도를 조금 높여주세요."
                rows={3}
                disabled={busy}
                className="w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px] resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-[#9ca3af]">피드백을 반영해 문항 전체를 다시 생성합니다.</span>
                <Button variant="default" size="md" onClick={submitFeedback} disabled={busy}>
                  <Send size={14} /> {busy ? '처리 중…' : '재생성'}
                </Button>
              </div>
            </div>
            )}

            {draft.items.length > 0 && (
              <div className="flex items-center justify-between bg-white border border-[#e2e8f0] rounded-[12px] p-4">
                <div className="text-[12px] text-[#6b7280]">
                  {errorCount > 0
                    ? `미해결 오류 ${errorCount}건 — 승인 시 확인을 거칩니다.`
                    : '검토가 끝났으면 승인해 문항은행에 적재하세요.'}
                </div>
                <Button variant="primary" size="lg" onClick={() => approve(false)} disabled={busy}>
                  <CheckCircle2 size={15} /> 승인 및 적재
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
