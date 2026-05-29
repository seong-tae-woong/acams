export default function LecturesStub() {
  return (
    <div style={{ padding: 40, maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, color: '#1e1b2e', marginBottom: 12 }}>강의 분석</h1>
      <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.7 }}>
        강의·시리즈별 수강생 진도 분포·합격률·점수 히스토그램을 보여주는 페이지입니다.
        <br />
        Phase F 2차 스프린트에서 개발 예정입니다.
      </p>
      <div style={{ marginTop: 24, padding: 16, background: '#EEEDFE', borderRadius: 10, color: '#534AB7', fontSize: 12 }}>
        현재는 <a href="/ingang/completion" style={{ color: '#5B4FBE', fontWeight: 600 }}>이수관리 홈</a>의 전체 KPI에서 학원 단위 이수율을 확인할 수 있습니다.
      </div>
    </div>
  );
}
