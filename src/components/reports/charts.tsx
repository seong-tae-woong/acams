'use client';
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export type ChartPresetKey =
  | 'ScoreTrendLine'
  | 'CategoryRadar'
  | 'RankBand'
  | 'AvgVsClass'
  | 'AttendanceBar';

export interface ChartPresetMeta {
  key: ChartPresetKey;
  label: string;
  description: string;
}

export const CHART_PRESETS: ChartPresetMeta[] = [
  { key: 'ScoreTrendLine', label: '성적 추이 (선)', description: '기간 내 시험 점수 추이' },
  { key: 'CategoryRadar', label: '카테고리 평균 (방사형)', description: '카테고리별 평균 점수' },
  { key: 'RankBand', label: '순위 변동 (선)', description: '반 내 순위 변화' },
  { key: 'AvgVsClass', label: '본인 vs 반평균 (막대)', description: '본인 점수 vs 반 평균' },
  { key: 'AttendanceBar', label: '출결 추이 (막대)', description: '결석/지각 추이' },
];

interface TrendPoint { label: string; score: number | null; total?: number }
interface CategoryPoint { category: string; average: number }
interface RankPoint { label: string; rank: number | null; classCount: number }
interface AvgClassPoint { label: string; my: number | null; class: number | null }
interface AttPoint { month: string; absent: number; late: number }

const HEIGHT = 160;

export function ScoreTrendLine({ data }: { data: TrendPoint[] }) {
  if (!data || data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-[12px] text-[#9ca3af]">데이터 없음</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="score" stroke="#4fc3a1" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryRadar({ data }: { data: CategoryPoint[] }) {
  if (!data || data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-[12px] text-[#9ca3af]">데이터 없음</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={HEIGHT + 20}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Radar dataKey="average" stroke="#4fc3a1" fill="#4fc3a1" fillOpacity={0.3} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function RankBand({ data }: { data: RankPoint[] }) {
  if (!data || data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-[12px] text-[#9ca3af]">데이터 없음</div>;
  }
  // 순위는 1이 위쪽이라 reversed
  const max = Math.max(...data.map((d) => d.classCount));
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis reversed domain={[1, max]} tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="rank" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AvgVsClass({ data }: { data: AvgClassPoint[] }) {
  if (!data || data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-[12px] text-[#9ca3af]">데이터 없음</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="my" name="본인" fill="#4fc3a1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="class" name="반평균" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AttendanceBar({ data }: { data: AttPoint[] }) {
  if (!data || data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-[12px] text-[#9ca3af]">데이터 없음</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="absent" name="결석" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
        <Bar dataKey="late" name="지각" fill="#FDE68A" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartPresetRenderer({
  preset,
  data,
}: {
  preset: ChartPresetKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}) {
  switch (preset) {
    case 'ScoreTrendLine': return <ScoreTrendLine data={data} />;
    case 'CategoryRadar': return <CategoryRadar data={data} />;
    case 'RankBand': return <RankBand data={data} />;
    case 'AvgVsClass': return <AvgVsClass data={data} />;
    case 'AttendanceBar': return <AttendanceBar data={data} />;
    default: return null;
  }
}
