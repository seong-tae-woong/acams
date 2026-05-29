import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../renderTemplate';

describe('renderTemplate', () => {
  it('한국어 변수명을 치환한다', () => {
    const out = renderTemplate('{학생명}님이 {수업명}에 결석', {
      학생명: '홍길동',
      수업명: '중3 수학',
    });
    expect(out).toBe('홍길동님이 중3 수학에 결석');
  });

  it('숫자 변수를 문자열로 치환한다', () => {
    const out = renderTemplate('{임계분}분이 지났습니다', { 임계분: 20 });
    expect(out).toBe('20분이 지났습니다');
  });

  it('정의되지 않은 변수는 원본 그대로 보존한다', () => {
    const out = renderTemplate('{학생명} / {알수없음}', { 학생명: '홍길동' });
    expect(out).toBe('홍길동 / {알수없음}');
  });

  it('같은 변수가 여러 번 등장해도 모두 치환된다', () => {
    const out = renderTemplate('[{학생명}] {학생명} 학생', { 학생명: '홍길동' });
    expect(out).toBe('[홍길동] 홍길동 학생');
  });

  it('빈 객체에서는 모든 자리표시자가 보존된다', () => {
    const out = renderTemplate('{a} {b}', {});
    expect(out).toBe('{a} {b}');
  });

  it('자리표시자가 없는 문자열은 원본 그대로 반환한다', () => {
    const out = renderTemplate('변수 없음', { 학생명: '홍길동' });
    expect(out).toBe('변수 없음');
  });

  it('변수 키 양옆의 공백을 무시한다', () => {
    const out = renderTemplate('{ 학생명 }', { 학생명: '홍길동' });
    expect(out).toBe('홍길동');
  });
});
