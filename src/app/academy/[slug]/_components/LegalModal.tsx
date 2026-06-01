'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { type Profile, C, FONT } from '../_shared';

/* ─────────────────────────────────────────────────
   LegalModal — 이용약관 / 개인정보처리방침 팝업
   학원별 사업자 정보(상호·대표자·사업자번호·연락처)를 본문에 주입한다.
───────────────────────────────────────────────── */
export type LegalDocType = 'terms' | 'privacy';

export default function LegalModal({
  type, profile, onClose,
}: { type: LegalDocType; profile: Profile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const academyName  = profile.name || '본 학원';
  const director     = profile.directorName || '-';
  const bizNumber    = profile.businessNumber || '-';
  const contact      = profile.phone || '-';
  const addr         = profile.address || '-';

  const title = type === 'terms' ? '이용약관' : '개인정보 처리방침';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, fontFamily: FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card, borderRadius: 18,
          width: '100%', maxWidth: 680, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px 14px', borderBottom: `1px solid ${C.border}`,
          gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.4px' }}>
            {academyName} {title}
          </span>
          <button onClick={onClose} aria-label="닫기" style={{
            background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer',
            padding: 4, borderRadius: 6,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ overflowY: 'auto', padding: '18px 22px 24px', flex: 1 }}>
          {type === 'terms'
            ? <TermsBody academyName={academyName} contact={contact} />
            : <PrivacyBody academyName={academyName} director={director} bizNumber={bizNumber} contact={contact} addr={addr} />}
        </div>
      </div>
    </div>
  );
}

/* ── 공용 섹션 렌더 ── */
function Article({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>{heading}</h3>
      <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.85, whiteSpace: 'pre-line' }}>
        {children}
      </div>
    </section>
  );
}

/* ── 이용약관 본문 ── */
function TermsBody({ academyName, contact }: { academyName: string; contact: string }) {
  return (
    <>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.7 }}>
        본 약관은 {academyName}(이하 “학원”)이 제공하는 수강 신청 및 수강료 결제 서비스의 이용 조건을 규정합니다.
      </p>
      <Article heading="제1조 (목적)">
        본 약관은 학원이 운영하는 온라인 페이지를 통해 제공하는 수강 안내, 상담 신청, 수강료 결제 등 서비스의 이용과 관련하여 학원과 이용자(학부모·학생) 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
      </Article>
      <Article heading="제2조 (서비스의 내용)">
        {`학원은 다음의 서비스를 제공합니다.
1. 수강 과목 및 커리큘럼 안내
2. 상담 신청 접수
3. 수강료 등 청구 내역 조회 및 결제
4. 공지사항, 학습·출결 정보 등 안내`}
      </Article>
      <Article heading="제3조 (결제)">
        {`1. 수강료 등의 결제는 토스페이먼츠(주)의 결제 시스템을 통해 처리됩니다.
2. 이용자는 카드, 계좌이체 등 학원이 제공하는 결제수단으로 결제할 수 있습니다.
3. 결제 완료 후 영수증은 페이지 내에서 확인할 수 있습니다.`}
      </Article>
      <Article heading="제4조 (환불)">
        {`1. 수강료의 환불은 「학원의 설립·운영 및 과외교습에 관한 법률」 및 같은 법 시행령에서 정한 반환 기준에 따릅니다.
2. 환불 사유 발생 시 학원에 문의하여 절차를 진행하며, 결제 취소는 결제수단별 정책에 따라 처리됩니다.`}
      </Article>
      <Article heading="제5조 (이용자의 의무)">
        {`이용자는 결제 및 상담 신청 시 정확한 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.`}
      </Article>
      <Article heading="제6조 (개인정보의 보호)">
        {`학원은 이용자의 개인정보를 관계 법령에 따라 보호하며, 구체적인 내용은 「개인정보 처리방침」에 따릅니다.`}
      </Article>
      <Article heading="제7조 (문의)">
        {`서비스 이용 및 결제 관련 문의는 아래 연락처로 가능합니다.
· 연락처: ${contact}`}
      </Article>
      <p style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>
        본 약관은 게시일부터 적용됩니다.
      </p>
    </>
  );
}

/* ── 개인정보 처리방침 본문 ── */
function PrivacyBody({
  academyName, director, bizNumber, contact, addr,
}: { academyName: string; director: string; bizNumber: string; contact: string; addr: string }) {
  return (
    <>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.7 }}>
        {academyName}(이하 “학원”)은 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 관련 권익을 보장하기 위해 다음과 같이 개인정보 처리방침을 둡니다.
      </p>
      <Article heading="제1조 (수집하는 개인정보 항목)">
        {`· 상담 신청 시: 학생 이름, 연락처, 문의 내용
· 결제 시: 결제 정보(결제 승인 내역, 결제수단 정보)
· 서비스 이용 과정에서 출결·성적·수강 정보 등이 처리될 수 있습니다.`}
      </Article>
      <Article heading="제2조 (개인정보의 수집 및 이용 목적)">
        {`1. 수강 상담 및 안내
2. 수강료 등의 청구 및 결제 처리
3. 학습·출결 관리 및 공지 전달
4. 민원 처리 및 고객 문의 응대`}
      </Article>
      <Article heading="제3조 (개인정보의 보유 및 이용 기간)">
        {`수집된 개인정보는 수집·이용 목적이 달성되면 지체 없이 파기합니다. 다만 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.
· 전자상거래 등에서의 결제·정산 기록: 관계 법령에서 정한 기간`}
      </Article>
      <Article heading="제4조 (개인정보의 제3자 제공 및 처리 위탁)">
        {`학원은 원활한 결제 처리를 위해 아래와 같이 업무를 위탁합니다.
· 수탁사: 토스페이먼츠(주)
· 위탁 업무: 결제 처리 및 결제 도용 방지
이 경우 결제에 필요한 최소한의 정보만 제공되며, 위탁 목적 외의 용도로 이용되지 않습니다.`}
      </Article>
      <Article heading="제5조 (정보주체의 권리)">
        {`이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있으며, 학원은 관계 법령에 따라 지체 없이 조치합니다.`}
      </Article>
      <Article heading="제6조 (개인정보 보호책임자)">
        {`· 상호: ${academyName}
· 대표자(개인정보 보호책임자): ${director}
· 사업자등록번호: ${bizNumber}
· 주소: ${addr}
· 연락처: ${contact}`}
      </Article>
      <p style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>
        본 방침은 게시일부터 적용됩니다.
      </p>
    </>
  );
}
