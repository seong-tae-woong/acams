'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type TabId = 'notif' | 'cert';

const NOTIF_ROWS = [
  { name: '강서윤', av: '강', avBg: '#D1FAE5', avColor: '#065f46', lecture: '초등수학 기초 1강', prog: '0%',   progColor: '#991b1b', status: '미시청',    lastDate: '-' },
  { name: '정민재', av: '정', avBg: '#DBEAFE', avColor: '#1d4ed8', lecture: '초등수학 기초 2강', prog: '45%',  progColor: '#f59e0b', status: '시청 중',    lastDate: '04.07' },
  { name: '최하은', av: '최', avBg: '#D1FAE5', avColor: '#065f46', lecture: '영어 파닉스 2강',  prog: '100%', progColor: '#a78bfa', status: '시험 미응시', lastDate: '04.08' },
  { name: '박준서', av: '박', avBg: '#DBEAFE', avColor: '#1d4ed8', lecture: '초등수학 기초 1강', prog: '100%', progColor: '#a78bfa', status: '불합격',      lastDate: '04.06' },
];

const CERT_ROWS = [
  { name: '이수아', av: '이', avBg: '#D1FAE5', avColor: '#065f46', lecture: '초등수학 기초 1강', date: '2026.04.07', score: '100점', issued: true },
  { name: '김도윤', av: '김', avBg: '#DBEAFE', avColor: '#1d4ed8', lecture: '초등수학 기초 1강', date: '2026.04.08', score: '92점',  issued: false },
  { name: '최하은', av: '최', avBg: '#D1FAE5', avColor: '#065f46', lecture: '초등수학 기초 1강', date: '2026.04.09', score: '78점',  issued: false },
];

function statusBadge(s: string) {
  if (s === '미시청')    return { bg: '#f1f5f9', color: '#6b7280' };
  if (s === '시청 중')   return { bg: '#FEF3C7', color: '#92400e' };
  if (s === '시험 미응시') return { bg: '#f1f5f9', color: '#6b7280' };
  if (s === '불합격')   return { bg: '#FEE2E2', color: '#991b1b' };
  return { bg: '#f1f5f9', color: '#6b7280' };
}

function PageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const tabParam     = searchParams.get('tab') as TabId | null;
  const [tab, setTab] = useState<TabId>(tabParam === 'cert' ? 'cert' : 'notif');
  const [selected, setSelected] = useState<string[]>([]);
  const [certStudent, setCertStudent] = useState({ name: '이수아', lecture: '초등수학 기초 1강', date: '2026.04.07', score: '100점' });

  useEffect(() => {
    if (tabParam === 'cert') setTab('cert');
    else setTab('notif');
  }, [tabParam]);

  const handleTab = (t: TabId) => {
    setTab(t);
    router.replace(t === 'cert' ? '/ingang/completion/notifications?tab=cert' : '/ingang/completion/notifications');
  };

  const toggleSelect = (name: string) =>
    setSelected((s) => s.includes(name) ? s.filter((x) => x !== name) : [...s, name]);

  const selectAll = () =>
    setSelected(selected.length === NOTIF_ROWS.length ? [] : NOTIF_ROWS.map((r) => r.name));

  const title = tab === 'notif' ? '미이수 알림 발송' : '이수증 발급';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">{title}</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강 · 이수 관리</span>
      </div>

      {/* Page tabs */}
      <div className="bg-white border-b border-[#e2e8f0] flex px-5 shrink-0">
        {(['notif','cert'] as TabId[]).map((t) => (
          <button key={t} onClick={() => handleTab(t)}
            className="py-2.5 px-4 text-[13px] border-b-2 transition-colors -mb-px whitespace-nowrap"
            style={tab === t ? { color: '#a78bfa', borderColor: '#a78bfa', fontWeight: 600 } : { color: '#6b7280', borderColor: 'transparent' }}>
            {t === 'notif' ? '미이수 알림 발송' : '이수증 발급'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex gap-4">
        {tab === 'notif' ? (
          <>
            {/* Left: student list */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <select className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none">
                  <option>전체 강의</option>
                  <option>초등수학 기초 1강</option>
                  <option>영어 파닉스 2강</option>
                </select>
                <select className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none">
                  <option>전체 유형</option>
                  <option>미시청</option>
                  <option>시청 중</option>
                  <option>시험 미응시</option>
                  <option>불합격</option>
                </select>
                <span className="text-[12.5px] text-[#6b7280] ml-auto">
                  선택된 학생: <strong style={{ color: '#534AB7' }}>{selected.length}명</strong>
                </span>
              </div>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex-1">
                <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535] flex items-center justify-between">
                  미이수 학생 목록
                  <button onClick={selectAll} className="px-2.5 py-1 rounded-[6px] text-[11.5px] border border-[#e2e8f0] bg-white text-[#374151] hover:bg-gray-50">
                    {selected.length === NOTIF_ROWS.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0] w-10">
                        <div
                          onClick={selectAll}
                          className="w-4 h-4 rounded border cursor-pointer flex items-center justify-center text-[10px]"
                          style={selected.length === NOTIF_ROWS.length
                            ? { background: '#a78bfa', borderColor: '#a78bfa', color: '#fff' }
                            : { borderColor: '#e2e8f0' }}>
                          {selected.length === NOTIF_ROWS.length ? '✓' : ''}
                        </div>
                      </th>
                      {['학생명','강의명','진도','상태','마지막 시청'].map((h) => (
                        <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NOTIF_ROWS.map((r, i) => {
                      const badge = statusBadge(r.status);
                      const chk   = selected.includes(r.name);
                      return (
                        <tr key={i} className="hover:bg-[#fafafa]">
                          <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                            <div
                              onClick={() => toggleSelect(r.name)}
                              className="w-4 h-4 rounded border cursor-pointer flex items-center justify-center text-[10px]"
                              style={chk ? { background: '#a78bfa', borderColor: '#a78bfa', color: '#fff' } : { borderColor: '#e2e8f0' }}>
                              {chk ? '✓' : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-[12.5px] border-b border-[#f1f5f9]">
                            <span className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[11px] font-semibold mr-2" style={{ background: r.avBg, color: r.avColor }}>{r.av}</span>
                            {r.name}
                          </td>
                          <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.lecture}</td>
                          <td className="py-2.5 px-3.5 text-[12.5px] font-semibold border-b border-[#f1f5f9]" style={{ color: r.progColor }}>{r.prog}</td>
                          <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: badge.bg, color: badge.color }}>{r.status}</span>
                          </td>
                          <td className="py-2.5 px-3.5 text-[11.5px] text-[#9ca3af] border-b border-[#f1f5f9]">{r.lastDate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Send panel */}
            <div className="w-[320px] shrink-0 flex flex-col gap-3">
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] p-4">
                <p className="text-[11.5px] font-semibold uppercase tracking-wider text-[#6b7280] mb-2.5">알림톡 메시지</p>
                <textarea
                  rows={6}
                  defaultValue={`[세계로학원] 아직 완료하지 않은 인강이 있습니다.\n\n강의: 초등수학 기초 1강\n현재 진도: 미시청\n\n빠른 시일 내 수강 완료 부탁드립니다.\n문의: 02-1234-5678`}
                  className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 bg-[#f9fafb] text-[#374151] resize-none outline-none focus:border-[#a78bfa] focus:bg-white leading-relaxed"
                />
                <p className="text-[11px] text-[#9ca3af] text-right mt-1">학생별 강의명·진도율 자동 삽입</p>
              </div>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] p-4">
                <p className="text-[11.5px] font-semibold uppercase tracking-wider text-[#6b7280] mb-2.5">발송 대상 확인</p>
                <p className="text-[12.5px] text-[#6b7280] leading-8">
                  선택 학생: <strong style={{ color: '#534AB7' }}>{selected.length}명</strong><br />
                  발송 채널: 카카오 알림톡<br />
                  수신자: 학생 본인 + 보호자
                </p>
              </div>
              <button
                className="w-full py-2.5 rounded-[8px] text-[13px] font-bold"
                style={{ background: '#FAE100', color: '#3A1D1D' }}
              >
                카카오 알림톡 발송
              </button>
              {selected.length === 0 && (
                <p className="text-[11.5px] text-[#9ca3af] text-center">학생을 선택한 후 발송하세요</p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Left: completion list */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <select className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none">
                  <option>전체 강의</option>
                  <option>초등수학 기초 1강</option>
                </select>
                <select className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none">
                  <option>전체 반</option>
                  <option>초등수학 기초반</option>
                </select>
                <input type="text" placeholder="학생 이름 검색" className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none w-40" />
              </div>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex-1">
                <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535] flex items-center justify-between">
                  이수 완료 학생 <span className="text-[12px] font-normal text-[#9ca3af]">이수증 발급 가능</span>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['학생명','강의명','이수 완료일','합격 점수','발급 상태','관리'].map((h) => (
                        <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CERT_ROWS.map((r, i) => (
                      <tr key={i} className="hover:bg-[#fafafa] cursor-pointer"
                        onClick={() => setCertStudent({ name: r.name, lecture: r.lecture, date: r.date, score: r.score })}>
                        <td className="py-2.5 px-3.5 text-[12.5px] border-b border-[#f1f5f9]">
                          <span className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[11px] font-semibold mr-2" style={{ background: r.avBg, color: r.avColor }}>{r.av}</span>
                          {r.name}
                        </td>
                        <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.lecture}</td>
                        <td className="py-2.5 px-3.5 text-[11.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.date}</td>
                        <td className="py-2.5 px-3.5 text-[12.5px] font-semibold border-b border-[#f1f5f9]" style={{ color: '#534AB7' }}>{r.score}</td>
                        <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                          {r.issued
                            ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#D1FAE5', color: '#065f46' }}>발급 완료</span>
                            : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#f1f5f9', color: '#6b7280' }}>미발급</span>
                          }
                        </td>
                        <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                          <button
                            className="px-2.5 py-1 rounded-[6px] text-[11.5px] border font-medium"
                            style={r.issued ? { background: '#fff', color: '#374151', borderColor: '#e2e8f0' } : { background: '#5B4FBE', color: '#fff', borderColor: 'transparent' }}
                          >
                            {r.issued ? '재발급' : '이수증 발급'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Certificate preview */}
            <div className="w-[320px] shrink-0 flex flex-col gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">이수증 미리보기</p>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
                <div className="p-5 text-center" style={{ background: 'linear-gradient(135deg, #1e1b2e, #2d1b69)' }}>
                  <p className="text-[18px] font-bold text-white mb-1">Aca<span style={{ color: '#a78bfa' }}>MS</span></p>
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.7)' }}>인강 이수증</p>
                </div>
                <div className="p-4 flex flex-col gap-2.5">
                  {[
                    { label: '성명',       value: certStudent.name },
                    { label: '강의명',     value: certStudent.lecture },
                    { label: '이수 완료일', value: certStudent.date },
                    { label: '시험 점수',  value: certStudent.score, highlight: true },
                    { label: '발급 기관',  value: '세계로학원' },
                  ].map((row) => (
                    <div key={row.label} className="flex text-[12.5px]">
                      <span className="w-20 text-[#9ca3af] shrink-0">{row.label}</span>
                      <span className="flex-1 font-medium" style={row.highlight ? { color: '#534AB7', fontWeight: 700 } : { color: '#374151' }}>{row.value}</span>
                    </div>
                  ))}
                  <div className="text-center mt-2 p-3 border-2 border-[#e2e8f0] rounded-[8px] text-[11.5px] text-[#9ca3af]">
                    위 학생이 해당 강의를 성실히 이수하였음을 증명합니다.
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50">PDF 저장</button>
                <button className="flex-1 py-2 rounded-[8px] text-[12.5px] font-medium text-white" style={{ background: '#5B4FBE' }}>발급 확정</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#9ca3af]">로딩 중...</div>}>
      <PageContent />
    </Suspense>
  );
}
