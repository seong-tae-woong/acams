'use client';

const KPI = [
  { label: '전체 수강생',   value: '24명',  sub: '초등수학 기초반 기준',     color: undefined },
  { label: '이수 완료',     value: '14명',  sub: '이수율 58%',               color: '#534AB7' },
  { label: '시청 중',       value: '7명',   sub: '미완료',                   color: '#f59e0b' },
  { label: '미시청',        value: '3명',   sub: '알림 필요',                color: '#991b1b' },
];

const ROWS = [
  { name: '김도윤', av: '김', avBg: '#DBEAFE', avColor: '#1d4ed8', prog: 100, score: '92점',  tries: '1회', status: '이수 완료', action: '이수증 발급' },
  { name: '이수아', av: '이', avBg: '#D1FAE5', avColor: '#065f46', prog: 100, score: '100점', tries: '1회', status: '이수 완료', action: '이수증 발급' },
  { name: '박준서', av: '박', avBg: '#DBEAFE', avColor: '#1d4ed8', prog: 100, score: '58점',  tries: '2회', status: '불합격',   action: '재응시 허용' },
  { name: '최하은', av: '최', avBg: '#D1FAE5', avColor: '#065f46', prog: 100, score: '미응시', tries: '0회', status: '시험 대기', action: '알림톡 발송' },
  { name: '정민재', av: '정', avBg: '#DBEAFE', avColor: '#1d4ed8', prog:  62, score: '-',     tries: '0회', status: '시청 중',  action: '알림톡 발송' },
  { name: '강서윤', av: '강', avBg: '#D1FAE5', avColor: '#065f46', prog:   0, score: '-',     tries: '0회', status: '미시청',  action: '알림톡 발송' },
];

function statusBadge(s: string) {
  if (s === '이수 완료') return { bg: '#D1FAE5', color: '#065f46' };
  if (s === '시험 대기') return { bg: '#EEEDFE', color: '#534AB7' };
  if (s === '시청 중')   return { bg: '#FEF3C7', color: '#92400e' };
  if (s === '불합격')   return { bg: '#FEE2E2', color: '#991b1b' };
  return { bg: '#f1f5f9', color: '#6b7280' };
}
function actionStyle(a: string) {
  if (a === '알림톡 발송') return { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' };
  return { background: '#fff', color: '#374151', borderColor: '#e2e8f0' };
}
function progColor(v: number) {
  if (v >= 80) return '#a78bfa';
  if (v >= 40) return '#f59e0b';
  return '#f87171';
}
function scoreColor(s: string) {
  if (s === '-' || s === '미응시') return '#9ca3af';
  const n = parseInt(s);
  return n >= 70 ? '#534AB7' : '#991b1b';
}

export default function StatsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">이수 현황</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강 · 이수 관리</span>
        <div className="ml-auto">
          <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white" style={{ background: '#5B4FBE' }}>미이수 알림톡 발송</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-3">
          {KPI.map((k) => (
            <div key={k.label} className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5">
              <p className="text-[11px] text-[#6b7280] mb-1.5">{k.label}</p>
              <p className="text-[24px] font-bold text-[#1a2535]" style={k.color ? { color: k.color } : {}}>{k.value}</p>
              <p className="text-[12px] text-[#9ca3af] mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2.5">
          <select className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none">
            <option>초등수학 기초 1강</option>
            <option>초등수학 기초 2강</option>
            <option>초등수학 기초 3강</option>
          </select>
          <select className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none">
            <option>전체 상태</option>
            <option>이수 완료</option>
            <option>시험 대기</option>
            <option>시청 중</option>
            <option>미시청</option>
          </select>
          <input type="text" placeholder="학생 이름 검색" className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none w-40" />
          <button className="ml-auto px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50">엑셀 내보내기</button>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535] flex items-center justify-between">
            초등수학 기초 1강 — 학생별 이수 현황
            <span className="text-[12px] font-normal text-[#9ca3af]">합격 기준 70점 이상</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['학생명','시청 진도','시험 점수','응시 횟수','이수 상태','관리'].map((h) => (
                  <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => {
                const badge = statusBadge(r.status);
                const aStyle = actionStyle(r.action);
                return (
                  <tr key={i} className="hover:bg-[#fafafa]">
                    <td className="py-2.5 px-3.5 text-[12.5px] border-b border-[#f1f5f9]">
                      <span className="w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-[12px] font-semibold mr-2" style={{ background: r.avBg, color: r.avColor }}>{r.av}</span>
                      {r.name}
                    </td>
                    <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${r.prog}%`, background: progColor(r.prog) }} />
                        </div>
                        <span className="text-[12px] font-semibold" style={{ color: r.prog === 100 ? '#534AB7' : r.prog === 0 ? '#9ca3af' : '#92400e' }}>{r.prog}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-[12.5px] font-bold border-b border-[#f1f5f9]" style={{ color: scoreColor(r.score) }}>{r.score}</td>
                    <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.tries}</td>
                    <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: badge.bg, color: badge.color }}>{r.status}</span>
                    </td>
                    <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                      <button className="px-2.5 py-1 rounded-[6px] text-[11.5px] border" style={aStyle}>{r.action}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
