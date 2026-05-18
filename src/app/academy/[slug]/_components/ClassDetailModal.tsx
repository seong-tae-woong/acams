'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  type ClassDetail, type CurriculumDetail, type CurriculumUnitType,
  C, FONT, feeUnit, PALETTE_COLORS, UNIT_LABELS,
} from '../_shared';

/* ─────────────────────────────────────────────────
   ClassDetailModal — 수업 상세 (소개·커리큘럼·교재) 팝업
───────────────────────────────────────────────── */
export default function ClassDetailModal({
  slug, classId, onClose,
}: { slug: string; classId: string; onClose: () => void }) {
  const [data, setData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/academy/${slug}/classes/${classId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setErrorMsg('수업 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [slug, classId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  // unitType별 그룹핑
  const groupedCurriculum = (() => {
    if (!data) return [] as { unit: CurriculumUnitType; rows: CurriculumDetail[]; minWeek: number; maxWeek: number }[];
    return (['MONTH', 'WEEK', 'SESSION'] as CurriculumUnitType[])
      .map((unit) => {
        const rows = data.curriculum.filter((r) => r.unitType === unit);
        if (rows.length === 0) return null;
        const minWeek = Math.min(...rows.map((r) => r.startWeek));
        const maxWeek = Math.max(...rows.map((r) => r.endWeek));
        return { unit, rows, minWeek, maxWeek };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  })();

  const resolveColor = (row: CurriculumDetail, idx: number) => {
    if (row.color) return row.color;
    const palette = data ? PALETTE_COLORS[data.curriculumPalette] : PALETTE_COLORS.green;
    return palette[idx % palette.length];
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, fontFamily: FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card, borderRadius: 18,
          width: '100%', maxWidth: 720, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '18px 22px 14px', borderBottom: `1px solid ${C.border}`,
          gap: 12, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {data && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: data.color, marginRight: 7, verticalAlign: 'middle' }} />}
            <span style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.4px', verticalAlign: 'middle' }}>
              {data?.name ?? '수업 상세'}
            </span>
            {data && (data.subject || data.grade || data.schedule) && (
              <p style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>
                {[data.subject, data.grade, data.schedule].filter(Boolean).join(' · ')}
                {data.fee !== null && <> · <span style={{ color: C.accent, fontWeight: 700 }}>{data.fee.toLocaleString()}원/{feeUnit(data.feeType)}</span></>}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="닫기" style={{
            background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer',
            padding: 4, borderRadius: 6,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ overflowY: 'auto', padding: '18px 22px 22px', flex: 1 }}>
          {loading && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite', margin: '0 auto' }} />
            </div>
          )}
          {errorMsg && !loading && (
            <p style={{ fontSize: 13, color: C.sub, textAlign: 'center', padding: '24px 0' }}>{errorMsg}</p>
          )}
          {data && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {/* 반 소개 */}
              {data.description ? (
                <section>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>반 소개</h3>
                  <p style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.75, whiteSpace: 'pre-line' }}>
                    {data.description}
                  </p>
                </section>
              ) : (
                <section>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>반 소개</h3>
                  <p style={{ fontSize: 12.5, color: C.muted }}>등록된 소개글이 없습니다.</p>
                </section>
              )}

              {/* 커리큘럼 */}
              <section>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>커리큘럼</h3>
                {groupedCurriculum.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: C.muted }}>등록된 커리큘럼이 없습니다.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {groupedCurriculum.map((g) => {
                      const cols = g.maxWeek - g.minWeek + 1;
                      return (
                        <div key={g.unit} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ padding: '8px 12px', background: '#F4F6F8', fontSize: 11.5, fontWeight: 700, color: C.text }}>
                            {UNIT_LABELS[g.unit].label}
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11.5 }}>
                              <thead>
                                <tr>
                                  <th style={{ position: 'sticky', left: 0, background: '#fff', padding: '6px 10px', textAlign: 'left', color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, minWidth: 130 }}>단원</th>
                                  {Array.from({ length: cols }).map((_, i) => (
                                    <th key={i} style={{ padding: '6px 4px', textAlign: 'center', color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, minWidth: 40 }}>
                                      {g.minWeek + i}{UNIT_LABELS[g.unit].suffix}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {g.rows.map((row, idx) => {
                                  const startOffset = row.startWeek - g.minWeek;
                                  const span = row.endWeek - row.startWeek + 1;
                                  const barColor = resolveColor(row, idx);
                                  return (
                                    <tr key={row.id} style={{ borderTop: `1px solid #F1F5F9` }}>
                                      <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '6px 10px', fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>
                                        {row.topic}
                                      </td>
                                      {Array.from({ length: cols }).map((_, i) => {
                                        if (i === startOffset) {
                                          return (
                                            <td key={i} colSpan={span} style={{ padding: 3 }}>
                                              <div style={{
                                                background: barColor, color: '#fff',
                                                fontSize: 10.5, fontWeight: 600,
                                                borderRadius: 6, padding: '3px 6px',
                                                textAlign: 'center', whiteSpace: 'nowrap',
                                                overflow: 'hidden', textOverflow: 'ellipsis',
                                                opacity: row.done ? 0.55 : 1,
                                              }} title={`${row.topic} (${row.startWeek}${UNIT_LABELS[g.unit].suffix}~${row.endWeek}${UNIT_LABELS[g.unit].suffix})`}>
                                                {row.topic}
                                              </div>
                                            </td>
                                          );
                                        }
                                        if (i > startOffset && i < startOffset + span) return null;
                                        return <td key={i} style={{ borderLeft: '1px solid #F8FAFC' }}></td>;
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 교재 */}
              <section>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>사용 교재</h3>
                {data.textbooks.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: C.muted }}>등록된 교재가 없습니다.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.textbooks.map((tb) => (
                      <li key={tb.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px',
                        border: `1px solid ${C.border}`, borderRadius: 10,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tb.name}</p>
                          {(tb.publisher || tb.price !== null) && (
                            <p style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>
                              {tb.publisher}
                              {tb.publisher && tb.price !== null && ' · '}
                              {tb.price !== null && `${tb.price.toLocaleString()}원${tb.unit ? ` / ${tb.unit}` : ''}`}
                            </p>
                          )}
                        </div>
                        {tb.totalUnits > 1 && (
                          <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                            전 {tb.totalUnits}{tb.unit}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
