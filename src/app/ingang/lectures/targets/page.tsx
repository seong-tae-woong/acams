'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { type TabId, type Lecture, TABS } from './_shared';
import { TagsContent } from './_tabs/TagsContent';
import { SeriesContent } from './_tabs/SeriesContent';
import { TargetContent } from './_tabs/TargetContent';
import { CondContent } from './_tabs/CondContent';
import { ExamContent } from './_tabs/ExamContent';
import { RetryContent } from './_tabs/RetryContent';

// ─── LecturePanel — 이수 조건 탭 좌측 강의 선택 패널 ──────────
function LecturePanel({ lectures, loading, selectedId, onSelect, condMode }: {
  lectures: Lecture[];
  loading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  condMode: boolean;
}) {
  return (
    <div className="w-[240px] shrink-0 bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex flex-col">
      <div className="px-3.5 py-2.5 border-b border-[#f1f5f9] text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">강의 선택</div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-[12px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
        ) : lectures.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af] text-center py-6">등록된 강의가 없습니다</p>
        ) : (
          lectures.map((l) => {
            const meta = [...l.subjects, ...l.levels].join(' · ') || '—';
            return (
              <div
                key={l.id}
                onClick={() => onSelect(l.id)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#f1f5f9] cursor-pointer hover:bg-gray-50 last:border-none"
                style={selectedId === l.id ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 11 } : {}}
              >
                <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                  <span style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '9px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-[#111827] truncate">{l.title}</p>
                  <p className="text-[10.5px] text-[#9ca3af]">{condMode ? '이수 조건 미설정' : meta}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
function PageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const tabParam     = searchParams.get('tab') as TabId | null;

  const [tab,        setTab]        = useState<TabId>(tabParam ?? 'tags');
  const [lectures,   setLectures]   = useState<Lecture[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    fetch('/api/lectures')
      .then((r) => r.json())
      .then((data: Lecture[]) => {
        const list = Array.isArray(data) ? data : [];
        setLectures(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => setLectures([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setTab((tabParam as TabId) ?? 'tags');
  }, [tabParam]);

  const handleTab = (t: TabId) => {
    setTab(t);
    if (t === 'tags') router.replace('/ingang/lectures/targets');
    else router.replace(`/ingang/lectures/targets?tab=${t}`);
  };

  const selectedLec       = lectures.find((l) => l.id === selectedId) ?? null;
  const showLecturePanel  = tab === 'cond';
  const contentOverflow   = tab === 'exam' ? 'overflow-hidden' : 'overflow-y-auto';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">강의 세부사항</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강 · 강의 관리</span>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#e2e8f0] flex px-5 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTab(t.id)}
            className="py-2.5 px-4 text-[13px] border-b-2 transition-colors -mb-px"
            style={tab === t.id
              ? { color: '#a78bfa', borderColor: '#a78bfa', fontWeight: 600 }
              : { color: '#6b7280', borderColor: 'transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={`flex-1 ${contentOverflow} p-5 flex gap-4`}>
        {showLecturePanel && (
          <LecturePanel
            lectures={lectures}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            condMode={tab === 'cond'}
          />
        )}
        {tab === 'tags'   && <TagsContent  lectures={lectures} loading={loading} />}
        {tab === 'series' && <SeriesContent lectures={lectures} loading={loading} onLecturesChange={setLectures} />}
        {tab === 'target' && <TargetContent lectures={lectures} loading={loading} />}
        {tab === 'cond'   && <CondContent   selectedLec={selectedLec} />}
        {tab === 'exam'   && <ExamContent lectures={lectures} loading={loading} />}
        {tab === 'retry'  && <RetryContent />}
      </div>
    </div>
  );
}

export default function LectureDetailsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#9ca3af]">로딩 중...</div>}>
      <PageContent />
    </Suspense>
  );
}
