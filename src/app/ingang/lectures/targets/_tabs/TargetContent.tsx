'use client';
import { useState, useEffect, useMemo } from 'react';
import { type Lecture, type Series, gradeLabel, episodesOf } from '../_shared';

// ─── Tab: 수강 대상 지정 ──────────────────────────────────────
type TargetStudent = { id: string; name: string; grade: number; classIds: string[] };
type TargetClass   = { id: string; name: string; count: number };

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

// 강의 선택 트리 패널 (시리즈 ▸ 강의)
function TargetTreePanel({
  lectures, seriesList, loading, mode, onModeChange,
  selectedLecId, selectedSeriesId, onSelectLecture, onSelectSeries,
}: {
  lectures: Lecture[];
  seriesList: Series[];
  loading: boolean;
  mode: 'lecture' | 'series';
  onModeChange: (m: 'lecture' | 'series') => void;
  selectedLecId: string;
  selectedSeriesId: string;
  onSelectLecture: (id: string) => void;
  onSelectSeries: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const standalone = lectures.filter((l) => !l.seriesId);

  return (
    <div className="w-[260px] shrink-0 bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex flex-col">
      {/* 헤더 + 시리즈별/강의별 모드 토글 */}
      <div className="px-3 py-2.5 border-b border-[#f1f5f9] flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">강의 선택</span>
        <div className="flex rounded-[7px] overflow-hidden border border-[#e2e8f0] text-[10.5px] font-semibold shrink-0">
          {(['series', 'lecture'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className="px-2 py-1 transition-colors"
              style={mode === m
                ? { background: '#5B4FBE', color: '#fff' }
                : { background: '#fff', color: '#6b7280' }}
            >
              {m === 'series' ? '시리즈별' : '강의별'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-[12px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
        ) : seriesList.length === 0 && lectures.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af] text-center py-6">등록된 강의가 없습니다</p>
        ) : (
          <>
            {seriesList.map((series) => {
              const eps    = episodesOf(lectures, series.id);
              const empty  = eps.length === 0;
              const isOpen = !collapsed.has(series.id);
              const seriesSelectable = mode === 'series' && !empty;
              const seriesSelected   = mode === 'series' && selectedSeriesId === series.id;
              return (
                <div key={series.id} className="border-b border-[#f1f5f9] last:border-none">
                  {/* 시리즈 헤더 */}
                  <div
                    onClick={() => { if (seriesSelectable) onSelectSeries(series.id); }}
                    className="flex items-center gap-2 px-2.5 py-2.5 transition-colors"
                    style={{
                      ...(seriesSelected ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 7 } : {}),
                      cursor: seriesSelectable ? 'pointer' : (mode === 'series' ? 'not-allowed' : 'default'),
                      opacity: mode === 'series' && empty ? 0.5 : 1,
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggle(series.id); }}
                      className="w-4 text-[10px] text-[#9ca3af] shrink-0 hover:text-[#374151]"
                    >
                      {isOpen ? '▾' : '▸'}
                    </button>
                    <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                      <span style={{ borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold truncate" style={{ color: seriesSelected ? '#534AB7' : '#111827' }}>{series.title}</p>
                      <p className="text-[10px] text-[#9ca3af]">{empty ? '강의 없음' : `시리즈 · 총 ${eps.length}강`}</p>
                    </div>
                    {seriesSelectable && (
                      <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: '#EEEDFE', color: '#534AB7' }}>시리즈</span>
                    )}
                  </div>
                  {/* 에피소드 목록 */}
                  {isOpen && (
                    <div className="bg-[#fafafa]">
                      {empty ? (
                        <p className="pl-9 pr-3 py-2 text-[11px] text-[#9ca3af] italic">비어 있는 시리즈입니다</p>
                      ) : (
                        eps.map((ep, idx) => {
                          const lecSelectable = mode === 'lecture';
                          const lecSelected   = mode === 'lecture' && selectedLecId === ep.id;
                          return (
                            <div
                              key={ep.id}
                              onClick={() => { if (lecSelectable) onSelectLecture(ep.id); }}
                              className="flex items-center gap-2 pl-9 pr-3 py-2 border-t border-[#f1f5f9] transition-colors"
                              style={{
                                ...(lecSelected ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 33 } : {}),
                                cursor: lecSelectable ? 'pointer' : 'default',
                                opacity: mode === 'series' && !seriesSelected ? 0.55 : 1,
                              }}
                            >
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9.5px] font-bold shrink-0" style={{ background: '#EEEDFE', color: '#534AB7' }}>
                                {ep.episodeNumber ?? idx + 1}
                              </span>
                              <p className="text-[11.5px] font-medium truncate" style={{ color: lecSelected ? '#534AB7' : '#374151' }}>{ep.title}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 시리즈 미지정 강의 */}
            {standalone.length > 0 && (
              <div className="border-b border-[#f1f5f9] last:border-none">
                <div className="px-2.5 py-2 bg-[#f9fafb]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">시리즈 미지정</p>
                </div>
                {standalone.map((lec) => {
                  const lecSelectable = mode === 'lecture';
                  const lecSelected   = mode === 'lecture' && selectedLecId === lec.id;
                  return (
                    <div
                      key={lec.id}
                      onClick={() => { if (lecSelectable) onSelectLecture(lec.id); }}
                      className="flex items-center gap-2 px-2.5 py-2.5 border-t border-[#f1f5f9] transition-colors"
                      style={{
                        ...(lecSelected ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 7 } : {}),
                        cursor: lecSelectable ? 'pointer' : 'default',
                        opacity: mode === 'series' ? 0.55 : 1,
                      }}
                    >
                      <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                        <span style={{ borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
                      </div>
                      <p className="text-[12px] font-semibold truncate" style={{ color: lecSelected ? '#534AB7' : '#111827' }}>{lec.title}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t border-[#f1f5f9] text-[10.5px] text-[#9ca3af] leading-snug">
        {mode === 'series'
          ? '시리즈를 선택하면 소속 강의 전체에 동일한 수강 대상이 적용됩니다.'
          : '강의별로 수강 대상을 개별 지정합니다.'}
      </div>
    </div>
  );
}

// 수강 대상 편집 — 강의 1개(강의별) 또는 시리즈 소속 강의 N개(시리즈별)에 일괄 적용
function TargetEditor({
  mode, title, lectureIds, students, classes, dataLoading,
}: {
  mode: 'lecture' | 'series';
  title: string;
  lectureIds: string[];
  students: TargetStudent[];
  classes: TargetClass[];
  dataLoading: boolean;
}) {
  const [targetType,      setTargetType]      = useState<'class' | 'individual' | 'all'>('class');
  const [checkedClass,    setCheckedClass]    = useState<string[]>([]);
  const [checkedStudents, setCheckedStudents] = useState<string[]>([]);
  const [search,          setSearch]          = useState('');
  const [targetsLoading,  setTargetsLoading]  = useState(false);
  const [mixed,           setMixed]           = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  const idsKey  = lectureIds.join(',');
  const isSeries = mode === 'series';

  // 대상 강의들의 기존 수강 대상 로드 — 시리즈는 강의별로 다를 수 있어 일치 여부 검사
  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split(',');
    let alive = true;
    setTargetsLoading(true);
    setSaved(false);
    setMixed(false);
    setSearch('');
    Promise.all(
      ids.map((id) => fetch(`/api/lectures/${id}/targets`).then((r) => r.json())),
    )
      .then((results) => {
        if (!alive) return;
        const norm = results.map((d) => ({
          type: d.targetMode === 'INDIVIDUAL' ? 'individual' : d.targetMode === 'ALL' ? 'all' : 'class',
          classIds:   Array.isArray(d.classIds)   ? d.classIds   : [],
          studentIds: Array.isArray(d.studentIds) ? d.studentIds : [],
        }));
        const first = norm[0] ?? { type: 'class', classIds: [], studentIds: [] };
        const uniform = norm.every((n) =>
          n.type === first.type &&
          sameSet(n.classIds, first.classIds) &&
          sameSet(n.studentIds, first.studentIds),
        );
        setMixed(!uniform);
        setTargetType(first.type as 'class' | 'individual' | 'all');
        setCheckedClass(first.classIds);
        setCheckedStudents(first.studentIds);
      })
      .catch(() => {})
      .finally(() => { if (alive) setTargetsLoading(false); });
    return () => { alive = false; };
  }, [idsKey]);

  const handleSave = async () => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) return;
    setSaving(true);
    try {
      const body = JSON.stringify({
        targetMode: targetType === 'individual' ? 'INDIVIDUAL' : targetType === 'all' ? 'ALL' : 'CLASS',
        classIds: checkedClass,
        studentIds: checkedStudents,
      });
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/lectures/${id}/targets`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body,
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error();
      setSaved(true);
      setMixed(false);
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const classNameById = useMemo(() => {
    const m: Record<string, string> = {};
    classes.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [classes]);

  const studentClassNames = (s: TargetStudent) =>
    s.classIds.map((id) => classNameById[id]).filter(Boolean);

  // 이름 또는 반 이름으로 검색
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.classIds.some((id) => (classNameById[id] ?? '').toLowerCase().includes(q)),
    );
  }, [students, search, classNameById]);

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden shrink-0">
        <div className="px-4 py-2.5 border-b border-[#f1f5f9] flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-[#1a2535]">{title} — 수강 대상</span>
          {isSeries && (
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#EEEDFE', color: '#534AB7' }}>
              시리즈 전체 {lectureIds.length}강 일괄 적용
            </span>
          )}
        </div>

        {isSeries && mixed && !targetsLoading && (
          <div className="px-4 py-2.5 text-[11.5px] border-b border-[#f1f5f9]" style={{ background: '#FEF9C3', color: '#854d0e' }}>
            ⚠ 이 시리즈의 강의들이 서로 다른 수강 대상으로 지정되어 있습니다. 저장하면 아래 설정으로 전체 통일됩니다.
          </div>
        )}

        <div className="flex gap-2 px-4 py-3 border-b border-[#f1f5f9]">
          {(['class','individual','all'] as const).map((t) => (
            <button key={t} onClick={() => { setTargetType(t); setSaved(false); }}
              className="px-4 py-1.5 rounded-[8px] text-[12.5px] font-medium border-[1.5px] transition-all"
              style={targetType === t
                ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' }
                : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}>
              {t === 'class' ? '반 단위 지정' : t === 'individual' ? '개별 학생 지정' : '전체 공개'}
            </button>
          ))}
        </div>
        {/* 반 단위 지정 */}
        {targetType === 'class' && (
          dataLoading ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-10">반 목록을 불러오는 중...</p>
          ) : classes.length === 0 ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-10">등록된 반이 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-4">
              {classes.map((c) => {
                const checked = checkedClass.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => { setCheckedClass((prev) => prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]); setSaved(false); }}
                    className="flex items-center gap-2 px-3 py-2.5 border-[1.5px] rounded-[8px] cursor-pointer"
                    style={checked ? { background: '#EEEDFE', borderColor: '#a78bfa' } : { borderColor: '#e2e8f0' }}
                  >
                    <div className="rounded flex items-center justify-center text-[10px] shrink-0"
                      style={checked ? { background: '#a78bfa', border: '1.5px solid #a78bfa', color: '#fff', width: 17, height: 17 } : { border: '1.5px solid #e2e8f0', width: 17, height: 17 }}>
                      {checked ? '✓' : ''}
                    </div>
                    <div>
                      <p className="text-[12.5px] font-semibold" style={checked ? { color: '#534AB7' } : { color: '#111827' }}>{c.name}</p>
                      <p className="text-[10.5px] text-[#9ca3af]">{c.count}명</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* 개별 학생 지정 */}
        {targetType === 'individual' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[12px] text-[#9ca3af]">수강할 학생을 개별로 선택합니다.</p>
              {!dataLoading && students.length > 0 && (
                <p className="text-[11.5px] text-[#9ca3af]">
                  전체 {students.length}명{search.trim() && ` · 검색결과 ${filteredStudents.length}명`}
                </p>
              )}
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="학생 이름 또는 반 이름으로 검색"
              className="w-full text-[12.5px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white mb-3"
            />
            {dataLoading ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-8">학생 목록을 불러오는 중...</p>
            ) : students.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-8">학원에 등록된 학생이 없습니다</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-8">검색 결과가 없습니다</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {filteredStudents.map((s) => {
                  const checked  = checkedStudents.includes(s.id);
                  const clsNames = studentClassNames(s);
                  return (
                    <div
                      key={s.id}
                      onClick={() => { setCheckedStudents((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]); setSaved(false); }}
                      className="flex items-center gap-2.5 px-3.5 py-2 border-[1.5px] rounded-[8px] cursor-pointer transition-colors"
                      style={checked ? { background: '#EEEDFE', borderColor: '#a78bfa' } : { borderColor: '#e2e8f0' }}
                    >
                      <div className="rounded flex items-center justify-center text-[10px] shrink-0"
                        style={checked ? { background: '#a78bfa', border: '1.5px solid #a78bfa', color: '#fff', width: 17, height: 17 } : { border: '1.5px solid #e2e8f0', width: 17, height: 17 }}>
                        {checked ? '✓' : ''}
                      </div>
                      <span className="text-[12.5px] font-semibold shrink-0" style={checked ? { color: '#534AB7' } : { color: '#111827' }}>{s.name}</span>
                      <span className="text-[11px] text-[#9ca3af] truncate flex-1 min-w-0">{clsNames.length > 0 ? clsNames.join(', ') : '미배정'}</span>
                      <span className="text-[11px] text-[#9ca3af] shrink-0">{gradeLabel(s.grade)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 전체 공개 */}
        {targetType === 'all' && (
          <div className="p-5 flex flex-col items-center justify-center gap-3 py-10">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-[22px]" style={{ background: '#EEEDFE' }}>🌐</div>
            <p className="text-[14px] font-semibold text-[#1a2535]">전체 공개</p>
            <p className="text-[12.5px] text-[#6b7280] text-center max-w-[320px] leading-relaxed">
              {isSeries ? '이 시리즈의 모든 강의' : '이 강의'}는 학원에 등록된 <strong>모든 학생</strong>에게 공개됩니다.<br />
              특정 반 또는 학생만 접근하게 하려면 다른 옵션을 선택하세요.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#6b7280] leading-7">
        {targetType === 'all' && (
          <>현재 수강 대상: <strong style={{ color: '#534AB7' }}>전체 공개</strong> — 학원의 모든 학생이 {isSeries ? '이 시리즈 강의를' : '이 강의를'} 볼 수 있습니다.</>
        )}
        {targetType === 'class' && (
          <>
            현재 수강 대상: <strong style={{ color: '#534AB7' }}>{checkedClass.length > 0 ? classes.filter((c) => checkedClass.includes(c.id)).map((c) => c.name).join(', ') : '미지정'}</strong>
            {checkedClass.length > 0 && <> — 총 {classes.filter((c) => checkedClass.includes(c.id)).reduce((a, c) => a + c.count, 0)}명</>}
            <br />대상 변경 시 즉시 적용되며, 새로 추가된 학생에게는 강의가 표시됩니다.
          </>
        )}
        {targetType === 'individual' && (
          <>
            현재 수강 대상: <strong style={{ color: '#534AB7' }}>{checkedStudents.length > 0 ? `${checkedStudents.length}명 선택됨` : '미지정'}</strong>
            {checkedStudents.length > 0 && <> — {students.filter((s) => checkedStudents.includes(s.id)).map((s) => s.name).join(', ')}</>}
            <br />선택된 학생에게만 강의가 표시됩니다.
          </>
        )}
      </div>

      {/* 저장 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || targetsLoading || dataLoading}
          className="px-4 py-2 rounded-[8px] text-[12.5px] font-medium text-white disabled:opacity-60 transition-colors"
          style={{ background: saved ? '#059669' : '#5B4FBE' }}
        >
          {saving ? '저장 중...' : saved ? '✓ 저장됨' : (isSeries ? `시리즈 전체 저장 (${lectureIds.length}강)` : '저장')}
        </button>
      </div>
    </div>
  );
}

export function TargetContent({ lectures, loading }: { lectures: Lecture[]; loading: boolean }) {
  const [seriesList,    setSeriesList]    = useState<Series[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [mode,             setMode]             = useState<'lecture' | 'series'>('lecture');
  const [selectedLecId,    setSelectedLecId]    = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState('');

  // 학원 전체 학생·반 — DB 연동
  const [students,    setStudents]    = useState<TargetStudent[]>([]);
  const [classes,     setClasses]     = useState<TargetClass[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/lecture-series')
      .then((r) => r.json())
      .then((d) => { if (alive) setSeriesList(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => { if (alive) setSeriesLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setDataLoading(true);
    Promise.all([
      fetch('/api/students').then((r) => r.json()),
      fetch('/api/classes').then((r) => r.json()),
    ])
      .then(([studentData, classData]) => {
        if (!alive) return;
        setClasses(
          Array.isArray(classData)
            ? classData.map((c: { id: string; name: string; currentStudents: number }) => ({
                id: c.id, name: c.name, count: c.currentStudents ?? 0,
              }))
            : [],
        );
        setStudents(
          Array.isArray(studentData)
            ? studentData.map((s: { id: string; name: string; grade: number; classes: string[] }) => ({
                id: s.id, name: s.name, grade: s.grade, classIds: s.classes ?? [],
              }))
            : [],
        );
      })
      .catch(() => { if (alive) { setClasses([]); setStudents([]); } })
      .finally(() => { if (alive) setDataLoading(false); });
    return () => { alive = false; };
  }, []);

  // 모드별 기본 선택
  useEffect(() => {
    if (mode === 'lecture' && !selectedLecId && lectures.length > 0) {
      setSelectedLecId(lectures[0].id);
    }
  }, [mode, lectures, selectedLecId]);

  useEffect(() => {
    if (mode === 'series' && !selectedSeriesId && seriesList.length > 0) {
      const firstNonEmpty = seriesList.find((s) => lectures.some((l) => l.seriesId === s.id));
      if (firstNonEmpty) setSelectedSeriesId(firstNonEmpty.id);
    }
  }, [mode, seriesList, lectures, selectedSeriesId]);

  const selectedLec    = lectures.find((l) => l.id === selectedLecId) ?? null;
  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId) ?? null;
  const seriesEpisodes = selectedSeries ? episodesOf(lectures, selectedSeries.id) : [];

  const editorIds = mode === 'lecture'
    ? (selectedLec ? [selectedLec.id] : [])
    : seriesEpisodes.map((l) => l.id);
  const editorTitle = mode === 'lecture'
    ? (selectedLec?.title ?? '')
    : (selectedSeries?.title ?? '');

  return (
    <div className="flex-1 flex gap-4 min-h-0">
      <TargetTreePanel
        lectures={lectures}
        seriesList={seriesList}
        loading={loading || seriesLoading}
        mode={mode}
        onModeChange={setMode}
        selectedLecId={selectedLecId}
        selectedSeriesId={selectedSeriesId}
        onSelectLecture={setSelectedLecId}
        onSelectSeries={setSelectedSeriesId}
      />
      {editorIds.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af] bg-white border border-[#e2e8f0] rounded-[10px]">
          {mode === 'series'
            ? (seriesList.length === 0 ? '등록된 시리즈가 없습니다' : '강의가 등록된 시리즈를 선택해주세요')
            : '강의를 선택해주세요'}
        </div>
      ) : (
        <TargetEditor
          mode={mode}
          title={editorTitle}
          lectureIds={editorIds}
          students={students}
          classes={classes}
          dataLoading={dataLoading}
        />
      )}
    </div>
  );
}
