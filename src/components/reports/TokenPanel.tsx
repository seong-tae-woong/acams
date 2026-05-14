'use client';
import { getTokenGroups } from '@/lib/reports/tokens';

interface Props {
  onInsert: (token: string) => void;
  variant?: 'sidebar' | 'inline'; // sidebar: 우측 고정 패널 / inline: 모달 내부
  kind?: 'PER_EXAM' | 'PERIODIC';  // 기본 PER_EXAM
}

export default function TokenPanel({ onInsert, variant = 'sidebar', kind = 'PER_EXAM' }: Props) {
  const groups = getTokenGroups(kind);
  if (variant === 'inline') {
    return (
      <div className="bg-[#f9fafb] border border-[#e2e8f0] rounded-[8px] p-2.5 space-y-2">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-1">
              {group.tokens.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => onInsert(t.token)}
                  title={t.description}
                  className="px-1.5 py-0.5 bg-white border border-[#e2e8f0] rounded-[4px] text-[10.5px] text-[#374151] hover:border-[#4fc3a1] hover:text-[#0D9E7A] cursor-pointer"
                >
                  {`{{${t.token}}}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-[#e2e8f0]">
        <div className="text-[12px] font-semibold text-[#111827]">토큰 삽입</div>
        <div className="text-[10.5px] text-[#9ca3af] mt-0.5">클릭 시 커서 위치에 삽입</div>
      </div>
      {groups.map((group) => (
        <div key={group.label} className="px-3 py-2.5 border-b border-[#f1f5f9]">
          <div className="text-[10.5px] font-semibold text-[#6b7280] uppercase tracking-wide mb-2">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.tokens.map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => onInsert(t.token)}
                title={t.description}
                className="px-2 py-1 bg-white border border-[#e2e8f0] rounded-[6px] text-[11px] text-[#374151] hover:border-[#4fc3a1] hover:text-[#0D9E7A] cursor-pointer"
              >
                {`{{${t.token}}}`}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// 공용 헬퍼: textarea 커서 위치에 토큰 삽입
export function insertTokenAtCursor(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  body: string,
  setBody: (v: string) => void,
  token: string,
) {
  const ta = textareaRef.current;
  if (!ta) {
    setBody(body + `{{${token}}}`);
    return;
  }
  const start = ta.selectionStart ?? body.length;
  const end = ta.selectionEnd ?? body.length;
  const inserted = `{{${token}}}`;
  const next = body.slice(0, start) + inserted + body.slice(end);
  setBody(next);
  queueMicrotask(() => {
    ta.focus();
    const pos = start + inserted.length;
    ta.setSelectionRange(pos, pos);
  });
}
