// 알림 템플릿 변수 치환 헬퍼.
// 자동 알림(결석/지각) 등에서 {학생명}, {수업명}, {수업시간}, {임계분} 같은
// 변수를 학생별 실제 값으로 치환할 때 사용.
//
// 변수 형식: "{변수명}". 키가 객체에 없으면 원본 문자열 그대로 유지(누락 변수 안전).
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([^{}]+)\}/g, (match, key: string) => {
    const v = vars[key.trim()];
    return v === undefined || v === null ? match : String(v);
  });
}
