'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type TabId = 'view' | 'exam';

const VIEW_ROWS = [
  { name: '김도윤', av: '김', avBg: '#DBEAFE', avColor: '#1d4ed8', prog: 100, lastDate: '04.08', cnt: '2회', status: '완료' },
  { name: '이수아', av: '이', avBg: '#D1FAE5', avColor: '#065f46', prog: 100, lastDate: '04.07', cnt: '1회', status: '완료' },
  { name: '박준서', av: '박', avBg: '#DBEAFE', avColor: '#1d4ed8', prog: 100, lastDate: '04.06', cnt: '3회', status: '완료' },
  { name: '최하은', av: '최', avBg: '#D1FAE5', avColor: '#065f46', prog: 72,  lastDate: '04.09', cnt: '1회', status: '시청 중' },
  { name: '정민재', av: '정', avBg: '#DBEAFE', avColor: '#1d4ed8', prog: 45,  lastDate: '04.07', cnt: '1회', status: '시청 중' },
  { name: '강서윤', av: '강', avBg: '#D1FAE5', avColor: '#065f46', prog:  0,  lastDate: '-',     cnt: '0회', status: '미시청' },
];
const EXAM_ROWS = [
  { name: '이수아', av: '이', avBg: '#D1FAE5', avColor: '#065f46', tries: '1회', best: '100점', last: '100점', result: '합격', note: '-' },
  { name: '김도윤', av: '김', avBg: '#DBEAFE', avColor: '#1d4ed8', tries: '2회', best: '92점',  last: '92점',  result: '합격', note: '1회 재응시' },
  { name: '최하은', av: '최', avBg: '#D1FAE5', avColor: '#065f46', tries: '1회', best: '78점',  last: '78점',  result: '합격', note: '-' },
  { name: '정민재', av: '정', avBg: '#DBEAFE', avColor: '#1d4ed8', tries: '1회', best: '72점',  last: '72점',  result: '합격', note: '-' },
  { name: '박준서', av: '박', avBg: '#DBEAFE', avColor: '#1d4ed8', tries: '3회', best: '58점',  last: '58점',  result: '불합격', note: '재응시 허용 →' },
  { name: '강서윤', av: '강', avBg: '#D1FAE5', avColor: '#065f46', tries: '0회', best: '-',     last: '-',     result: '미응시', note: '알림톡 발송 →' },
];

function progColor(v: number) {
  if (v >= 80) return '#a78bfa';
  if (v >= 40) return '#f59e0b';
  return '#f87171';
}
function progTextColor(v: number) {
  if (v >= 80) return '#534AB7';
  if (v >= 40) return '#92400e';
  return '#9ca3af';
}
function statusBadge(s: string) {
  if (s === '완료')   return { bg: '#D1FAE5', color: '#065f46' };
  if (s === '시청 중') return { bg: '#EEEDFE', color: '#534AB7' };
  return { bg: '#f1f5f9', color: '#6b7280' };
}
function resultBadge(r: string) {
  if (r === '합격')   return { bg: '#D1FAE5', color: '#065f46' };
  if (r === '불합격') return { bg: '#FEE2E2', color: '#991b1b' };
  return { bg: '#f1f5f9', color: '#6b7280' };
}

const SCORE_DIST = [
  { range: '0~59',  cnt: 1, h: 20 },
  { range: '60~69', cnt: 1, h: 20 },
  { range: '70~79', cnt: 2, h: 40, hi: true },
  { range: '80~89', cnt: 1, h: 20, hi: true },
  { range: '90~100',cnt: 1, h: 20, hi: true },
];

function PageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const tabParam     = searchParams.get('tab') as TabId | null;
  const [tab, setTab] = useState<TabId>(tabParam === 'exam' ? 'exam' : 'view');

  useEffect(() => {
    if (tabParam === 'exam') setTab('exam');
    else setTab('view');
  }, [tabParam]);

  const handleTab = (t: TabId) => {
    setTab(t);
    router.replace(t === 'exam' ? '/ingang/completion?tab=exam' : '/ingang/completion');
  };

  const title = tab === 'view' ? '시청 현황' : '시험 응시 현황';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">{title}</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강 · 이수 관리</span>
        <div className="ml-auto">
          <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50">엑셀 내보내기</button>
        </div>
      </div>

      {/* Page tabs */}
      <div className="bg-white border-b border-[#e2e8f0] flex px-5 shrink-0">
        {(['view','exam'] as TabId[]).map((t) => (
          <button key={t} onClick={() => handleTab(t)}
            className="py-2.5 px-4 text-[13px] border-b-2 transition-colors -mb-px"
            style={tab === t ? { color: '#a78bfa', borderColor: '#a78bfa', fontWeight: 600 } : { color: '#6b7280', borderColor: 'transparent' }}>
            {t === 'view' ? '시청 현황' : '시험 응시 현황'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5">
        {/* Filter */}
        <div className="flex items-center gap-2.5">
          <select className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none">
            <option>초등수학 기초 1강</option>
            <option>초등수학 기초 2강</option>
            <option>영어 파닉스 1강</option>
          </select>
          <select className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none">
            <option>전체 반</option>
            <option>초등수학 기초반</option>
          </select>
          {tab === 'view' && (
            <select className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none">
              <option>전체 상태</option>
              <option>완료</option>
              <option>시청 중</option>
              <option>미시청</option>
            </select>
          )}
          <input type="text" placeholder="학생 이름 검색" className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none w-40" />
        </div>

        {/* KPI */}
        <div className="grid grid-cols-4 gap-3">
          {tab === 'view' ? (
            <>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5"><p className="text-[11px] text-[#6b7280] mb-1.5">전체 수강생</p><p className="text-[22px] font-bold text-[#1a2535]">14명</p></div>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5"><p className="text-[11px] text-[#6b7280] mb-1.5">시청 완료</p><p className="text-[22px] font-bold" style={{ color: '#534AB7' }}>8명</p></div>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5"><p className="text-[11px] text-[#6b7280] mb-1.5">시청 중</p><p className="text-[22px] font-bold" style={{ color: '#f59e0b' }}>4명</p></div>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5"><p className="text-[11px] text-[#6b7280] mb-1.5">미시청</p><p className="text-[22px] font-bold" style={{ color: '#991b1b' }}>2명</p></div>
            </>
          ) : (
            <>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5"><p className="text-[11px] text-[#6b7280] mb-1.5">응시 가능 학생</p><p className="text-[22px] font-bold text-[#1a2535]">8명</p></div>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5"><p className="text-[11px] text-[#6b7280] mb-1.5">응시 완료</p><p className="text-[22px] font-bold" style={{ color: '#534AB7' }}>6명</p></div>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5"><p className="text-[11px] text-[#6b7280] mb-1.5">합격</p><p className="text-[22px] font-bold" style={{ color: '#065f46' }}>4명</p></div>
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5"><p className="text-[11px] text-[#6b7280] mb-1.5">평균 점수</p><p className="text-[22px] font-bold text-[#1a2535]">76.2점</p></div>
            </>
          )}
        </div>

        {/* Table */}
        {tab === 'view' ? (
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">초등수학 기초 1강 — 학생별 시청 현황</div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['학생명','시청 진도','마지막 시청','총 시청 횟수','상태'].map((h) => (
                    <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VIEW_ROWS.map((r, i) => {
                  const badge = statusBadge(r.status);
                  return (
                    <tr key={i} className="hover:bg-[#fafafa]">
                      <td className="py-2.5 px-3.5 text-[12.5px] border-b border-[#f1f5f9]">
                        <span className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[11px] font-semibold mr-2" style={{ background: r.avBg, color: r.avColor }}>{r.av}</span>
                        {r.name}
                      </td>
                      <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden max-w-[100px]">
                            <div className="h-full rounded-full" style={{ width: `${r.prog}%`, background: progColor(r.prog) }} />
                          </div>
                          <span className="text-[12px] font-semibold" style={{ color: progTextColor(r.prog) }}>{r.prog}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-[11.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.lastDate}</td>
                      <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] text-center border-b border-[#f1f5f9]">{r.cnt}</td>
                      <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: badge.bg, color: badge.color }}>{r.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535] flex items-center justify-between">
              점수 분포 <span className="text-[12px] font-normal text-[#9ca3af]">합격 기준 70점</span>
            </div>
            {/* Score distribution bar */}
            <div className="flex items-end gap-1.5 px-4 py-4 h-24 border-b border-[#f1f5f9]">
              {SCORE_DIST.map((s) => (
                <div key={s.range} className="flex flex-col items-center flex-1">
                  <span className="text-[10px] font-semibold mb-1" style={{ color: s.hi ? '#534AB7' : '#9ca3af' }}>{s.cnt}</span>
                  <div className="w-full rounded-t" style={{ height: s.h, background: s.hi ? '#a78bfa' : '#EEEDFE' }} />
                  <span className="text-[10px] text-[#9ca3af] mt-1">{s.range}</span>
                </div>
              ))}
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['학생명','응시 횟수','최고 점수','최근 점수','결과','비고'].map((h) => (
                    <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXAM_ROWS.map((r, i) => {
                  const badge = resultBadge(r.result);
                  return (
                    <tr key={i} className="hover:bg-[#fafafa]">
                      <td className="py-2.5 px-3.5 text-[12.5px] border-b border-[#f1f5f9]">
                        <span className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[11px] font-semibold mr-2" style={{ background: r.avBg, color: r.avColor }}>{r.av}</span>
                        {r.name}
                      </td>
                      <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] text-center border-b border-[#f1f5f9]" style={r.result === '불합격' ? { color: '#991b1b', fontWeight: 600 } : {}}>{r.tries}</td>
                      <td className="py-2.5 px-3.5 text-[12.5px] font-bold border-b border-[#f1f5f9]" style={r.result === '불합격' ? { color: '#991b1b' } : { color: '#534AB7' }}>{r.best}</td>
                      <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.last}</td>
                      <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: badge.bg, color: badge.color }}>{r.result}</span>
                      </td>
                      <td className="py-2.5 px-3.5 text-[11.5px] border-b border-[#f1f5f9]"
                        style={r.note !== '-' ? { color: '#a78bfa', cursor: 'pointer' } : { color: '#9ca3af' }}>
                        {r.note}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompletionPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#9ca3af]">로딩 중...</div>}>
      <PageContent />
    </Suspense>
  );
}
