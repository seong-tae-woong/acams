'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type Lecture = {
  id: string;
  title: string;
  subjects: string[];
  levels: string[];
  targetGrades: string[];
  duration: string;
  status: 'DRAFT' | 'PUBLISHED';
  teacher?: { name: string } | null;
};

export default function LecturesPage() {
  const [lectures,      setLectures]      = useState<Lecture[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [search,        setSearch]        = useState('');

  useEffect(() => {
    fetch('/api/lectures')
      .then((r) => r.json())
      .then((data) => setLectures(Array.isArray(data) ? data : []))
      .catch(() => setLectures([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = lectures.filter((l) => {
    if (subjectFilter && !l.subjects.includes(subjectFilter)) return false;
    if (statusFilter && l.status !== statusFilter) return false;
    if (search && !l.title.includes(search)) return false;
    return true;
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">강의 목록</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강</span>
        <div className="ml-auto">
          <Link
            href="/ingang/lectures/new"
            className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white"
            style={{ background: '#5B4FBE' }}
          >
            + 강의 등록
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2.5">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none"
          >
            <option value="">전체 과목</option>
            <option value="수학">수학</option>
            <option value="영어">영어</option>
            <option value="국어">국어</option>
            <option value="과학">과학</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none"
          >
            <option value="">전체 상태</option>
            <option value="PUBLISHED">게시됨</option>
            <option value="DRAFT">임시저장</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="강의명 검색"
            className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none w-44"
          />
        </div>

        {/* Lecture Grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">
            {lectures.length === 0 ? '등록된 강의가 없습니다' : '검색 결과가 없습니다'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3.5">
            {filtered.map((lec) => (
              <div
                key={lec.id}
                className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden cursor-pointer transition-all hover:border-[#a78bfa] hover:shadow-md"
              >
                {/* Thumbnail */}
                <div
                  className="h-[110px] flex items-center justify-center relative"
                  style={{ background: lec.status === 'DRAFT' ? '#2a2040' : '#1e1b2e' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(167,139,250,0.25)',
                      border: '2px solid rgba(167,139,250,0.5)',
                      opacity: lec.status === 'DRAFT' ? 0.5 : 1,
                    }}
                  >
                    <span style={{ borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: '15px solid #a78bfa', marginLeft: 3, display: 'inline-block' }} />
                  </div>
                  <span
                    className="absolute bottom-2 right-2.5 text-[10.5px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.4)', color: lec.status === 'DRAFT' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)' }}
                  >
                    {lec.duration}
                  </span>
                  {lec.subjects.length > 0 && (
                    <span
                      className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(167,139,250,0.25)', color: '#c4b5fd' }}
                    >
                      {lec.subjects[0]}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="p-3">
                  <p className="text-[13px] font-semibold text-[#111827] mb-2 leading-snug line-clamp-2">
                    {lec.title}
                  </p>
                  {/* Footer */}
                  <div className="flex justify-between items-center pt-2 border-t border-[#f1f5f9]">
                    {lec.status === 'PUBLISHED' ? (
                      <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#D1FAE5', color: '#065f46' }}>게시됨</span>
                    ) : (
                      <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#FEF3C7', color: '#92400e' }}>임시저장</span>
                    )}
                    <div className="flex gap-1.5">
                      <button className="px-2 py-1 rounded-[6px] text-[11px] border border-[#e2e8f0] bg-white text-[#6b7280] hover:bg-gray-50">수정</button>
                      <button className="px-2 py-1 rounded-[6px] text-[11px] border border-[#e2e8f0] bg-white text-[#6b7280] hover:bg-gray-50">
                        {lec.status === 'DRAFT' ? '게시' : '시험'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
