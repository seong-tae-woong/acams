'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Phone, ExternalLink,
  ChevronRight, ChevronLeft, ChevronDown,
  Building2, Camera, AlertCircle, X,
  CheckCircle, Shield, Send,
} from 'lucide-react';

/* ─────────────────────────────────────────────────
   Types
───────────────────────────────────────────────── */
type ClassItem = {
  id: string; name: string; subject: string; grade: string;
  fee: number | null; color: string; schedule: string;
};
type AnnouncementItem = {
  id: string; title: string; content: string; publishedAt: string; pinned: boolean;
};
type Profile = {
  name: string; slug: string; intro: string; phone: string; address: string;
  directorName: string; businessNumber: string; operatingHours: string;
  refundPolicy: string; showFees: boolean; kakaoMapUrl: string;
  galleryImages: string[]; classes: ClassItem[]; announcements: AnnouncementItem[];
};

/* ─────────────────────────────────────────────────
   Design tokens
───────────────────────────────────────────────── */
const C = {
  heroBg:      '#12103A',   // deep indigo-black
  accent:      '#4F46E5',   // indigo-600
  accentHover: '#4338CA',
  accentLight: '#EEF2FF',
  bg:          '#F7F8FA',
  card:        '#FFFFFF',
  text:        '#111827',
  sub:         '#6B7280',
  muted:       '#9CA3AF',
  border:      '#E5E7EB',
  shadow:      '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.06)',
  shadowMd:    '0 4px 24px rgba(0,0,0,0.10)',
} as const;

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

/* ─────────────────────────────────────────────────
   FloatingInput — label이 위로 올라가는 입력 필드
───────────────────────────────────────────────── */
function FloatingInput({
  label, type = 'text', value, onChange, required,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '20px 16px 8px', fontSize: 14,
          borderRadius: 12, border: `2px solid ${focused ? C.accent : C.border}`,
          outline: 'none', fontFamily: FONT, color: C.text, background: C.card,
          boxShadow: focused ? `0 0 0 3px ${C.accentLight}` : 'none',
          transition: 'border-color 0.18s, box-shadow 0.18s',
        }}
      />
      <label
        style={{
          position: 'absolute', left: 16, pointerEvents: 'none',
          top: lifted ? 7 : 14,
          fontSize: lifted ? 11 : 14,
          fontWeight: lifted ? 600 : 400,
          color: focused ? C.accent : lifted ? C.sub : C.muted,
          fontFamily: FONT,
          transition: 'all 0.18s',
        }}
      >
        {label}{required && <span style={{ color: C.accent }}> *</span>}
      </label>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   FloatingTextarea
───────────────────────────────────────────────── */
function FloatingTextarea({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={4}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '24px 16px 10px', fontSize: 14,
          borderRadius: 12, border: `2px solid ${focused ? C.accent : C.border}`,
          outline: 'none', fontFamily: FONT, color: C.text, background: C.card,
          resize: 'none',
          boxShadow: focused ? `0 0 0 3px ${C.accentLight}` : 'none',
          transition: 'border-color 0.18s, box-shadow 0.18s',
        }}
      />
      <label
        style={{
          position: 'absolute', left: 16, pointerEvents: 'none',
          top: lifted ? 7 : 14,
          fontSize: lifted ? 11 : 14,
          fontWeight: lifted ? 600 : 400,
          color: focused ? C.accent : lifted ? C.sub : C.muted,
          fontFamily: FONT,
          transition: 'all 0.18s',
        }}
      >
        {label}
      </label>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   SectionHeader
───────────────────────────────────────────────── */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{
        fontSize: 19, fontWeight: 800, color: C.text,
        letterSpacing: '-0.4px', fontFamily: FONT, margin: 0,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: C.sub, marginTop: 4, fontFamily: FONT }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   ClassCard — 인보이스 스타일 수업 카드
───────────────────────────────────────────────── */
function ClassCard({ cls, showFee }: { cls: ClassItem; showFee: boolean }) {
  return (
    <div style={{
      background: C.card, borderRadius: 16, boxShadow: C.shadow,
      overflow: 'hidden', fontFamily: FONT, display: 'flex', flexDirection: 'column',
    }}>
      {/* 컬러 상단 바 */}
      <div style={{ height: 4, background: cls.color, flexShrink: 0 }} />

      <div style={{ padding: '16px 18px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 수업명 + 수강료 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.3px', lineHeight: 1.3 }}>
            {cls.name}
          </p>
          {showFee && cls.fee !== null && (
            <span style={{
              fontSize: 16, fontWeight: 800, color: C.accent,
              whiteSpace: 'nowrap', letterSpacing: '-0.4px',
            }}>
              {cls.fee.toLocaleString()}원
            </span>
          )}
        </div>

        {/* 상세 정보 */}
        <div style={{
          borderTop: `1px solid ${C.border}`, paddingTop: 10,
          display: 'flex', flexDirection: 'column', gap: 6, flex: 1,
        }}>
          {(cls.subject || cls.grade) && (
            <Row label="과목" value={`${cls.subject}${cls.grade ? ` · ${cls.grade}` : ''}`} />
          )}
          {cls.schedule && <Row label="일정" value={cls.schedule} />}
          {showFee && cls.fee !== null && (
            <Row label="수강료" value={`${cls.fee.toLocaleString()}원 / 월`} bold />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ fontSize: 12, color: C.muted, minWidth: 36, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: bold ? C.text : C.sub, fontWeight: bold ? 600 : 400 }}>{value}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────── */
export default function AcademyPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  // 슬라이드쇼
  const [heroSlide, setHeroSlide] = useState(0);

  // 갤러리 팝업
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // 상담 신청 폼
  const [inquiry, setInquiry] = useState({ name: '', phone: '', classId: '', message: '' });
  const [inquiryDone, setInquiryDone]       = useState(false);
  const [inquirySubmitting, setInquirySubmitting] = useState(false);

  /* ── Pretendard 폰트 주입 ── */
  useEffect(() => {
    const id = 'pretendard-font';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id   = id;
      link.rel  = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
      document.head.appendChild(link);
    }
  }, []);

  /* ── 데이터 fetch ── */
  useEffect(() => {
    fetch(`/api/academy/${slug}`)
      .then((r) => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then((data) => { if (data) setProfile(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  /* ── 히어로 슬라이드 자동 전환 (4.5s) ── */
  useEffect(() => {
    const imgs = profile?.galleryImages.filter(Boolean) ?? [];
    if (imgs.length <= 1) return;
    const t = setInterval(() => setHeroSlide((p) => (p + 1) % imgs.length), 4500);
    return () => clearInterval(t);
  }, [profile]);

  /* ── 갤러리 팝업 키보드 + scroll lock ── */
  useEffect(() => {
    if (!galleryOpen || !profile) return;
    const imgs = profile.galleryImages.filter(Boolean);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     setGalleryOpen(false);
      if (e.key === 'ArrowLeft')  setGalleryIndex((i) => (i - 1 + imgs.length) % imgs.length);
      if (e.key === 'ArrowRight') setGalleryIndex((i) => (i + 1) % imgs.length);
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [galleryOpen, profile]);

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
    </div>
  );

  /* ── 404 ── */
  if (notFound || !profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: C.bg, padding: '0 24px', fontFamily: FONT }}>
      <AlertCircle size={48} color={C.border} />
      <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>페이지를 찾을 수 없습니다</p>
      <p style={{ fontSize: 13, color: C.muted, textAlign: 'center' }}>준비 중이거나 존재하지 않는 학원 페이지입니다.</p>
    </div>
  );

  const validImages    = profile.galleryImages.filter(Boolean);
  const kakaoSearchUrl = `https://map.kakao.com/link/search/${encodeURIComponent(profile.address)}`;
  const openGallery    = (i: number) => { setGalleryIndex(i); setGalleryOpen(true); };

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquirySubmitting(true);
    try {
      const selectedClass = profile!.classes.find((c) => c.id === inquiry.classId);
      const res = await fetch(`/api/academy/${slug}/inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      inquiry.name.trim(),
          phone:     inquiry.phone.trim(),
          classId:   inquiry.classId || null,
          className: selectedClass?.name || null,
          message:   inquiry.message.trim(),
        }),
      });
      if (res.ok) {
        setInquiryDone(true);
      } else {
        const err = await res.json();
        alert(err.error ?? '신청에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch {
      alert('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setInquirySubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', letterSpacing: '-0.2px' }}>

      {/* ══════════════════════════════════════════
          상단 고정 네비게이션
      ══════════════════════════════════════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: C.heroBg,
        padding: '0 20px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 0 rgba(255,255,255,0.05)',
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
          {profile.name}
        </span>
        <Link href="/login" style={{ textDecoration: 'none' }}>
          <button style={{
            padding: '7px 15px', borderRadius: 8,
            background: C.accent, color: '#fff',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: 'none', fontFamily: FONT,
          }}>
            학부모·학생 로그인
          </button>
        </Link>
      </nav>

      {/* ══════════════════════════════════════════
          히어로 — 슬라이드쇼 배경 + 프리미엄 텍스트
      ══════════════════════════════════════════ */}
      <div style={{
        position: 'relative', background: C.heroBg,
        minHeight: 320, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}>
        {/* 슬라이드 이미지 */}
        {validImages.map((url, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0,
            transition: 'opacity 1.2s ease',
            opacity: i === heroSlide ? 1 : 0,
          }}>
            <img src={url} alt="" draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}

        {/* 그라디언트 오버레이 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(18,16,58,0.35) 0%, rgba(18,16,58,0.80) 100%)',
        }} />

        {/* 콘텐츠 */}
        <div style={{ position: 'relative', zIndex: 10, padding: '48px 24px 36px', textAlign: 'center' }}>

          {/* 배지 */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 99, padding: '5px 13px',
            marginBottom: 18,
            fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.92)',
            letterSpacing: '0.2px',
          }}>
            <CheckCircle size={12} /> 교육청 등록 정식 학원
          </div>

          {/* 학원명 */}
          <h1 style={{
            fontSize: 32, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.8px', lineHeight: 1.15, marginBottom: 10,
          }}>
            {profile.name}
          </h1>

          {/* 소개 */}
          {profile.intro && (
            <p style={{
              fontSize: 14.5, color: 'rgba(255,255,255,0.70)',
              maxWidth: 480, margin: '0 auto 22px', lineHeight: 1.65,
            }}>
              {profile.intro}
            </p>
          )}

          {/* 연락처 칩 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: validImages.length > 0 ? 22 : 0 }}>
            {profile.phone && (
              <a href={`tel:${profile.phone}`} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 99, padding: '6px 15px',
                fontSize: 12.5, color: 'rgba(255,255,255,0.88)', textDecoration: 'none',
              }}>
                <Phone size={12} /> {profile.phone}
              </a>
            )}
            {profile.address && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 99, padding: '6px 15px',
                fontSize: 12.5, color: 'rgba(255,255,255,0.88)',
              }}>
                <MapPin size={12} /> {profile.address}
              </span>
            )}
          </div>

          {/* 사진 보기 버튼 */}
          {validImages.length > 0 && (
            <button onClick={() => openGallery(heroSlide)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 99, padding: '7px 16px',
              fontSize: 12.5, fontWeight: 500,
              color: 'rgba(255,255,255,0.90)', cursor: 'pointer', fontFamily: FONT,
            }}>
              <Camera size={13} /> 학원 사진 {validImages.length}장 보기
            </button>
          )}
        </div>

        {/* 슬라이드 인디케이터 도트 */}
        {validImages.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 12, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 6, zIndex: 10,
          }}>
            {validImages.map((_, i) => (
              <button key={i} onClick={() => setHeroSlide(i)} style={{
                height: 5, width: i === heroSlide ? 20 : 5,
                borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
                background: i === heroSlide ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          본문 컨테이너
      ══════════════════════════════════════════ */}
      <div style={{ maxWidth: 768, margin: '0 auto', padding: '44px 20px 140px' }}>

        {/* ── 수강 과목 ── */}
        {profile.classes.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <SectionHeader title="수강 과목" subtitle="현재 모집 중인 수업 목록입니다." />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}>
              {profile.classes.map((cls) => (
                <ClassCard key={cls.id} cls={cls} showFee={profile.showFees} />
              ))}
            </div>
          </section>
        )}

        {/* ── 상담 신청 폼 ── */}
        <section style={{ marginBottom: 52 }}>
          <SectionHeader title="상담 신청" subtitle="수업에 대해 궁금한 점을 남겨주시면 빠르게 연락드립니다." />

          {inquiryDone ? (
            <div style={{
              background: C.accentLight, border: `1px solid ${C.accent}30`,
              borderRadius: 16, padding: '32px 24px', textAlign: 'center',
            }}>
              <CheckCircle size={40} color={C.accent} style={{ margin: '0 auto 14px', display: 'block' }} />
              <p style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6, fontFamily: FONT }}>
                상담 신청이 완료되었습니다
              </p>
              <p style={{ fontSize: 13.5, color: C.sub, fontFamily: FONT }}>
                빠른 시일 내에 연락드리겠습니다.
              </p>
            </div>
          ) : (
            <form onSubmit={handleInquiry} style={{
              background: C.card, borderRadius: 16, padding: '24px 20px',
              boxShadow: C.shadow, display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FloatingInput label="학생 이름" value={inquiry.name} onChange={(v) => setInquiry((f) => ({ ...f, name: v }))} required />
                <FloatingInput label="연락처" type="tel" value={inquiry.phone} onChange={(v) => setInquiry((f) => ({ ...f, phone: v }))} required />
              </div>

              {profile.classes.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <select
                    value={inquiry.classId}
                    onChange={(e) => setInquiry((f) => ({ ...f, classId: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '14px 40px 14px 16px', fontSize: 14,
                      borderRadius: 12, border: `2px solid ${C.border}`,
                      background: C.card, color: inquiry.classId ? C.text : C.muted,
                      outline: 'none', fontFamily: FONT,
                      appearance: 'none', cursor: 'pointer',
                      transition: 'border-color 0.18s',
                    }}
                  >
                    <option value="">관심 수업 선택 (선택사항)</option>
                    {profile.classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    color: C.muted, pointerEvents: 'none',
                  }} />
                </div>
              )}

              <FloatingTextarea label="문의 내용 (선택사항)" value={inquiry.message} onChange={(v) => setInquiry((f) => ({ ...f, message: v }))} />

              <button
                type="submit"
                disabled={!inquiry.name.trim() || !inquiry.phone.trim() || inquirySubmitting}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px 0', borderRadius: 12,
                  background: (!inquiry.name.trim() || !inquiry.phone.trim() || inquirySubmitting) ? C.border : C.accent,
                  color:      (!inquiry.name.trim() || !inquiry.phone.trim() || inquirySubmitting) ? C.muted  : '#fff',
                  fontSize: 14.5, fontWeight: 700, border: 'none', fontFamily: FONT,
                  cursor: (!inquiry.name.trim() || !inquiry.phone.trim() || inquirySubmitting) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {inquirySubmitting
                  ? '신청 중...'
                  : <><Send size={15} /> 상담 신청하기</>}
              </button>
            </form>
          )}
        </section>

        {/* ── 공지사항 ── */}
        {profile.announcements.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <SectionHeader title="공지사항" />
            <div style={{ background: C.card, borderRadius: 16, boxShadow: C.shadow, overflow: 'hidden' }}>
              {profile.announcements.map((a, i) => (
                <div key={a.id} style={{
                  padding: '16px 20px',
                  borderBottom: i < profile.announcements.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: a.content ? 5 : 0 }}>
                    {a.pinned && (
                      <span style={{
                        padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                        fontSize: 10.5, fontWeight: 700,
                        background: '#FEF3C7', color: '#92400E', letterSpacing: '0.2px',
                      }}>공지</span>
                    )}
                    <p style={{
                      fontSize: 13.5, fontWeight: 600, color: C.text, flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{a.title}</p>
                    <span style={{ fontSize: 11.5, color: C.muted, flexShrink: 0 }}>{a.publishedAt}</span>
                  </div>
                  {a.content && (
                    <p style={{
                      fontSize: 12.5, color: C.sub, lineHeight: 1.65,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                    }}>{a.content}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 학원 사진 그리드 ── */}
        {validImages.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <SectionHeader title="학원 사진" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {validImages.map((url, i) => (
                !imgErrors[i] ? (
                  <div key={i} onClick={() => openGallery(i)} style={{
                    aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden',
                    background: C.border, cursor: 'pointer',
                  }}>
                    <img
                      src={url} alt={`${profile.name} 사진 ${i + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      onError={() => setImgErrors((prev) => ({ ...prev, [i]: true }))}
                    />
                  </div>
                ) : null
              ))}
            </div>
          </section>
        )}

        {/* ── 오시는 길 ── */}
        {profile.address && (
          <section style={{ marginBottom: 52 }}>
            <SectionHeader title="오시는 길" />
            <div style={{ background: C.card, borderRadius: 16, boxShadow: C.shadow, overflow: 'hidden' }}>
              <div style={{
                height: 140, background: '#F1F5F9',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14,
              }}>
                <MapPin size={28} color={C.border} />
                <a
                  href={profile.kakaoMapUrl || kakaoSearchUrl}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 8,
                    background: '#FAE100', color: '#3C1E1E',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={13} /> 카카오맵에서 보기
                </a>
              </div>
              <div style={{ padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'flex-start', borderTop: `1px solid ${C.border}` }}>
                <MapPin size={14} color={C.muted} style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13, color: C.sub }}>{profile.address}</p>
              </div>
            </div>
          </section>
        )}

        {/* ── 운영 시간 ── */}
        {profile.operatingHours && (
          <section style={{ marginBottom: 52 }}>
            <SectionHeader title="운영 시간" />
            <div style={{ background: C.card, borderRadius: 16, boxShadow: C.shadow, padding: '20px 22px' }}>
              <p style={{ fontSize: 13.5, color: C.sub, whiteSpace: 'pre-line', lineHeight: 1.85 }}>
                {profile.operatingHours}
              </p>
            </div>
          </section>
        )}

        {/* ── 환불 정책 ── */}
        {profile.refundPolicy && (
          <section style={{ marginBottom: 52 }}>
            <SectionHeader title="환불 정책" />
            <div style={{
              background: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: 16, padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                <Shield size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, fontWeight: 600, color: '#92400E', lineHeight: 1.4 }}>
                  학원법에 따른 환불 규정이 적용됩니다
                </p>
              </div>
              <p style={{ fontSize: 13, color: '#78350F', whiteSpace: 'pre-line', lineHeight: 1.85 }}>
                {profile.refundPolicy}
              </p>
            </div>
          </section>
        )}

        {/* ── 사업자 정보 + Legal Footer ── */}
        <footer style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28, paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Building2 size={14} color={C.muted} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: '0.2px' }}>사업자 정보</span>
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 24px', marginBottom: 18 }}>
            {[
              { label: '상호',         value: profile.name },
              { label: '대표자',       value: profile.directorName },
              { label: '사업자번호',   value: profile.businessNumber },
              { label: '주소',         value: profile.address },
              { label: '전화',         value: profile.phone },
            ].filter(({ value }) => value).map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 8 }}>
                <dt style={{ fontSize: 11.5, color: C.muted, minWidth: 58, flexShrink: 0 }}>{label}</dt>
                <dd style={{ fontSize: 11.5, color: C.sub }}>{value}</dd>
              </div>
            ))}
          </dl>

          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <a href="#" style={{ fontSize: 11.5, color: C.muted, textDecoration: 'underline', textUnderlineOffset: 2 }}>이용약관</a>
            <a href="#" style={{ fontSize: 11.5, color: C.muted, textDecoration: 'underline', textUnderlineOffset: 2 }}>개인정보 처리방침</a>
          </div>

          <p style={{ fontSize: 11, color: C.border }}>Powered by AcaMS</p>
        </footer>
      </div>

      {/* ══════════════════════════════════════════
          모바일 하단 고정 CTA
      ══════════════════════════════════════════ */}
      <div
        className="sm:hidden"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          padding: '10px 16px 22px',
          background: 'rgba(247,248,250,0.94)',
          backdropFilter: 'blur(12px)',
          borderTop: `1px solid ${C.border}`,
          display: 'flex', gap: 10,
        }}
      >
        {profile.phone && (
          <a href={`tel:${profile.phone}`} style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '14px 0', borderRadius: 12,
            background: C.card, border: `1.5px solid ${C.border}`,
            fontSize: 14, fontWeight: 600, color: C.text, textDecoration: 'none',
            fontFamily: FONT,
          }}>
            <Phone size={15} /> 전화 문의
          </a>
        )}
        <Link href="/login" style={{ flex: 2, textDecoration: 'none' }}>
          <button style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: C.accent, color: '#fff',
            fontSize: 14, fontWeight: 700,
            cursor: 'pointer', border: 'none', fontFamily: FONT,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            학부모·학생 로그인 <ChevronRight size={16} />
          </button>
        </Link>
      </div>

      {/* ══════════════════════════════════════════
          갤러리 팝업 라이트박스
      ══════════════════════════════════════════ */}
      {galleryOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setGalleryOpen(false)}
        >
          {/* 닫기 */}
          <button onClick={() => setGalleryOpen(false)} style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 10 }}>
            <X size={18} />
          </button>

          {/* 카운터 */}
          <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.5)', userSelect: 'none' }}>
            {galleryIndex + 1} / {validImages.length}
          </div>

          {/* 메인 이미지 */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 720, padding: '0 56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => e.stopPropagation()}>
            {validImages.length > 1 && (
              <button onClick={() => setGalleryIndex((i) => (i - 1 + validImages.length) % validImages.length)}
                style={{ position: 'absolute', left: 8, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <ChevronLeft size={22} />
              </button>
            )}
            <img src={validImages[galleryIndex]} alt={`${profile.name} 사진 ${galleryIndex + 1}`}
              style={{ maxHeight: '72vh', maxWidth: '100%', borderRadius: 10, objectFit: 'contain', userSelect: 'none', display: 'block' }}
              draggable={false}
            />
            {validImages.length > 1 && (
              <button onClick={() => setGalleryIndex((i) => (i + 1) % validImages.length)}
                style={{ position: 'absolute', right: 8, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <ChevronRight size={22} />
              </button>
            )}
          </div>

          {/* 썸네일 스트립 */}
          {validImages.length > 1 && (
            <div style={{ position: 'absolute', bottom: 16, display: 'flex', gap: 8, padding: '0 16px', overflowX: 'auto', maxWidth: '100%' }}
              onClick={(e) => e.stopPropagation()}>
              {validImages.map((url, i) => (
                <div key={i} onClick={() => setGalleryIndex(i)} style={{
                  width: 56, height: 56, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                  cursor: 'pointer', transition: 'all 0.2s',
                  opacity: i === galleryIndex ? 1 : 0.4,
                  transform: i === galleryIndex ? 'scale(1.1)' : 'scale(1)',
                  outline: i === galleryIndex ? `2px solid ${C.accent}` : 'none', outlineOffset: 2,
                }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
