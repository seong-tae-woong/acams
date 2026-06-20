'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/shared/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from '@/lib/stores/toastStore';
import { Search, Send, ChevronRight } from 'lucide-react';
import { gradeLabel } from '@/lib/format/grade';
import LevelTestReportPreviewModal from './LevelTestReportPreviewModal';
import type { LevelTestReportData } from '@/lib/levelTest/types';

interface Student { id: string; name: string; grade: number }
interface FormItem { id: string; title: string; grade: number; totalQuestions: number }
interface GradeType { key: string; name: string }
interface GradeData {
  examId: string;
  studentName: string;
  types: GradeType[];
  questionMap: { n: number; typeKey: string }[];
  wrongNumbers: number[];
}

const TYPE_COLORS = ['#1D9E75', '#378ADD', '#BA7517', '#D4537E', '#7F77DD'];
const colorFor = (types: GradeType[], key: string) => {
  const i = types.findIndex((t) => t.key === key);
  return i >= 0 ? TYPE_COLORS[i % TYPE_COLORS.length] : '#cbd5e1';
};

export default function LevelTestRunner() {
  const [mode, setMode] = useState<'select' | 'grade'>('select');
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [selStudent, setSelStudent] = useState<Student | null>(null);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [selFormId, setSelFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [gd, setGd] = useState<GradeData | null>(null);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<LevelTestReportData | null>(null);

  useEffect(() => {
    fetch('/api/students')
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : (d.students ?? []);
        setStudents(list.map((s: Student) => ({ id: s.id, name: s.name, grade: s.grade })));
      })
      .catch(() => toast('학생 목록을 불러오지 못했습니다.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const pickStudent = (s: Student) => {
    setSelStudent(s);
    setSelFormId(null);
    fetch(`/api/level-test-forms?grade=${s.grade}`)
      .then((r) => r.json())
      .then((d) => setForms(Array.isArray(d) ? d : []))
      .catch(() => toast('양식을 불러오지 못했습니다.', 'error'));
  };

  const start = async () => {
    if (!selStudent || !selFormId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/level-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selStudent.id, formId: selFormId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const gres = await fetch(`/api/level-tests/${d.examId}`);
      const gdata = await gres.json();
      if (!gres.ok) throw new Error(gdata.error);
      setGd(gdata);
      setWrong(new Set(gdata.wrongNumbers ?? []));
      setMode('grade');
    } catch (e) {
      toast(e instanceof Error ? e.message : '시작 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (n: number) => {
    setWrong((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  const tally = useMemo(() => {
    if (!gd) return { byType: [] as { name: string; correct: number; total: number }[], correct: 0, total: 0 };
    const map = new Map<string, { total: number; correct: number }>();
    for (const t of gd.types) map.set(t.key, { total: 0, correct: 0 });
    for (const q of gd.questionMap) {
      const a = map.get(q.typeKey);
      if (!a) continue;
      a.total += 1;
      if (!wrong.has(q.n)) a.correct += 1;
    }
    const byType = gd.types.map((t) => ({ name: t.name, ...(map.get(t.key) ?? { total: 0, correct: 0 }) }));
    const total = gd.questionMap.length;
    return { byType, correct: total - wrong.size, total };
  }, [gd, wrong]);

  // 채점 저장 → 미리보기 데이터 로드 → 미리보기 모달 (발행은 모달에서)
  const openPreview = async () => {
    if (!gd) return;
    setBusy(true);
    try {
      const g = await fetch(`/api/level-tests/${gd.examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wrongNumbers: [...wrong] }),
      });
      const gd2 = await g.json();
      if (!g.ok) throw new Error(gd2.error);
      const pr = await fetch(`/api/level-tests/${gd.examId}/report`);
      const pd = await pr.json();
      if (!pr.ok) throw new Error(pd.error);
      setPreviewData(pd.data);
      setPreviewOpen(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : '미리보기 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePublished = () => {
    setPreviewOpen(false);
    setPreviewData(null);
    setMode('select'); setGd(null); setSelStudent(null); setSelFormId(null); setForms([]); setWrong(new Set());
  };

  if (loading) return <div className="flex-1 grid place-items-center"><LoadingSpinner /></div>;

  // ── 채점 ──
  if (mode === 'grade' && gd) {
    const score = gd.questionMap.length > 0 ? Math.round((tally.correct / tally.total) * 100) : 0;
    return (
      <div className="flex-1 overflow-y-auto p-5 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[15px] font-medium text-[#111827]">채점 · {gd.studentName}</span>
          <Button variant="ghost" size="sm" onClick={() => { setMode('select'); setGd(null); }}>목록</Button>
        </div>
        <p className="text-[13px] text-[#374151] mb-3">틀린 문항만 탭하세요. <span className="text-[#6b7280]">나머지는 자동 정답입니다.</span></p>

        <div className="flex flex-wrap gap-3 mb-3 text-[11px] text-[#6b7280]">
          {gd.types.map((t) => (
            <span key={t.key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: colorFor(gd.types, t.key) }} />{t.name}
            </span>
          ))}
        </div>

        <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          {gd.questionMap.map((q) => {
            const isWrong = wrong.has(q.n);
            return (
              <button key={q.n} onClick={() => toggle(q.n)}
                className="relative h-11 rounded-[8px] border text-[14px] tabular-nums flex items-center justify-center"
                style={isWrong
                  ? { borderColor: '#F09595', background: '#FCEBEB', color: '#A32D2D', textDecoration: 'line-through' }
                  : { borderColor: '#e2e8f0', color: '#111827' }}>
                <span className="absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full" style={{ background: colorFor(gd.types, q.typeKey) }} />
                {q.n}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between bg-[#f4f6f8] rounded-[10px] px-4 py-3 mb-4">
          <span className="text-[12px] text-[#374151] tabular-nums">
            {tally.byType.map((b) => `${b.name} ${b.correct}/${b.total}`).join(' · ')}
          </span>
          <span className="text-[14px] font-medium text-[#111827] tabular-nums">종합 {tally.correct}/{tally.total} · {score}점</span>
        </div>

        <Button variant="primary" onClick={openPreview} disabled={busy} className="w-full justify-center">
          <Send size={15} /> {busy ? '여는 중…' : '리포트 미리보기'}
        </Button>

        {gd && (
          <LevelTestReportPreviewModal
            open={previewOpen}
            examId={gd.examId}
            data={previewData}
            onClose={() => setPreviewOpen(false)}
            onPublished={handlePublished}
          />
        )}
      </div>
    );
  }

  // ── 실시 (학생·양식 선택) ──
  const filtered = students.filter((s) => s.name.includes(search.trim()));
  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] text-[#6b7280]">신규생을 골라 레벨 테스트를 실시·채점합니다.</span>
        <Link href="/level-tests/forms" className="text-[12px] text-[#12B886] flex items-center gap-1">양식 관리 <ChevronRight size={13} /></Link>
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4 mb-3">
        <span className="text-[12px] text-[#6b7280]">학생</span>
        <div className="relative mt-1 mb-2">
          <Search size={14} className="absolute left-2.5 top-2.5 text-[#9ca3af]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름 검색"
            className="w-full border border-[#e2e8f0] rounded-[8px] pl-8 pr-2.5 py-2 text-[13px]" />
        </div>
        <div className="max-h-44 overflow-y-auto divide-y divide-[#f1f5f9]">
          {filtered.slice(0, 40).map((s) => (
            <button key={s.id} onClick={() => pickStudent(s)}
              className={`w-full text-left px-2 py-2 text-[13px] flex items-center justify-between rounded-[6px] ${selStudent?.id === s.id ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'hover:bg-[#f8fafc] text-[#111827]'}`}>
              <span>{s.name}</span><span className="text-[11px] text-[#9ca3af] tabular-nums">{gradeLabel(s.grade)}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="text-[12px] text-[#9ca3af] py-3 text-center">학생이 없습니다.</div>}
        </div>
      </div>

      {selStudent && (
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4 mb-3">
          <span className="text-[12px] text-[#6b7280]">{gradeLabel(selStudent.grade)} 양식</span>
          {forms.length === 0 ? (
            <div className="text-[12px] text-[#9ca3af] py-3">
              이 학년의 양식이 없습니다. <Link href="/level-tests/forms" className="text-[#12B886]">양식 먼저 만들기</Link>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {forms.map((f) => (
                <button key={f.id} onClick={() => setSelFormId(f.id)}
                  className={`w-full text-left px-3 py-2 rounded-[8px] border text-[13px] flex items-center justify-between ${selFormId === f.id ? 'border-[#12B886] bg-[#E1F5EE]' : 'border-[#e2e8f0]'}`}>
                  <span className="text-[#111827]">{f.title}</span>
                  <span className="text-[11px] text-[#9ca3af] tabular-nums">{gradeLabel(f.grade)} · {f.totalQuestions}문항</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Button variant="primary" onClick={start} disabled={!selStudent || !selFormId || busy} className="w-full justify-center">
        {busy ? '여는 중…' : '채점 시작'}
      </Button>
    </div>
  );
}
