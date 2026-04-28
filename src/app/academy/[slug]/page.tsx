'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Phone, Clock, BookOpen, Megaphone,
  ExternalLink, ChevronRight, Building2, FileText,
  GraduationCap, Camera, AlertCircle,
} from 'lucide-react';

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  fee: number | null;
  color: string;
  schedule: string;
};

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  pinned: boolean;
};

type Profile = {
  name: string;
  slug: string;
  intro: string;
  phone: string;
  address: string;
  directorName: string;
  businessNumber: string;
  operatingHours: string;
  refundPolicy: string;
  showFees: boolean;
  kakaoMapUrl: string;
  galleryImages: string[];
  classes: ClassItem[];
  announcements: AnnouncementItem[];
};

function Section({ title, icon, children }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#4fc3a1]">{icon}</span>
        <h2 className="text-[17px] font-bold text-[#111827]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function AcademyPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch(`/api/academy/${slug}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setProfile(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="w-8 h-8 border-4 border-[#4fc3a1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f8fafc] px-6">
        <AlertCircle size={48} className="text-[#d1d5db]" />
        <p className="text-[16px] font-bold text-[#374151]">페이지를 찾을 수 없습니다</p>
        <p className="text-[13px] text-[#9ca3af] text-center">
          준비 중이거나 존재하지 않는 학원 페이지입니다.
        </p>
      </div>
    );
  }

  const validImages = profile.galleryImages.filter(Boolean);
  const kakaoSearchUrl = `https://map.kakao.com/link/search/${encodeURIComponent(profile.address)}`;

  return (
    <div className="min-h-screen bg-[#f8fafc]">

      {/* ── 상단 네비게이션 ── */}
      <nav className="sticky top-0 z-50 bg-[#1a2535] px-5 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-2">
          <GraduationCap size={20} className="text-[#4fc3a1]" />
          <span className="text-[15px] font-bold text-white">{profile.name}</span>
        </div>
        <Link href="/login">
          <button className="px-4 py-1.5 rounded-[8px] text-[12.5px] font-semibold bg-[#4fc3a1] text-white cursor-pointer hover:bg-[#3aab8a] transition-colors">
            학부모·학생 로그인
          </button>
        </Link>
      </nav>

      {/* ── 히어로 ── */}
      <div className="bg-[#1a2535] px-6 pt-12 pb-14 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#4fc3a1]/20 mb-4">
          <GraduationCap size={32} className="text-[#4fc3a1]" />
        </div>
        <h1 className="text-[28px] font-bold text-white mb-2">{profile.name}</h1>
        {profile.intro && (
          <p className="text-[15px] text-white/70 mb-4 max-w-lg mx-auto">{profile.intro}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[13px] text-white/60">
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="flex items-center gap-1.5 hover:text-[#4fc3a1] transition-colors">
              <Phone size={13} /> {profile.phone}
            </a>
          )}
          {profile.address && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {profile.address}
            </span>
          )}
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="max-w-3xl mx-auto px-5 py-10">

        {/* ── 수강 과목 ── */}
        {profile.classes.length > 0 && (
          <Section title="수강 과목" icon={<BookOpen size={18} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profile.classes.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-white rounded-[12px] border border-[#e2e8f0] p-4 flex items-start gap-3"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: cls.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-semibold text-[#111827]">{cls.name}</p>
                        <p className="text-[12px] text-[#6b7280] mt-0.5">
                          {cls.subject}{cls.grade ? ` · ${cls.grade}` : ''}
                        </p>
                      </div>
                      {cls.fee !== null && (
                        <span className="text-[13px] font-bold text-[#0D9E7A] shrink-0">
                          {cls.fee.toLocaleString()}원
                        </span>
                      )}
                    </div>
                    {cls.schedule && (
                      <p className="text-[11.5px] text-[#9ca3af] mt-1.5 flex items-center gap-1">
                        <Clock size={11} /> {cls.schedule}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 학원 사진 갤러리 ── */}
        {validImages.length > 0 && (
          <Section title="학원 사진" icon={<Camera size={18} />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {validImages.map((url, i) => (
                !imgErrors[i] ? (
                  <div key={i} className="aspect-[4/3] rounded-[10px] overflow-hidden bg-[#f1f5f9]">
                    <img
                      src={url}
                      alt={`${profile.name} 사진 ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={() => setImgErrors((prev) => ({ ...prev, [i]: true }))}
                    />
                  </div>
                ) : null
              ))}
            </div>
          </Section>
        )}

        {/* ── 공지사항 ── */}
        {profile.announcements.length > 0 && (
          <Section title="공지사항" icon={<Megaphone size={18} />}>
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] divide-y divide-[#f1f5f9]">
              {profile.announcements.map((a) => (
                <div key={a.id} className="px-4 py-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    {a.pinned && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E]">
                        공지
                      </span>
                    )}
                    <p className="text-[13.5px] font-semibold text-[#111827] truncate flex-1">{a.title}</p>
                    <span className="text-[11px] text-[#9ca3af] shrink-0">{a.publishedAt}</span>
                  </div>
                  {a.content && (
                    <p className="text-[12px] text-[#6b7280] line-clamp-2 leading-relaxed">{a.content}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 오시는 길 (카카오맵) ── */}
        {profile.address && (
          <Section title="오시는 길" icon={<MapPin size={18} />}>
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
              <div className="h-[160px] bg-[#f8fafc] flex flex-col items-center justify-center gap-3">
                <MapPin size={32} className="text-[#d1d5db]" />
                <a
                  href={profile.kakaoMapUrl || kakaoSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#FAE100] text-[#3C1E1E] text-[13px] font-semibold hover:opacity-90 transition-opacity"
                >
                  <ExternalLink size={14} /> 카카오맵에서 보기
                </a>
              </div>
              <div className="px-4 py-3 flex items-start gap-2 border-t border-[#f1f5f9]">
                <MapPin size={14} className="text-[#9ca3af] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#374151]">{profile.address}</p>
              </div>
            </div>
          </Section>
        )}

        {/* ── 운영 정보 ── */}
        {profile.operatingHours && (
          <Section title="운영 시간" icon={<Clock size={18} />}>
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] px-4 py-4">
              <p className="text-[13.5px] text-[#374151] whitespace-pre-line leading-relaxed">
                {profile.operatingHours}
              </p>
            </div>
          </Section>
        )}

        {/* ── 환불 정책 ── */}
        {profile.refundPolicy && (
          <Section title="환불 정책" icon={<FileText size={18} />}>
            <div className="bg-[#FEF3C7]/50 border border-[#FDE68A] rounded-[12px] px-4 py-4">
              <p className="text-[13px] text-[#374151] whitespace-pre-line leading-relaxed">
                {profile.refundPolicy}
              </p>
            </div>
          </Section>
        )}

        {/* ── 로그인 CTA ── */}
        <div className="bg-[#1a2535] rounded-[16px] p-6 text-center mb-10">
          <p className="text-[15px] font-bold text-white mb-1">{profile.name}에 다니고 계신가요?</p>
          <p className="text-[12.5px] text-white/60 mb-4">성적·출결·수납 내역을 앱에서 확인하세요.</p>
          <Link href="/login">
            <button className="px-6 py-3 rounded-[10px] bg-[#4fc3a1] text-white text-[14px] font-bold cursor-pointer hover:bg-[#3aab8a] transition-colors">
              학부모·학생 로그인 <ChevronRight size={16} className="inline -mt-0.5" />
            </button>
          </Link>
        </div>

        {/* ── 사업자 정보 (PG 심사 필수) ── */}
        <footer className="border-t border-[#e2e8f0] pt-6 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} className="text-[#9ca3af]" />
            <span className="text-[12px] font-semibold text-[#6b7280]">사업자 정보</span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
            {[
              { label: '상호', value: profile.name },
              { label: '대표자', value: profile.directorName },
              { label: '사업자등록번호', value: profile.businessNumber },
              { label: '주소', value: profile.address },
              { label: '전화', value: profile.phone },
            ].filter(({ value }) => value).map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <dt className="text-[#9ca3af] shrink-0 w-24">{label}</dt>
                <dd className="text-[#6b7280]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-[#d1d5db] mt-4">
            Powered by AcaMS
          </p>
        </footer>
      </div>
    </div>
  );
}
