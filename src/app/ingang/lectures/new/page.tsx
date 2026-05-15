'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VideoUpload } from '@/components/ingang/VideoUpload';

type SeriesItem = { id: string; title: string; _count: { lectures: number } };

const SUBJECTS = ['수학', '영어', '국어', '과학'];
const LEVELS   = ['기초', '심화', '최상위'];
const GRADES   = ['초1', '초2', '초3', '초4', '초5', '초6'];
const TARGETS  = [
  { name: '초등수학 기초반', cnt: 6 },
  { name: '초등수학 심화반', cnt: 8 },
  { name: '영어 파닉스반',  cnt: 5 },
  { name: '중등수학 기초반', cnt: 7 },
];

// ─── 강의 등록 페이지 ──────────────────────────────────────
export default function LectureNewPage() {
  return (
    <Suspense>
      <LectureNewForm />
    </Suspense>
  );
}

function LectureNewForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [title,      setTitle]      = useState('');
  const [desc,       setDesc]       = useState('');
  const [subjects,   setSubjects]   = useState<string[]>([]);
  const [levels,     setLevels]     = useState<string[]>([]);
  const [grades,     setGrades]     = useState<string[]>([]);
  const [targets,       setTargets]       = useState<string[]>([]);
  const [teacher,       setTeacher]       = useState('');
  const [order,         setOrder]         = useState('');
  const [cfVideoId,     setCfVideoId]     = useState('');
  const [videoUrl,      setVideoUrl]      = useState('');
  const [videoMode,     setVideoMode]     = useState<'youtube' | 'cloudflare'>('youtube');
  const [saving,        setSaving]        = useState(false);
  const [seriesList,    setSeriesList]    = useState<SeriesItem[]>([]);
  const [seriesId,      setSeriesId]      = useState('');       // '' = 없음, 'new' = 신규생성
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');

  useEffect(() => {
    fetch('/api/lecture-series')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setSeriesList(data);
        const presetId = searchParams.get('seriesId');
        if (presetId) {
          const found = data.find((s: SeriesItem) => s.id === presetId);
          if (found) {
            setSeriesId(presetId);
            setEpisodeNumber(String(found._count.lectures + 1));
          }
        }
      })
      .catch(() => {});
  }, [searchParams]);

  const handleSeriesChange = (val: string) => {
    setSeriesId(val);
    setNewSeriesTitle('');
    if (val && val !== 'new') {
      const found = seriesList.find((s) => s.id === val);
      if (found) setEpisodeNumber(String(found._count.lectures + 1));
    } else {
      setEpisodeNumber('');
    }
  };

  const toggle = <T extends string>(arr: T[], val: T, set: (v: T[]) => void) => {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const save = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!title.trim()) { alert('강의명을 입력해주세요.'); return; }
    if (seriesId === 'new' && !newSeriesTitle.trim()) { alert('새 시리즈명을 입력해주세요.'); return; }
    setSaving(true);
    try {
      // 새 시리즈 생성이면 먼저 시리즈를 만들고 ID를 받아옴
      let resolvedSeriesId: string | null = seriesId || null;
      if (seriesId === 'new') {
        const sr = await fetch('/api/lecture-series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newSeriesTitle.trim() }),
        });
        if (!sr.ok) { alert('시리즈 생성에 실패했습니다.'); setSaving(false); return; }
        const created = await sr.json();
        resolvedSeriesId = created.id;
      }

      const res = await fetch('/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim(),
          teacherId: teacher || null,
          subjects,
          levels,
          targetGrades: grades,
          cfVideoId: cfVideoId || null,
          videoUrl: videoUrl || null,
          orderIndex: order ? Number(order) : 0,
          status,
          seriesId: resolvedSeriesId,
          episodeNumber: episodeNumber ? Number(episodeNumber) : null,
        }),
      });
      if (res.ok) {
        router.push('/ingang/lectures');
      } else {
        const err = await res.json();
        alert(err.error ?? '저장에 실패했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  const TagBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[12px] border transition-all"
      style={active
        ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa', fontWeight: 600 }
        : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">강의 등록</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => router.push('/ingang/lectures')}
            className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50"
          >취소</button>
          <button
            onClick={() => save('PUBLISHED')}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white disabled:opacity-60"
            style={{ background: '#5B4FBE' }}
          >게시하기</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex gap-4 items-start">
        {/* Left */}
        <div className="flex-1 flex flex-col gap-3.5">
          {/* 기본 정보 */}
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">기본 정보</div>
            <div className="px-4 py-3.5 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#6b7280]">강의명</label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 초등수학 기초 3강 — 곱셈의 기초"
                  className="text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] text-[#374151] placeholder-[#c4c4c4] outline-none focus:border-[#a78bfa] focus:bg-white w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#6b7280]">강의 설명</label>
                <textarea
                  value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
                  placeholder="예: 자연수 곱셈의 원리와 계산 방법을 쉽게 배울 수 있는 강의입니다."
                  className="text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] text-[#374151] placeholder-[#c4c4c4] outline-none focus:border-[#a78bfa] focus:bg-white w-full resize-none leading-relaxed"
                />
              </div>
              {/* 시리즈 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#6b7280]">시리즈 <span className="font-normal text-[#9ca3af]">(선택)</span></label>
                <select
                  value={seriesId}
                  onChange={(e) => handleSeriesChange(e.target.value)}
                  className="text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] text-[#374151] outline-none focus:border-[#a78bfa] focus:bg-white"
                >
                  <option value="">시리즈 없음</option>
                  {seriesList.map((s) => (
                    <option key={s.id} value={s.id}>{s.title} ({s._count.lectures}강)</option>
                  ))}
                  <option value="new">+ 새 시리즈 만들기</option>
                </select>
                {seriesId === 'new' && (
                  <input
                    type="text" value={newSeriesTitle} onChange={(e) => setNewSeriesTitle(e.target.value)}
                    placeholder="예: 수학 중급"
                    autoFocus
                    className="text-[13px] px-3 py-2 border border-[#a78bfa] rounded-[8px] bg-white text-[#374151] placeholder-[#c4c4c4] outline-none"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11.5px] font-semibold text-[#6b7280]">담당 강사</label>
                  <input
                    type="text" value={teacher} onChange={(e) => setTeacher(e.target.value)}
                    placeholder="예: 박선생"
                    className="text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] text-[#374151] placeholder-[#c4c4c4] outline-none focus:border-[#a78bfa] focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11.5px] font-semibold text-[#6b7280]">
                    {seriesId ? '강 번호' : '강의 순서'}
                  </label>
                  <input
                    type="number"
                    value={seriesId ? episodeNumber : order}
                    onChange={(e) => seriesId ? setEpisodeNumber(e.target.value) : setOrder(e.target.value)}
                    placeholder="예: 1" min={1}
                    className="text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] text-[#374151] placeholder-[#c4c4c4] outline-none focus:border-[#a78bfa] focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 영상 등록 — YouTube URL / 직접 업로드 선택 */}
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
            {/* 헤더 + 탭 */}
            <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center gap-3">
              <span className="text-[13px] font-semibold text-[#1a2535]">영상 등록</span>
              <div className="flex rounded-[8px] overflow-hidden border border-[#e2e8f0] text-[12px] font-medium ml-auto">
                <button
                  onClick={() => { setVideoMode('youtube'); setCfVideoId(''); }}
                  className="px-3.5 py-1.5 transition-colors"
                  style={videoMode === 'youtube'
                    ? { background: '#5B4FBE', color: '#fff' }
                    : { background: '#fff', color: '#6b7280' }}
                >
                  YouTube URL
                </button>
                <button
                  onClick={() => { setVideoMode('cloudflare'); setVideoUrl(''); }}
                  className="px-3.5 py-1.5 border-l border-[#e2e8f0] transition-colors"
                  style={videoMode === 'cloudflare'
                    ? { background: '#5B4FBE', color: '#fff' }
                    : { background: '#fff', color: '#6b7280' }}
                >
                  직접 업로드
                </button>
              </div>
            </div>

            {/* YouTube URL 패널 */}
            {videoMode === 'youtube' && (
              <div className="px-4 py-3.5 flex flex-col gap-2">
                <p className="text-[11.5px] text-[#6b7280]">
                  YouTube 영상 페이지에서 <strong>공유 → 퍼가기</strong>를 클릭하면 Embed URL을 확인할 수 있습니다.
                </p>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/embed/VIDEO_ID"
                  className="text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] text-[#374151] placeholder-[#c4c4c4] outline-none focus:border-[#a78bfa] focus:bg-white w-full"
                />
              </div>
            )}

            {/* 직접 업로드 (Cloudflare Stream) 패널 */}
            {videoMode === 'cloudflare' && (
              <div className="px-4 py-3.5">
                <VideoUpload onComplete={(uid, name) => { setCfVideoId(uid); console.log('Video UID:', uid, name); }} />
              </div>
            )}
          </div>

          {/* 분류 및 태그 */}
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">분류 및 태그</div>
            <div className="px-4 py-3.5 flex flex-col gap-3">
              <div>
                <p className="text-[11.5px] font-semibold text-[#6b7280] mb-2">과목</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECTS.map((s) => <TagBtn key={s} label={s} active={subjects.includes(s)} onClick={() => toggle(subjects, s, setSubjects)} />)}
                </div>
              </div>
              <div>
                <p className="text-[11.5px] font-semibold text-[#6b7280] mb-2">레벨</p>
                <div className="flex flex-wrap gap-1.5">
                  {LEVELS.map((l) => <TagBtn key={l} label={l} active={levels.includes(l)} onClick={() => toggle(levels, l, setLevels)} />)}
                </div>
              </div>
              <div>
                <p className="text-[11.5px] font-semibold text-[#6b7280] mb-2">대상 학년</p>
                <div className="flex flex-wrap gap-1.5">
                  {GRADES.map((g) => <TagBtn key={g} label={g} active={grades.includes(g)} onClick={() => toggle(grades, g, setGrades)} />)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: 미리보기 + 수강 대상 + 저장 */}
        <div className="w-[280px] shrink-0 flex flex-col gap-3.5 sticky top-0">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-[#6b7280]">미리보기</p>
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
            <div className="h-[140px] flex items-center justify-center relative" style={{ background: '#1e1b2e' }}>
              {cfVideoId ? (
                <iframe
                  src={`https://iframe.videodelivery.net/${cfVideoId}`}
                  className="w-full h-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : videoUrl ? (
                <iframe
                  src={videoUrl}
                  className="w-full h-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.25)', border: '2px solid rgba(167,139,250,0.5)' }}>
                  <span style={{ borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '16px solid #a78bfa', marginLeft: 3, display: 'inline-block' }} />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-[13px] font-semibold text-[#111827] mb-1.5">{title || '강의명'}</p>
              <p className="text-[11.5px] text-[#9ca3af]">
                {[...subjects, ...levels, ...grades].join(' · ') || '과목 · 레벨 · 학년'}
              </p>
            </div>
          </div>

          {/* 수강 대상 */}
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] p-3.5">
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-[#6b7280] mb-2.5">수강 대상</p>
            {TARGETS.map((t) => (
              <div
                key={t.name}
                onClick={() => toggle(targets, t.name, setTargets)}
                className="flex items-center gap-2 py-1.5 border-b border-[#f1f5f9] last:border-none text-[12.5px] cursor-pointer"
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0"
                  style={targets.includes(t.name)
                    ? { background: '#a78bfa', border: '1.5px solid #a78bfa', color: '#fff' }
                    : { border: '1.5px solid #e2e8f0' }}
                >
                  {targets.includes(t.name) ? '✓' : ''}
                </div>
                {t.name} ({t.cnt}명)
              </div>
            ))}
          </div>

          {/* 저장 버튼 */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => save('DRAFT')}
              disabled={saving}
              className="w-full py-2 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50 disabled:opacity-60"
            >임시저장</button>
            <button
              onClick={() => save('PUBLISHED')}
              disabled={saving}
              className="w-full py-2 rounded-[8px] text-[12.5px] font-medium text-white disabled:opacity-60"
              style={{ background: '#5B4FBE' }}
            >게시하기</button>
          </div>
        </div>
      </div>
    </div>
  );
}
