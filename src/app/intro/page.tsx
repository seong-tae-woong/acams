import type { Metadata } from 'next';
import './intro.css';
import ConsultForm from './_components/ConsultForm';
import BrandMark from '@/components/shared/BrandMark';

export const metadata: Metadata = {
  title: '학원로그 — 여러 프로그램·엑셀·카톡을 하나로',
  description:
    '출결·정산·공지·성적·인강까지, 소규모 학원의 흩어진 업무를 학원로그 하나로 통합하세요. 인강으로 학생은 스스로 학습하고 원장님은 관리만, 추가 수익까지.',
  keywords: ['학원관리', '학원관리프로그램', '학원로그', '출결관리', '학원비결제', '인강', '학원통합관리'],
  openGraph: {
    title: '학원로그 — 흩어진 학원 업무를 하나로',
    description: '출결·정산·공지·성적·인강까지 통합. 인강으로 추가 수익까지 만드는 소규모 학원 운영 플랫폼.',
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

      {/* 히어로 */}
      <div className="i-wrap">
        <section className="i-hero">
          <span className="i-eyebrow">소규모 학원을 위한 통합 운영 플랫폼</span>
          <h1>여러 프로그램·엑셀·카톡,<br /><span className="i-accent">학원로그 하나로</span> 끝냅니다</h1>
          <p className="i-hero-sub">출결은 종이, 정산은 엑셀, 공지는 카톡… 따로 노는 도구들 때문에 가르칠 시간이 줄어듭니다. 학원로그가 그 시간을 선생님께 돌려드립니다.</p>
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

      {/* 공감 */}
      <section className="i-sec i-pain">
        <div className="i-wrap">
          <div className="i-head">
            <div className="i-kicker">지금, 이렇게 일하고 계신가요?</div>
            <h2>도구가 흩어져 있으면<br />매일 잔업이 쌓입니다</h2>
          </div>
          <div className="i-pain-grid">
            <div className="i-pain-card"><div className="e">📄</div><h3>출결은 종이로</h3><p>수기 출석부를 매번 옮겨 적고, 빠진 학생은 따로 카톡으로 확인합니다.</p></div>
            <div className="i-pain-card"><div className="e">📊</div><h3>정산은 엑셀로</h3><p>수납·미납을 엑셀에 직접 정리하다 보면 숫자가 어긋나 다시 검산합니다.</p></div>
            <div className="i-pain-card"><div className="e">💬</div><h3>공지는 카톡으로</h3><p>학부모 한 명 한 명에게 직접 메시지를 보내느라 저녁 시간이 사라집니다.</p></div>
          </div>
          <div className="i-pain-arrow">↓ 학원로그 하나로 통합하면, 이 모든 잔업이 사라집니다</div>
        </div>
      </section>

      {/* 기능 */}
      <section className="i-sec" id="features">
        <div className="i-wrap">
          <div className="i-head">
            <div className="i-kicker">원장님 업무에 맞춘 7가지 기능</div>
            <h2>프로그램에 맞추지 마세요<br />원장님 손작업을 대신합니다</h2>
            <p>출결·정산·공지·성적까지, 매일 손으로 반복하던 업무를 기능 하나하나가 그대로 대신합니다.</p>
          </div>
          <div className="i-feat-grid">
            <div className="i-feat"><div className="i-feat-icon">🗂️</div><div><h3>통합 관리</h3><div className="kill">— 프로그램 여러 개를 오갈 필요 없이</div><p>학생·수업·정산·공지를 한 화면에서. 더 이상 도구 사이를 오가지 않습니다.</p><div className="i-feat-tags"><span className="i-tag">#올인원</span><span className="i-tag">#한화면</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">📈</div><div><h3>성적 리포트</h3><div className="kill">— 양식 한 번 만들면, 발행은 자동으로</div><p>리포트 양식을 미리 만들어 두면, 점수 입력만으로 학생별 추이 리포트가 자동 발행됩니다.</p><div className="i-feat-tags"><span className="i-tag">#양식편집</span><span className="i-tag">#자동발행</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">🔔</div><div><h3>알림 자동화</h3><div className="kill">— 한 명씩 카톡 보내던 저녁 시간 회수</div><p>출결·납부·공지를 설정한 조건에 맞춰 학부모에게 자동 발송합니다.</p><div className="i-feat-tags"><span className="i-tag">#조건설정</span><span className="i-tag">#자동발송</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">🌐</div><div><h3>학원별 공개페이지</h3><div className="kill">— 따로 홈페이지 만들 필요 없이</div><p>학원 소개·공지·문의를 담은 공개 페이지가 자동으로 만들어집니다.</p><div className="i-feat-tags"><span className="i-tag">#자동생성</span><span className="i-tag">#문의접수</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">✅</div><div><h3>출결 자동화</h3><div className="kill">— 종이 출석부와 작별</div><p>QR·체크인으로 출결을 집계하고 미출석은 즉시 알림으로 연결됩니다.</p><div className="i-feat-tags"><span className="i-tag">#QR출결</span><span className="i-tag">#미출석알림</span></div></div></div>
            <div className="i-feat"><div className="i-feat-icon">💳</div><div><h3>학원비 청구·결제</h3><div className="kill">— 미납 확인·독촉 자동으로</div><p>청구서 발송부터 결제·수납 현황까지 한 번에. 미납은 자동 리마인드.</p><div className="i-feat-tags"><span className="i-tag">#자동청구</span><span className="i-tag">#간편결제</span></div></div></div>
            <div className="i-feat i-feat-wide"><div className="i-feat-icon">📅</div><div><h3>수업·보강 일정</h3><div className="kill">— 보강 일정 충돌을 자동으로 잡아</div><p>정규 수업과 보강을 한 캘린더에서. 겹치는 일정은 미리 경고합니다.</p><div className="i-feat-tags"><span className="i-tag">#캘린더관리</span><span className="i-tag">#충돌경고</span></div></div></div>
          </div>
        </div>
      </section>

      {/* 모바일 */}
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

      {/* 인강 수익 */}
      <section className="i-sec i-ingang">
        <div className="i-wrap">
          <div className="i-ingang-inner">
            <div className="i-ingang-copy">
              <span className="i-badge-p">✦ 인강으로 만드는 추가 수익</span>
              <h2>학생은 <em>스스로</em> 학습하고,<br />원장님은 <em>관리만</em> 하세요</h2>
              <p>강의를 한 번 올려두면, 진도와 질문만 관리해도 더 많은 학생을 가르쳐 수익성이 극대화됩니다.</p>
              <div className="i-stats">
                <div><div className="n num">+45<span style={{ fontSize: 20 }}>시간</span></div><div className="c">월 절감 수업 시간(예시)</div></div>
                <div><div className="n num">3<span style={{ fontSize: 20 }}>분</span></div><div className="c">강의 등록에 걸리는 시간</div></div>
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

      {/* 상담 신청 */}
      <section className="i-consult" id="consult">
        <div className="i-wrap">
          <div className="i-consult-inner">
            <div className="i-consult-copy">
              <h2>선생님은 가르치는 일에<br />집중하세요</h2>
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

      <footer className="i-footer">© 2026 학원로그 · 소규모 학원을 위한 통합 운영 플랫폼</footer>
    </div>
  );
}
