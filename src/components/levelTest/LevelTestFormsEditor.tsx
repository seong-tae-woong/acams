'use client';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/shared/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Trash2, Save, X, Printer, Upload, FileText, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { gradeLabel, GRADE_OPTIONS } from '@/lib/format/grade';

interface EType { key: string; name: string; benchmark: number }
interface FormListItem {
  id: string; grade: number; subject: string; title: string;
  pdfUrl: string | null; totalQuestions: number; showAverage: boolean;
  types: EType[]; questionMap: { n: number; typeKey: string }[];
}
interface EditorState {
  id?: string; grade: number; subject: string; title: string;
  pdfUrl: string | null; types: EType[]; total: number;
  map: Record<number, string>; showAverage: boolean;
}

// 유형 색 팔레트 (mid-ramp, 라이트/다크 무난)
const TYPE_COLORS = ['#1D9E75', '#378ADD', '#BA7517', '#D4537E', '#7F77DD'];
const colorFor = (types: EType[], key: string) => {
  const i = types.findIndex((t) => t.key === key);
  return i >= 0 ? TYPE_COLORS[i % TYPE_COLORS.length] : '#cbd5e1';
};

function blankEditor(): EditorState {
  return { grade: 1, subject: '', title: '', pdfUrl: null, types: [], total: 0, map: {}, showAverage: true };
}

// "1-10, 15" 같은 범위 문자열 → 문항 번호 배열 (1..total 범위 내, 무중복)
function parseRanges(s: string, total: number): number[] {
  const out = new Set<number>();
  for (const part of s.split(',')) {
    const t = part.trim();
    if (!t) continue;
    const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = Number(m[1]);
      let b = Number(m[2]);
      if (a > b) { const tmp = a; a = b; b = tmp; }
      for (let n = a; n <= b; n++) if (n >= 1 && n <= total) out.add(n);
    } else if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (n >= 1 && n <= total) out.add(n);
    }
  }
  return [...out];
}

export default function LevelTestFormsEditor() {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ed, setEd] = useState<EditorState | null>(null);
  const [paintKey, setPaintKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rangeInput, setRangeInput] = useState('');
  const keyCounter = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/level-test-forms')
      .then((r) => r.json())
      .then((d) => setForms(Array.isArray(d) ? d : []))
      .catch(() => toast('목록을 불러오지 못했습니다.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => { keyCounter.current = 0; setEd(blankEditor()); setPaintKey(null); };
  const openEdit = (f: FormListItem) => {
    keyCounter.current = f.types.length;
    const map: Record<number, string> = {};
    f.questionMap.forEach((q) => { map[q.n] = q.typeKey; });
    setEd({ id: f.id, grade: f.grade, subject: f.subject, title: f.title, pdfUrl: f.pdfUrl, types: f.types, total: f.questionMap.length, map, showAverage: f.showAverage });
    setPaintKey(f.types[0]?.key ?? null);
  };

  const addType = () => {
    if (!ed) return;
    const key = `t${++keyCounter.current}`;
    const next = [...ed.types, { key, name: '', benchmark: 70 }];
    setEd({ ...ed, types: next });
    if (!paintKey) setPaintKey(key);
  };
  const removeType = (key: string) => {
    if (!ed) return;
    const map = { ...ed.map };
    for (const n of Object.keys(map)) if (map[+n] === key) delete map[+n];
    setEd({ ...ed, types: ed.types.filter((t) => t.key !== key), map });
    if (paintKey === key) setPaintKey(null);
  };
  const updateType = (key: string, patch: Partial<EType>) => {
    if (!ed) return;
    setEd({ ...ed, types: ed.types.map((t) => (t.key === key ? { ...t, ...patch } : t)) });
  };

  const paint = (n: number) => {
    if (!ed || !paintKey) return;
    const map = { ...ed.map };
    if (map[n] === paintKey) delete map[n]; // 같은 유형 다시 탭 → 해제
    else map[n] = paintKey;
    setEd({ ...ed, map });
  };

  const uploadPdf = async (file: File) => {
    if (!ed) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/level-test-forms/pdf', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setEd({ ...ed, pdfUrl: d.url });
      toast('PDF를 업로드했습니다.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '업로드 실패', 'error');
    } finally {
      setUploading(false);
    }
  };

  // 선택한 유형(paintKey)에 범위 문자열을 적용해 해당 번호들을 칠한다 (탭과 병행)
  const applyRange = () => {
    if (!ed) return;
    if (!paintKey) return toast('먼저 유형을 선택하세요.', 'error');
    if (ed.total < 1) return toast('총 문항수를 먼저 입력하세요.', 'error');
    const nums = parseRanges(rangeInput, ed.total);
    if (nums.length === 0) return toast('범위를 인식하지 못했습니다. 예: 1-10, 15', 'error');
    const map = { ...ed.map };
    for (const n of nums) map[n] = paintKey;
    setEd({ ...ed, map });
    setRangeInput('');
  };

  const mappedCount = ed ? Object.keys(ed.map).length : 0;
  const unmapped = ed ? ed.total - mappedCount : 0;

  const save = async () => {
    if (!ed) return;
    if (!ed.title.trim()) return toast('양식 이름을 입력하세요.', 'error');
    if (ed.types.length === 0) return toast('유형을 최소 1개 추가하세요.', 'error');
    if (ed.types.some((t) => !t.name.trim())) return toast('유형 이름을 모두 입력하세요.', 'error');
    if (ed.total < 1) return toast('총 문항수를 입력하세요.', 'error');
    if (unmapped !== 0) return toast(`매핑되지 않은 문항이 ${unmapped}개 있습니다.`, 'error');

    const questionMap = Array.from({ length: ed.total }, (_, i) => ({ n: i + 1, typeKey: ed.map[i + 1] }));
    const body = {
      grade: ed.grade, subject: ed.subject, title: ed.title.trim(),
      pdfUrl: ed.pdfUrl, types: ed.types, questionMap, showAverage: ed.showAverage,
    };
    setSaving(true);
    try {
      const res = await fetch(ed.id ? `/api/level-test-forms/${ed.id}` : '/api/level-test-forms', {
        method: ed.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast('저장했습니다.', 'success');
      setEd(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '저장 실패', 'error');
    } finally {
      setSaving(false);
    }
  };

  const del = async (f: FormListItem) => {
    if (!confirm(`"${f.title}" 양식을 삭제할까요?`)) return;
    const res = await fetch(`/api/level-test-forms/${f.id}`, { method: 'DELETE' });
    if (res.ok) { toast('삭제했습니다.', 'success'); load(); }
    else toast('삭제 실패', 'error');
  };

  if (loading) return <div className="flex-1 grid place-items-center"><LoadingSpinner /></div>;

  // ── 목록 ──
  if (!ed) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <Link href="/level-tests" className="inline-flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#111827] mb-3">
          <ChevronLeft size={14} /> 레벨 테스트
        </Link>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-[#6b7280]">학년별로 레벨 테스트 양식을 등록해두고 재사용합니다.</span>
          <Button variant="primary" size="sm" onClick={openNew}><Plus size={14} /> 새 양식</Button>
        </div>
        {forms.length === 0 ? (
          <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-10 text-center text-[13px] text-[#9ca3af]">
            아직 양식이 없습니다. 첫 양식을 만들어보세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {forms.map((f) => (
              <div key={f.id} className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[14px] font-medium text-[#111827]">{f.title}</div>
                    <div className="text-[12px] text-[#6b7280] mt-0.5 tabular-nums">
                      {gradeLabel(f.grade)} · {f.subject || '과목 미지정'} · {f.totalQuestions}문항 · 유형 {f.types.length}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {f.pdfUrl && (
                      <button onClick={() => window.open(f.pdfUrl!, '_blank')} className="px-2 py-1 text-[12px] text-[#0F6E56] border border-[#cfeee2] bg-[#f0faf6] rounded-[6px] flex items-center gap-1" title="시험지 PDF 보기·출력">
                        <FileText size={13} /> 시험지
                      </button>
                    )}
                    <button onClick={() => openEdit(f)} className="px-2 py-1 text-[12px] text-[#374151] border border-[#e2e8f0] rounded-[6px]">수정</button>
                    <button onClick={() => del(f)} className="p-1.5 text-[#9ca3af] hover:text-red-500" title="삭제"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── 에디터 ──
  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[15px] font-medium text-[#111827]">{ed.id ? '양식 수정' : '새 레벨 테스트 양식'}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEd(null)}><X size={14} /> 취소</Button>
          <Button variant="primary" size="sm" onClick={save} disabled={saving}><Save size={14} /> {saving ? '저장 중…' : '저장'}</Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* 기본 정보 */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4 grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[12px] text-[#6b7280]">양식 이름</span>
            <input value={ed.title} onChange={(e) => setEd({ ...ed, title: e.target.value })} placeholder="예: 중2 영어 레벨 테스트"
              className="mt-1 w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px]" />
          </label>
          <label className="block">
            <span className="text-[12px] text-[#6b7280]">학년</span>
            <select value={ed.grade} onChange={(e) => setEd({ ...ed, grade: Number(e.target.value) })}
              className="mt-1 w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px] bg-white">
              {GRADE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] text-[#6b7280]">과목</span>
            <input value={ed.subject} onChange={(e) => setEd({ ...ed, subject: e.target.value })} placeholder="영어"
              className="mt-1 w-full border border-[#e2e8f0] rounded-[8px] px-2.5 py-2 text-[13px]" />
          </label>
        </div>

        {/* PDF */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
          <span className="text-[12px] text-[#6b7280]">시험지 PDF</span>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ''; }} />
          {ed.pdfUrl ? (
            <div className="mt-2 flex items-center gap-2 bg-[#f4f6f8] rounded-[8px] px-3 py-2">
              <FileText size={18} className="text-[#12B886]" />
              <span className="text-[13px] text-[#111827] flex-1 truncate">시험지.pdf</span>
              <button onClick={() => window.open(ed.pdfUrl!, '_blank')} className="text-[12px] text-[#374151] border border-[#e2e8f0] bg-white rounded-[6px] px-2 py-1 flex items-center gap-1"><Printer size={13} /> 출력</button>
              <button onClick={() => fileRef.current?.click()} className="text-[12px] text-[#6b7280]">교체</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="mt-2 w-full border border-dashed border-[#cbd5e1] rounded-[8px] py-3 text-[13px] text-[#6b7280] flex items-center justify-center gap-2">
              <Upload size={15} /> {uploading ? '업로드 중…' : 'PDF 업로드'}
            </button>
          )}
        </div>

        {/* 유형 */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[#6b7280]">유형 · 기준점수(0~100)</span>
            <button onClick={addType} className="text-[12px] text-[#12B886] flex items-center gap-1"><Plus size={14} /> 유형 추가</button>
          </div>
          <div className="space-y-2">
            {ed.types.map((t) => (
              <div key={t.key} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorFor(ed.types, t.key) }} />
                <input value={t.name} onChange={(e) => updateType(t.key, { name: e.target.value })} placeholder="예: 어휘"
                  aria-label="유형 이름"
                  className="flex-1 border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 text-[13px]" />
                <input type="number" min={0} max={100} value={t.benchmark} onChange={(e) => updateType(t.key, { benchmark: Number(e.target.value) })}
                  className="w-20 border border-[#e2e8f0] rounded-[8px] px-2 py-1.5 text-[13px] text-center tabular-nums" />
                <button onClick={() => removeType(t.key)} className="p-1.5 text-[#9ca3af] hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
            {ed.types.length === 0 && <div className="text-[12px] text-[#9ca3af] py-2">유형을 추가하세요 (예: 어휘, 문법, 독해).</div>}
          </div>
        </div>

        {/* 문항 매핑 */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[#6b7280]">문항 매핑 — 유형 고르고 범위 입력 또는 번호 탭</span>
            <label className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
              총 문항수
              <input type="number" min={0} max={200} value={ed.total}
                onChange={(e) => setEd({ ...ed, total: Math.max(0, Math.min(200, Number(e.target.value))) })}
                className="w-16 border border-[#e2e8f0] rounded-[8px] px-2 py-1 text-[13px] text-center tabular-nums" />
            </label>
          </div>
          {/* 유형 선택 칩 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ed.types.map((t) => (
              <button key={t.key} onClick={() => setPaintKey(t.key)}
                className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] border',
                  paintKey === t.key ? 'border-[#1a2535] bg-[#f4f6f8] text-[#111827]' : 'border-[#e2e8f0] text-[#6b7280]')}>
                <span className="w-2 h-2 rounded-full" style={{ background: colorFor(ed.types, t.key) }} />
                {t.name || '이름 없음'}
              </button>
            ))}
          </div>
          {/* 선택 유형에 범위 입력 (예: 1-10, 15) — 번호 탭과 병행 */}
          {paintKey && ed.total > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-[#6b7280] shrink-0">선택 유형 범위</span>
              <input value={rangeInput} onChange={(e) => setRangeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyRange(); } }}
                placeholder="예: 1-10, 15"
                className="flex-1 border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 text-[13px]" />
              <button onClick={applyRange} className="text-[12px] text-[#12B886] border border-[#e2e8f0] rounded-[8px] px-3 py-1.5 shrink-0">적용</button>
            </div>
          )}
          {/* 격자 */}
          {ed.total > 0 && (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}>
              {Array.from({ length: ed.total }, (_, i) => i + 1).map((n) => {
                const key = ed.map[n];
                return (
                  <button key={n} onClick={() => paint(n)}
                    className="relative h-9 rounded-[6px] border text-[12px] tabular-nums flex items-center justify-center"
                    style={key
                      ? { borderColor: colorFor(ed.types, key), color: '#111827', background: `${colorFor(ed.types, key)}1a` }
                      : { borderColor: '#e2e8f0', color: '#9ca3af' }}>
                    {n}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-2 text-[12px] tabular-nums" style={{ color: unmapped === 0 ? '#0F6E56' : '#854F0B' }}>
            매핑 {mappedCount}/{ed.total}{unmapped !== 0 ? ` · 미매핑 ${unmapped}개` : ' · 완료'}
          </div>
        </div>

        {/* 평균 표시 토글 */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4 flex items-center justify-between">
          <div>
            <div className="text-[13px] text-[#111827]">리포트에 학년 평균 표시</div>
            <div className="text-[11px] text-[#6b7280] mt-0.5">끄면 학부모에게 우리 아이 점수만 보입니다</div>
          </div>
          <button onClick={() => setEd({ ...ed, showAverage: !ed.showAverage })}
            className="w-[42px] h-6 rounded-full relative transition-colors shrink-0"
            style={{ background: ed.showAverage ? '#12B886' : '#cbd5e1' }}>
            <span className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all" style={{ left: ed.showAverage ? 21 : 3 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
