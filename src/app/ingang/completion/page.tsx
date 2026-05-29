'use client';

/**
 * 이수관리 홈 (개입 대시보드)
 *
 * - 상단 4개 KPI 카드
 * - 좌측: 위험 학생 패널 — 체크박스 선택 후 일괄 알림 발송
 * - 우측: 이수증 발급 가능 패널 — 체크박스 선택 후 일괄 발급
 *
 * 데이터:
 * - GET /api/ingang/completion/dashboard (KPI)
 * - GET /api/ingang/completion/at-risk?filter=&cursor=
 * - GET /api/ingang/completion/eligible?cursor=
 *
 * 액션:
 * - POST /api/ingang/completion/notify (학생 집계 + 7일 throttle)
 * - POST /api/ingang/certificates (일괄 발급)
 * - GET /api/ingang/certificates/{id}/pdf (다운로드)
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/stores/toastStore';

type Kpi = {
  totalEnrolled: number;
  notStarted: number;
  examPending: number;
  eligibleCount: number;
  completionRate: number;
  seriesCount: number;
  seriesCompletionCount: number;
};

type AtRiskRow = {
  id: string;
  studentId: string;
  studentName: string;
  lectureId: string;
  lectureTitle: string;
  seriesTitle: string | null;
  progressPct: number;
  status: 'not_started' | 'in_progress' | 'exam_pending' | 'failed';
};

type EligibleRow = {
  seriesCompletionId: string;
  studentId: string;
  studentName: string;
  seriesId: string;
  seriesTitle: string;
  completedAt: string;
  scoreSnapshot: number | null;
};

const STATUS_LABEL: Record<AtRiskRow['status'], { label: string; color: string; bg: string }> = {
  not_started: { label: '미시청', color: '#6b7280', bg: '#f1f5f9' },
  in_progress: { label: '시청 중', color: '#92400e', bg: '#fef3c7' },
  exam_pending: { label: '시험 대기', color: '#534AB7', bg: '#EEEDFE' },
  failed: { label: '불합격', color: '#b91c1c', bg: '#fee2e2' },
};

export default function CompletionDashboardPage() {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  const [atRisk, setAtRisk] = useState<AtRiskRow[]>([]);
  const [atRiskLoading, setAtRiskLoading] = useState(true);
  const [atRiskFilter, setAtRiskFilter] = useState<'all' | AtRiskRow['status']>('all');
  const [selectedRisk, setSelectedRisk] = useState<Set<string>>(new Set()); // row.id 기준

  const [eligible, setEligible] = useState<EligibleRow[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(true);
  const [selectedEligible, setSelectedEligible] = useState<Set<string>>(new Set()); // seriesCompletionId 기준

  const [sending, setSending] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const loadKpi = useCallback(async () => {
    setKpiLoading(true);
    try {
      const res = await fetch('/api/ingang/completion/dashboard');
      if (!res.ok) throw new Error('KPI load failed');
      setKpi(await res.json());
    } catch (err) {
      console.error(err);
      toast('KPI 로드 실패', 'error');
    } finally {
      setKpiLoading(false);
    }
  }, []);

  const loadAtRisk = useCallback(async (filter: typeof atRiskFilter) => {
    setAtRiskLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filter !== 'all') params.set('filter', filter);
      const res = await fetch(`/api/ingang/completion/at-risk?${params}`);
      if (!res.ok) throw new Error('at-risk load failed');
      const data = await res.json();
      setAtRisk(data.items ?? []);
    } catch (err) {
      console.error(err);
      toast('위험 학생 로드 실패', 'error');
    } finally {
      setAtRiskLoading(false);
    }
  }, []);

  const loadEligible = useCallback(async () => {
    setEligibleLoading(true);
    try {
      const res = await fetch('/api/ingang/completion/eligible?limit=100');
      if (!res.ok) throw new Error('eligible load failed');
      const data = await res.json();
      setEligible(data.items ?? []);
    } catch (err) {
      console.error(err);
      toast('이수증 발급 대기 로드 실패', 'error');
    } finally {
      setEligibleLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKpi();
    loadAtRisk(atRiskFilter);
    loadEligible();
  }, [loadKpi, loadAtRisk, loadEligible, atRiskFilter]);

  const toggleRisk = (id: string) => {
    setSelectedRisk((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllRisk = () => {
    setSelectedRisk((prev) =>
      prev.size === atRisk.length ? new Set() : new Set(atRisk.map((r) => r.id)),
    );
  };
  const toggleEligible = (id: string) => {
    setSelectedEligible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllEligible = () => {
    setSelectedEligible((prev) =>
      prev.size === eligible.length ? new Set() : new Set(eligible.map((r) => r.seriesCompletionId)),
    );
  };

  const sendNotifications = async () => {
    if (selectedRisk.size === 0) {
      toast('학생을 선택하세요', 'info');
      return;
    }
    // 학생별로 강의 목록 집계
    const byStudent = new Map<string, string[]>();
    for (const id of selectedRisk) {
      const row = atRisk.find((r) => r.id === id);
      if (!row) continue;
      const arr = byStudent.get(row.studentId) ?? [];
      arr.push(row.lectureId);
      byStudent.set(row.studentId, arr);
    }
    const items = [...byStudent.entries()].map(([studentId, lectureIds]) => ({ studentId, lectureIds }));

    setSending(true);
    try {
      const res = await fetch('/api/ingang/completion/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'notify failed');
      toast(
        `발송 ${data.sentCount}건 / 7일 throttle 차단 ${data.skippedCount}건`,
        data.sentCount > 0 ? 'success' : 'info',
      );
      setSelectedRisk(new Set());
      await loadKpi();
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : '발송 실패', 'error');
    } finally {
      setSending(false);
    }
  };

  const issueCertificates = async () => {
    if (selectedEligible.size === 0) {
      toast('대상을 선택하세요', 'info');
      return;
    }
    setIssuing(true);
    try {
      const res = await fetch('/api/ingang/certificates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seriesCompletionIds: [...selectedEligible] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'issue failed');
      toast(`이수증 ${data.issuedCount}건 발급 (skip ${data.skippedCount})`, 'success');
      setSelectedEligible(new Set());
      await Promise.all([loadKpi(), loadEligible()]);
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : '발급 실패', 'error');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e1b2e', marginBottom: 4 }}>이수관리 홈</h1>
        <p style={{ fontSize: 12, color: '#6b7280' }}>위험 학생에게 알림을 보내고, 시리즈 완주자에게 이수증을 발급합니다.</p>
      </header>

      {/* KPI 카드 */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KpiCard label="전체 이수율" value={kpiLoading ? '…' : `${kpi?.completionRate ?? 0}%`} hint={kpi ? `${kpi.seriesCompletionCount}건 완주 / ${kpi.seriesCount}개 시리즈` : ''} />
        <KpiCard label="미시청자" value={kpiLoading ? '…' : `${kpi?.notStarted ?? 0}명`} hint="시청 진도 기록 없음" tone="warning" />
        <KpiCard label="시험 대기" value={kpiLoading ? '…' : `${kpi?.examPending ?? 0}건`} hint="after100 강의 시청 완료 + 시험 미응시·미합격" tone="warning" />
        <KpiCard label="발급 가능" value={kpiLoading ? '…' : `${kpi?.eligibleCount ?? 0}명`} hint="시리즈 완주, 이수증 미발급" tone="accent" />
      </section>

      {/* 좌우 패널 */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* 위험 학생 패널 */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <header style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e1b2e' }}>개입 대상 (위험 학생)</h2>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>선택 후 카카오/인앱 알림 발송</p>
            </div>
            <button
              onClick={sendNotifications}
              disabled={sending || selectedRisk.size === 0}
              style={{
                padding: '8px 14px',
                background: sending || selectedRisk.size === 0 ? '#cbd5e1' : '#5B4FBE',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                cursor: sending || selectedRisk.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {sending ? '발송 중…' : `선택 ${selectedRisk.size}명에게 알림 발송`}
            </button>
          </header>

          {/* 필터 */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['all', 'not_started', 'in_progress', 'exam_pending', 'failed'] as const).map((f) => {
              const active = atRiskFilter === f;
              const labels: Record<typeof f, string> = { all: '전체', not_started: '미시청', in_progress: '시청 중', exam_pending: '시험 대기', failed: '불합격' };
              return (
                <button
                  key={f}
                  onClick={() => { setAtRiskFilter(f); setSelectedRisk(new Set()); }}
                  style={{
                    padding: '4px 10px',
                    background: active ? '#5B4FBE' : '#fff',
                    color: active ? '#fff' : '#6b7280',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 999,
                    border: `1px solid ${active ? '#5B4FBE' : '#e5e7eb'}`,
                    cursor: 'pointer',
                  }}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {/* 테이블 */}
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', width: 40 }}>
                    <input
                      type="checkbox"
                      checked={atRisk.length > 0 && selectedRisk.size === atRisk.length}
                      onChange={toggleAllRisk}
                    />
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>학생</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>강의 (시리즈)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>진도</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {atRiskLoading ? (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>로딩 중…</td></tr>
                ) : atRisk.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>해당 조건의 학생이 없습니다.</td></tr>
                ) : atRisk.map((r) => {
                  const sb = STATUS_LABEL[r.status];
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="checkbox" checked={selectedRisk.has(r.id)} onChange={() => toggleRisk(r.id)} />
                      </td>
                      <td style={{ padding: '8px 12px', color: '#111827', fontWeight: 600 }}>{r.studentName}</td>
                      <td style={{ padding: '8px 12px', color: '#374151' }}>
                        {r.lectureTitle}
                        {r.seriesTitle && <span style={{ marginLeft: 6, color: '#9ca3af', fontSize: 10 }}>· {r.seriesTitle}</span>}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280' }}>{r.progressPct}%</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 999, background: sb.bg, color: sb.color, fontSize: 11, fontWeight: 600 }}>
                          {sb.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 발급 가능자 패널 */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <header style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e1b2e' }}>이수증 발급 대기</h2>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>시리즈 완주, 미발급</p>
            </div>
            <button
              onClick={issueCertificates}
              disabled={issuing || selectedEligible.size === 0}
              style={{
                padding: '8px 14px',
                background: issuing || selectedEligible.size === 0 ? '#cbd5e1' : '#5B4FBE',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                cursor: issuing || selectedEligible.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {issuing ? '발급 중…' : `선택 ${selectedEligible.size}건 일괄 발급`}
            </button>
          </header>
          <div style={{ maxHeight: 540, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', width: 40 }}>
                    <input
                      type="checkbox"
                      checked={eligible.length > 0 && selectedEligible.size === eligible.length}
                      onChange={toggleAllEligible}
                    />
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>학생</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>시리즈</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>점수</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>완주일</th>
                </tr>
              </thead>
              <tbody>
                {eligibleLoading ? (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>로딩 중…</td></tr>
                ) : eligible.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>발급 대기자가 없습니다.</td></tr>
                ) : eligible.map((r) => (
                  <tr key={r.seriesCompletionId} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="checkbox"
                        checked={selectedEligible.has(r.seriesCompletionId)}
                        onChange={() => toggleEligible(r.seriesCompletionId)}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', color: '#111827', fontWeight: 600 }}>{r.studentName}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{r.seriesTitle}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#534AB7', fontWeight: 600 }}>
                      {r.scoreSnapshot != null ? `${r.scoreSnapshot}점` : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#6b7280' }}>
                      {new Date(r.completedAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warning' | 'accent' }) {
  const valueColor = tone === 'warning' ? '#92400e' : tone === 'accent' ? '#5B4FBE' : '#1e1b2e';
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
      <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 22, color: valueColor, fontWeight: 700, marginBottom: 4 }}>{value}</p>
      {hint && <p style={{ fontSize: 10, color: '#9ca3af' }}>{hint}</p>}
    </div>
  );
}
