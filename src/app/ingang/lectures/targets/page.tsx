'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type TabId = 'target' | 'cond' | 'retry';

type Lecture = {
  id: string;
  title: string;
  subjects: string[];
  levels: string[];
  status: 'DRAFT' | 'PUBLISHED';
};

const CLASSES = [
  { name: '초등수학 기초반', cnt: 6 },
  { name: '초등수학 심화반', cnt: 8 },
  { name: '영어 파닉스반',  cnt: 5 },
  { name: '중등수학 기초반', cnt: 7 },
  { name: '영어 회화반',    cnt: 4 },
];

const RETRY_PENDING = [
  { student: '박준서', lecture: '초등수학 기초 1강', tries: '3/3회', best: '58점' },
  { student: '정민재', lecture: '영어 파닉스 1강',  tries: '3/3회', best: '62점' },
];
const RETRY_HISTORY = [
  { student: '김도윤', lecture: '초등수학 기초 1강', date: '04.05', by: '박선생', result: '합격 (78점)', ok: true },
  { student: '강서윤', lecture: '영어 파닉스 2강',  date: '04.03', by: '이선생', result: '미응시',       ok: false },
];

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

function TabContent({ tab, selectedLec }: { tab: TabId; selectedLec: Lecture | null }) {
  const [targetType,   setTargetType]   = useState<'class' | 'individual' | 'all'>('class');
  const [checkedClass, setCheckedClass] = useState<string[]>([]);
  const [passScore,    setPassScore]    = useState(70);
  const [maxTries,     setMaxTries]     = useState(3);
  const [examCond,     setExamCond]     = useState<'after100' | 'anytime'>('after100');

  if (!selectedLec) {
    return <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">강의를 선택해주세요</div>;
  }

  if (tab === 'target') {
    return (
      <div className="flex-1 flex flex-col gap-3">
        <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">
            {selectedLec.title} — 수강 대상
          </div>
          <div className="flex gap-2 px-4 py-3 border-b border-[#f1f5f9]">
            {(['class','individual','all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTargetType(t)}
                className="px-4 py-1.5 rounded-[8px] text-[12.5px] font-medium border-[1.5px] transition-all"
                style={targetType === t
                  ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' }
                  : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}
              >
                {t === 'class' ? '반 단위 지정' : t === 'individual' ? '개별 학생 지정' : '전체 공개'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 p-4">
            {CLASSES.map((c) => {
              const checked = checkedClass.includes(c.name);
              return (
                <div
                  key={c.name}
                  onClick={() => setCheckedClass(checked ? checkedClass.filter((x) => x !== c.name) : [...checkedClass, c.name])}
                  className="flex items-center gap-2 px-3 py-2.5 border-[1.5px] rounded-[8px] cursor-pointer"
                  style={checked ? { background: '#EEEDFE', borderColor: '#a78bfa' } : { borderColor: '#e2e8f0' }}
                >
                  <div className="w-4.5 h-4.5 rounded flex items-center justify-center text-[10px] shrink-0"
                    style={checked ? { background: '#a78bfa', border: '1.5px solid #a78bfa', color: '#fff', width: 17, height: 17 } : { border: '1.5px solid #e2e8f0', width: 17, height: 17 }}>
                    {checked ? '✓' : ''}
                  </div>
                  <div>
                    <p className="text-[12.5px] font-semibold" style={checked ? { color: '#534AB7' } : { color: '#111827' }}>{c.name}</p>
                    <p className="text-[10.5px] text-[#9ca3af]">{c.cnt}명</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#6b7280] leading-7">
          현재 수강 대상: <strong style={{ color: '#534AB7' }}>{checkedClass.length > 0 ? checkedClass.join(', ') : '미지정'}</strong>
          {checkedClass.length > 0 && (
            <> — 총 {CLASSES.filter((c) => checkedClass.includes(c.name)).reduce((a, c) => a + c.cnt, 0)}명</>
          )}
          <br />
          대상 변경 시 즉시 적용되며, 새로 추가된 학생에게는 강의가 표시됩니다.
        </div>
      </div>
    );
  }

  if (tab === 'cond') {
    return (
      <div className="flex-1 flex flex-col gap-3">
        <div className="bg-white border border-[#e2e8f0] rounded-[10px] p-4">
          <p className="text-[13px] font-semibold text-[#1a2535] mb-4">{selectedLec.title} — 이수 조건</p>
          <div className="flex items-center gap-3 mb-3.5 text-[13px] text-[#374151]">
            시험 합격 기준:
            <input type="number" value={passScore} onChange={(e) => setPassScore(+e.target.value)}
              className="w-20 text-[14px] font-semibold text-center px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa]" />
            점 이상
          </div>
          <div className="flex items-center gap-3 mb-3.5 text-[13px] text-[#374151]">
            최대 응시 횟수:
            <input type="number" value={maxTries} onChange={(e) => setMaxTries(+e.target.value)}
              className="w-20 text-[14px] font-semibold text-center px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa]" />
            회
          </div>
          <div className="flex flex-col gap-2 mb-4">
            <span className="text-[13px] text-[#374151]">시험 응시 조건:</span>
            <div className="flex gap-2">
              {(['after100','anytime'] as const).map((c) => (
                <button key={c} onClick={() => setExamCond(c)}
                  className="text-[12px] px-3 py-1.5 rounded-[8px] border-[1.5px] font-medium"
                  style={examCond === c ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' } : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}>
                  {c === 'after100' ? '영상 100% 시청 후 응시 가능' : '바로 응시 가능'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[12px] text-[#9ca3af] bg-[#f9fafb] rounded-[8px] px-3 py-2.5 leading-relaxed">
            합격 기준 {passScore}점 이상, 최대 {maxTries}회 응시 가능합니다. {maxTries}회 모두 불합격 시 원장/강사의 재응시 허용이 필요합니다.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50">초기화</button>
          <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white" style={{ background: '#5B4FBE' }}>저장</button>
        </div>
      </div>
    );
  }

  // retry tab
  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535] flex items-center justify-between">
          재응시 요청 목록
          <span className="text-[12px] font-normal text-[#9ca3af]">최대 응시 횟수 초과 학생</span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['학생명','강의명','응시 횟수','최고 점수','상태','관리'].map((h) => (
                <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RETRY_PENDING.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#111827] border-b border-[#f1f5f9]">{r.student}</td>
                <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.lecture}</td>
                <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#991b1b] border-b border-[#f1f5f9]">{r.tries}</td>
                <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#991b1b] border-b border-[#f1f5f9]">{r.best}</td>
                <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#FEE2E2', color: '#991b1b' }}>초과</span></td>
                <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                  <button className="px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium text-white" style={{ background: '#5B4FBE' }}>재응시 1회 허용</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">재응시 허용 이력</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['학생명','강의명','허용 일시','허용자','결과'].map((h) => (
                <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RETRY_HISTORY.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#111827] border-b border-[#f1f5f9]">{r.student}</td>
                <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.lecture}</td>
                <td className="py-2.5 px-3.5 text-[11.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.date}</td>
                <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.by}</td>
                <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={r.ok ? { background: '#D1FAE5', color: '#065f46' } : { background: '#f1f5f9', color: '#6b7280' }}>
                    {r.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const tabParam     = searchParams.get('tab') as TabId | null;

  const [tab,      setTab]      = useState<TabId>(tabParam ?? 'target');
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading,  setLoading]  = useState(true);
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
    if (tabParam) setTab(tabParam);
  }, [tabParam]);

  const tabMeta: Record<TabId, { title: string; badge: string }> = {
    target: { title: '수강 대상 지정', badge: '인강 · 강의 관리' },
    cond:   { title: '이수 조건 설정', badge: '인강 · 시험 관리' },
    retry:  { title: '재응시 관리',    badge: '인강 · 시험 관리' },
  };

  const selectedLec = lectures.find((l) => l.id === selectedId) ?? null;

  const handleTab = (t: TabId) => {
    setTab(t);
    if (t === 'target') router.replace('/ingang/lectures/targets');
    else router.replace(`/ingang/lectures/targets?tab=${t}`);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">{tabMeta[tab].title}</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>{tabMeta[tab].badge}</span>
        <div className="ml-auto">
          <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white" style={{ background: '#5B4FBE' }}>저장</button>
        </div>
      </div>

      {/* Page tabs */}
      <div className="bg-white border-b border-[#e2e8f0] flex px-5 shrink-0">
        {(['target','cond','retry'] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTab(t)}
            className="py-2.5 px-4 text-[13px] border-b-2 transition-colors -mb-px"
            style={tab === t
              ? { color: '#a78bfa', borderColor: '#a78bfa', fontWeight: 600 }
              : { color: '#6b7280', borderColor: 'transparent' }}
          >
            {t === 'target' ? '수강 대상 지정' : t === 'cond' ? '이수 조건 설정' : '재응시 관리'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex gap-4">
        {tab !== 'retry' && (
          <LecturePanel
            lectures={lectures}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            condMode={tab === 'cond'}
          />
        )}
        <TabContent tab={tab} selectedLec={selectedLec} />
      </div>
    </div>
  );
}

export default function TargetsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#9ca3af]">로딩 중...</div>}>
      <PageContent />
    </Suspense>
  );
}
