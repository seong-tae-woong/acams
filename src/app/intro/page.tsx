import type { Metadata } from 'next';
import './intro.css';
import ConsultForm from './_components/ConsultForm';
import BrandMark from '@/components/shared/BrandMark';

export const metadata: Metadata = {
  title: '학원로그 — 대형학원만 쓰던 무기를, 동네학원도',
  description:
    '데이터로 굴러가는 통합 운영, 강사 혼자 더 많은 학생을 가르치는 인강 수익까지. 대형학원만 누리던 운영 무기를 소규모 학원도 부담 없이 쓰는 통합 플랫폼, 학원로그.',
  keywords: ['학원관리', '학원관리프로그램', '학원로그', '출결관리', '학원비결제', '인강', '학원통합관리', '소규모학원'],
  openGraph: {
    title: '학원로그 — 대형학원만 쓰던 무기를, 동네학원도',
    description: '데이터 통합 운영부터 인강 추가 수익까지. 대형학원의 운영 무기를 동네학원도 부담 없이 쓰는 플랫폼.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '학원로그',
  },
  alternates: { canonical: '/intro' },
};

export default function IntroPage() {
  return (
    <div className="intro-page">
      {/* 네비 */}
      <div className="i-nav-bar">
        <div className="i-wrap">
          <nav className="i-nav">
            <div className="i-brand"><BrandMark size={30} />학원로그</div>
            <a className="i-nav-cta" href="#consult">상담 신청</a>
          </nav>
        </div>
      </div>

      {/* 히어로 — 미션 선언 */}
      <div className="i-wrap">
        <section className="i-hero">
          <span className="i-eyebrow">동네학원의 편에서</span>
          <h1>대형학원만 쓰던 무기를,<br /><span className="i-accent">동네학원도.</span></h1>
          <p className="i-hero-sub">데이터로 굴러가는 통합 관리, 그리고 강사 혼자 더 많은 학생을 가르치는 인강 수익까지. 수작업 없는 시스템 기반의 운영을, 작은 학원도 부담 없이 누리세요.</p>
          <div className="i-actions">
            <a className="i-btn-primary" href="#consult">무료로 데모 신청하기</a>
            <a className="i-btn-ghost" href="#features">기능 둘러보기</a>
          </div>

          <div className="i-shot">
            <div className="i-shot-bar"><i></i><i></i><i></i></div>
            <div className="i-shot-canvas">
              <div className="i-dash">
                <aside className="i-dash-side">
                  <div className="b">📚 학원로그</div>
                  <div className="it on">대시보드</div>
                  <div className="it">학생 관리</div>
                  <div className="it">출결</div>
                  <div className="it">성적 리포트</div>
                  <div className="it">학원비 청구</div>
                  <div className="it">인강 관리</div>
                </aside>
                <main className="i-dash-main">
                  <div className="i-kpis">
                    <div className="i-kpi"><div className="l">재원생</div><div className="v num">32</div><div className="d num">+3 이번 달</div></div>
                    <div className="i-kpi"><div className="l">이번 달 수납률</div><div className="v num">94%</div><div className="d num">+6%p</div></div>
                    <div className="i-kpi"><div className="l">오늘 출결</div><div className="v num">28<span style={{ fontSize: 14, color: 'var(--i-faint)' }}>/32</span></div><div className="d">자동 집계</div></div>
                  </div>
                  <div className="i-panel">
                    <div className="pt">월별 매출 추이</div>
                    <div className="i-bars">
                      {['45%', '58%', '52%', '71%', '80%', '96%'].map((h, idx) => (
                        <div key={idx} className="bar" style={{ '--h': h } as React.CSSProperties}></div>
                      ))}
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 격차 시각화 — 대형학원 vs 동네학원 */}
      <section className="i-sec i-gap-sec">
        <div className="i-wrap">
          <div className="i-head">
            <div className="i-kicker">대형학원 vs 동네학원</div>
            <h2>문제는 실력이 아니라,<br />무기의 격차였습니다</h2>
            <p>대형 프랜차이즈는 데이터와 인강으로 이미 앞서 있습니다. 같은 무기를, 동네학원도 부담 없이.</p>
          </div>
          <div className="i-gap">
            <div className="i-gap-col is-small">
              <span className="i-gap-tag tag-small">지금, 동네학원</span>
              <div className="i-pain-chips">
                <div className="i-pain-chip"><span className="ic">📄</span><div><b>종이 출석부</b><span className="sub">옮겨 적고 또 확인</span></div></div>
                <div className="i-pain-chip"><span className="ic">📊</span><div><b>엑셀 정산</b><span className="sub">숫자 어긋나 재검산</span></div></div>
                <div className="i-pain-chip"><span className="ic">💬</span><div><b>밤마다 카톡</b><span className="sub">한 명씩 저녁 내내</span></div></div>
              </div>
            </div>
            <div className="i-gap-col is-big">
              <span className="i-gap-tag tag-big">이미, 대형학원</span>
              <div className="i-gap-weapons">
                <div className="i-gap-weapon"><span className="ck">✓</span><div><b>데이터 대시보드</b><span className="sub">감이 아니라 숫자로 결정</span></div></div>
                <div className="i-gap-weapon"><span className="ck">✓</span><div><b>인강 인프라</b><span className="sub">강사 혼자 더 많은 학생</span></div></div>
                <div className="i-gap-weapon"><span className="ck">✓</span><div><b>자동 알림</b><span className="sub">콜센터가 대신 연락</span></div></div>
              </div>
            </div>
          </div>
          <div className="i-gap-merge"><BrandMark size={20} /><span>학원로그로, <b>동네학원도 같은 무기를.</b></span></div>
        </div>
      </section>

      {/* 핵심 무기 1 — 인강 수익 (구매 트리거) */}
      <section className="i-sec i-ingang">
        <div className="i-wrap">
          <div className="i-ingang-inner">
            <div className="i-ingang-copy">
              <span className="i-badge-p">✦ 대형학원의 인강 무기, 우리 학원에도</span>
              <h2>학생은 <em>스스로</em> 학습하고,<br />원장님은 <em>관리만</em> 하세요</h2>
              <p>강의를 한 번 올려두면(등록 3분), 진도와 질문만 관리해도 더 많은 학생을 가르쳐 학원 수익이 늘어납니다.</p>
              <div className="i-revenue-ex">
                <div className="i-rev-calc">
                  <span className="i-rev-part">재원생 30명 중 <b>10명</b></span>
                  <span className="i-rev-op">×</span>
                  <span className="i-rev-part">월 <b>5만원</b> 인강</span>
                  <span className="i-rev-op">=</span>
                  <span className="i-rev-result">월 <b>+50만원</b><span className="i-rev-tag">예시</span></span>
                </div>
                <p className="i-rev-note">* 학원·과목·수강률에 따라 다릅니다. 실제 수익을 보장하지 않습니다.</p>
              </div>
            </div>
            <div className="i-ingang-visual">
              <div className="i-ig-row"><div className="i-ig-thumb">▶</div><div><b>중등 수학 · 1단원 정리</b><span>홍길동 외 18명 수강 중</span></div><span className="i-ig-prog num">82%</span></div>
              <div className="i-ig-row"><div className="i-ig-thumb">▶</div><div><b>영문법 마스터 · 시제</b><span>김민준 외 12명 수강 중</span></div><span className="i-ig-prog num">67%</span></div>
              <div className="i-ig-row"><div className="i-ig-thumb">▶</div><div><b>국어 비문학 독해</b><span>이서연 외 9명 수강 중</span></div><span className="i-ig-prog num">95%</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 무기 2 — 데이터 통합 운영 + 기능(무기들) */}
      <section className="i-sec" id="features">
        <div className="i-wrap">
          <div className="i-head">
            <div className="i-kicker">대형학원이 쓰던 무기들, 이제 우리 학원도</div>
            <h2>흩어진 데이터를 한곳에.<br />감이 아니라 데이터로 결정합니다</h2>
            <p>출결·정산·공지·성적·인강까지, 대형학원이 시스템으로 하던 일을 학원로그가 자동으로 대신합니다.</p>
          </div>
          <div className="i-feat-grid">
            <div className="i-feat"><div className="i-feat-icon">🗂️</div><div><h3>통합 관리</h3><div className="kill">— 프로그램 여러 개를 오갈 필요 없이</div><p>학생·수업·정산·공지를 한 화면에서. 더 이상 도구 사이를 오가지 않습니다.</p><div className="i-feat-tags"><span className="i-tag">#올인원</span><span className="i-tag">#한화면</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">📈</div><div><h3>성적 리포트</h3><div className="kill">— 대형학원의 학습관리를 자동으로</div><p>리포트 양식을 미리 만들어 두면, 점수 입력만으로 학생별 추이 리포트가 자동 발행됩니다.</p><div className="i-feat-tags"><span className="i-tag">#양식편집</span><span className="i-tag">#자동발행</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">🔔</div><div><h3>알림 자동화</h3><div className="kill">— 대형학원 콜센터를 대신</div><p>출결·납부·공지를 설정한 조건에 맞춰 학부모에게 자동 발송합니다.</p><div className="i-feat-tags"><span className="i-tag">#조건설정</span><span className="i-tag">#자동발송</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">🌐</div><div><h3>학원별 공개페이지</h3><div className="kill">— 따로 홈페이지 만들 필요 없이</div><p>학원 소개·공지·문의를 담은 공개 페이지가 자동으로 만들어집니다.</p><div className="i-feat-tags"><span className="i-tag">#자동생성</span><span className="i-tag">#문의접수</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">✅</div><div><h3>출결 자동화</h3><div className="kill">— 종이 출석부와 작별</div><p>QR·체크인으로 출결을 집계하고 미출석은 즉시 알림으로 연결됩니다.</p><div className="i-feat-tags"><span className="i-tag">#QR출결</span><span className="i-tag">#미출석알림</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">💳</div><div><h3>학원비 청구·결제</h3><div className="kill">— 미납 확인·독촉 자동으로</div><p>청구서 발송부터 결제·수납 현황까지 한 번에. 미납은 자동 리마인드.</p><div className="i-feat-tags"><span className="i-tag">#자동청구</span><span className="i-tag">#간편결제</span></div></div></div>
            <div className="i-feat i-feat-wide"><div className="i-feat-icon">📅</div><div><h3>수업·보강 일정</h3><div className="kill">— 보강 일정 충돌을 자동으로 잡아</div><p>정규 수업과 보강을 한 캘린더에서. 겹치는 일정은 미리 경고합니다.</p><div className="i-feat-tags"><span className="i-tag">#캘린더관리</span><span className="i-tag">#충돌경고</span></div></div></div>
          </div>
        </div>
      </section>

      {/* 모바일 — 학부모 */}
      <section className="i-sec i-mobile">
        <div className="i-wrap">
          <div className="i-mobile-inner">
            <div className="i-mobile-copy">
              <div className="i-kicker">학부모도 한눈에</div>
              <h2>우리 아이 학원 생활,<br />휴대폰으로 확인</h2>
              <p>출결·성적·공지를 학부모가 직접 앱에서 확인합니다. 원장님이 일일이 카톡으로 전달할 필요가 없습니다.</p>
            </div>
            <div className="i-phone">
              <div className="i-screen">
                <div className="i-p-top"><b>○○학원</b><span>홍길동 학부모님 · 오늘 등원 완료</span></div>
                <div className="i-p-body">
                  <div className="i-p-notice"><b>📢 6월 정기시험 안내</b><p>6월 셋째 주 정기시험이 진행됩니다. 범위는 공지를 확인해 주세요.</p></div>
                  <div className="i-p-card"><div className="h"><span>이번 달 출석</span><span className="num">14/15</span></div><div className="i-p-bar"><i style={{ width: '93%' }}></i></div></div>
                  <div className="i-p-card"><div className="h"><span>수학 성취도</span><span className="num">88점</span></div><div className="i-p-bar"><i style={{ width: '88%' }}></i></div></div>
                  <div className="i-p-card"><div className="h"><span>인강 진도</span><span className="num">82%</span></div><div className="i-p-bar"><i style={{ width: '82%' }}></i></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 창업자 미션 노트 */}
      <section className="i-sec i-founder">
        <div className="i-wrap">
          <div className="i-founder-card">
            <span className="i-founder-badge">만든 사람의 말</span>
            <p className="i-founder-quote">“자본도 인력도 부족한 동네학원이 기술 격차로 도태되는 게 안타까웠습니다. 대형학원만 누리던 데이터 운영과 인강을, 작은 학원도 부담 없이 — 그래서 학원로그를 만들었습니다.”</p>
            <div className="i-founder-by">학원로그 드림</div>
          </div>
        </div>
      </section>

      {/* 상담 신청 (최종 CTA) */}
      <section className="i-consult" id="consult">
        <div className="i-wrap">
          <div className="i-consult-inner">
            <div className="i-consult-copy">
              <h2>동네학원도 대형학원처럼,<br />데이터로 운영해보세요</h2>
              <p>행정·정산·공지는 학원로그가 대신합니다. 10분 데모로 어떻게 일을 줄여드리는지 직접 보여드립니다.</p>
              <ul>
                <li>설치·계약 부담 없이 먼저 보고 결정</li>
                <li>우리 학원 상황에 맞춘 1:1 데모</li>
                <li>인강 수익 모델까지 함께 설계</li>
              </ul>
            </div>
            <ConsultForm />
          </div>
        </div>
      </section>

      <footer className="i-footer">© 2026 학원로그 · 동네학원의 편에서 만든 통합 운영 플랫폼</footer>
    </div>
  );
}
