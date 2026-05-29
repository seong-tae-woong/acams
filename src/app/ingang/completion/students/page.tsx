export default function StudentsStub() {
  return (
    <div style={{ padding: 40, maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, color: '#1e1b2e', marginBottom: 12 }}>학생 진도</h1>
      <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.7 }}>
        학생별 강의 진도·시험 기록·이수증 발급 이력을 한 화면에서 확인하는 페이지입니다.
        <br />
        Phase F 2차 스프린트에서 개발 예정입니다.
      </p>
      <div style={{ marginTop: 24, padding: 16, background: '#EEEDFE', borderRadius: 10, color: '#534AB7', fontSize: 12 }}>
        현재는 <a href="/ingang/completion" style={{ color: '#5B4FBE', fontWeight: 600 }}>이수관리 홈</a>에서 위험 학생과 발급 대기를 관리할 수 있습니다.
      </div>
    </div>
  );
}
