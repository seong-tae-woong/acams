'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { useClassStore } from '@/lib/stores/classStore';
import { StudentStatus } from '@/lib/types/student';
import { BillStatus } from '@/lib/types/finance';
import clsx from 'clsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

const TABS = ['학생/매출 현황', '재등록률/이탈율'] as const;
type Tab = typeof TABS[number];

const COLORS = ['#4fc3a1', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];

// 더미 월별 추이 데이터
const MONTHLY_TREND = [
  { month: '11월', students: 15, revenue: 3800000 },
  { month: '12월', students: 16, revenue: 4000000 },
  { month: '1월', students: 16, revenue: 4200000 },
  { month: '2월', students: 17, revenue: 4350000 },
  { month: '3월', students: 18, revenue: 4560000 },
  { month: '4월', students: 18, revenue: 4720000 },
];

// 재등록률 더미 데이터
const RE_REGISTRATION = [
  { month: '1월', reRate: 92, leaveRate: 8 },
  { month: '2월', reRate: 94, leaveRate: 6 },
  { month: '3월', reRate: 89, leaveRate: 11 },
  { month: '4월', reRate: 95, leaveRate: 5 },
];

// 이탈 사유 더미 데이터
const LEAVE_REASONS = [
  { name: '학업 과부하', value: 3 },
  { name: '이사/전학', value: 2 },
  { name: '비용 부담', value: 1 },
  { name: '기타', value: 1 },
];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('학생/매출 현황');
  const { students } = useStudentStore();
  const { bills } = useFinanceStore();
  const { classes } = useClassStore();

  const activeCount = students.filter((s) => s.status === StudentStatus.ACTIVE).length;
  const onLeaveCount = students.filter((s) => s.status === StudentStatus.ON_LEAVE).length;
  const withdrawnCount = students.filter((s) => s.status === StudentStatus.WITHDRAWN).length;

  const totalRevenue = bills.filter((b) => b.status !== BillStatus.UNPAID).reduce((s, b) => s + b.paidAmount, 0);
  const collectionRate = bills.length > 0
    ? Math.round((bills.filter((b) => b.status === BillStatus.PAID).length / bills.length) * 100)
    : 0;

  const byClassData = classes.map((c) => ({
    name: c.name.slice(0, 6),
    students: c.currentStudents,
    capacity: c.maxStudents,
  }));

  const statusData = [
    { name: '재원', value: activeCount },
    { name: '휴원', value: onLeaveCount },
    { name: '퇴원', value: withdrawnCount },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="통계 및 분석" badge="2026년 4월" />
      <div className="flex-1 overflow-y-auto">
        {/* 탭 */}
        <div className="bg-white border-b border-[#e2e8f0] px-5 flex gap-4">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'py-3.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer',
                tab === t ? 'border-[#4fc3a1] text-[#111827]' : 'border-transparent text-[#6b7280] hover:text-[#374151]',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {tab === '학생/매출 현황' && (
            <>
              {/* KPI 카드 */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '전체 학생', value: `${students.length}명`, color: '#111827' },
                  { label: '재원 학생', value: `${activeCount}명`, color: '#0D9E7A' },
                  { label: '이번 달 수납', value: `${(totalRevenue / 10000).toFixed(0)}만원`, color: '#4fc3a1' },
                  { label: '수납률', value: `${collectionRate}%`, color: '#1d4ed8' },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                    <div className="text-[22px] font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                    <div className="text-[11.5px] text-[#6b7280] mt-1">{kpi.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 월별 학생/매출 추이 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">월별 학생 수 추이</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={MONTHLY_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="students" name="학생 수" stroke="#4fc3a1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 학생 상태 파이차트 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">학생 상태 분포</div>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={160}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                          {statusData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {statusData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2 text-[12px]">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />
                          <span className="text-[#374151]">{d.name}</span>
                          <span className="font-semibold text-[#111827] ml-auto pl-3">{d.value}명</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 반별 정원/현원 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">반별 수강 현황</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={byClassData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="capacity" name="정원" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="students" name="현원" fill="#4fc3a1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 월별 매출 추이 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">월별 수납액 추이</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={MONTHLY_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${((v as number) / 10000).toFixed(0)}만`} />
                      <Tooltip formatter={(v) => `${(v as number).toLocaleString()}원`} contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="revenue" name="수납액" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {tab === '재등록률/이탈율' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                  <div className="text-[24px] font-bold text-[#0D9E7A]">95%</div>
                  <div className="text-[11.5px] text-[#6b7280] mt-1">4월 재등록률</div>
                </div>
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                  <div className="text-[24px] font-bold text-[#991B1B]">5%</div>
                  <div className="text-[11.5px] text-[#6b7280] mt-1">4월 이탈율</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 재등록률 추이 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">재등록률 / 이탈율 추이</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={RE_REGISTRATION} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="reRate" name="재등록률 (%)" stroke="#4fc3a1" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="leaveRate" name="이탈율 (%)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 이탈 사유 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">이탈 사유 분석</div>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={160}>
                      <PieChart>
                        <Pie data={LEAVE_REASONS} cx="50%" cy="50%" outerRadius={65} dataKey="value">
                          {LEAVE_REASONS.map((_, i) => (
                            <Cell key={i} fill={COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {LEAVE_REASONS.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2 text-[12px]">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />
                          <span className="text-[#374151]">{d.name}</span>
                          <span className="font-semibold text-[#111827] ml-auto pl-2">{d.value}건</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
