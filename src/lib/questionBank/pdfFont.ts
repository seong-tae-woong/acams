// @react-pdf 폰트 등록 — NotoSansKR 400·700(진짜 볼드) + 한글 줄바꿈 콜백 + 리거처 off.
// korean subset은 한글·ASCII·· 만 포함(원문자 미포함) → 라벨은 pdfContent에서 ASCII 사용.
// ⚠️ Noto Sans KR subset의 fi/fl/ff 리거처 글리프가 깨져 "finish"→"fnish"로 렌더됨.
//    @react-pdf는 fontkit.layout에 features=undefined(리거처 on)로 넘기고 disable API가 없음.
//    fontkit(=@react-pdf와 동일 인스턴스, deduped)의 layout을 패치해 리거처를 끈다.
import { Font } from '@react-pdf/renderer';
import { openSync } from 'fontkit';
import path from 'path';

let registered = false;

const FONT_DIR = path.join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans-kr', 'files');
const KOREAN_400 = path.join(FONT_DIR, 'noto-sans-kr-korean-400-normal.woff');
const KOREAN_700 = path.join(FONT_DIR, 'noto-sans-kr-korean-700-normal.woff');

// 리거처(fi/fl/ff) 비활성 — fontkit 폰트 프로토타입의 layout 패치(1회, 전역).
// openSync·create가 프로토타입을 공유하므로 @react-pdf가 만드는 폰트에도 적용됨.
function disableLigatures(): void {
  try {
    const sample = openSync(KOREAN_400);
    const proto = Object.getPrototypeOf(sample) as {
      layout: (...a: unknown[]) => unknown;
      __ligDisabled?: boolean;
    };
    if (proto.__ligDisabled) return;
    const orig = proto.layout;
    proto.layout = function (this: unknown, str: unknown, features: unknown, ...rest: unknown[]) {
      // @react-pdf는 features=undefined로 호출 → 리거처 끄는 오버라이드 주입
      const feats = features ?? { liga: false, clig: false, dlig: false, rlig: false };
      return orig.call(this, str, feats, ...rest);
    };
    proto.__ligDisabled = true;
  } catch (err) {
    console.error('[pdf] ligature patch failed:', err instanceof Error ? err.message : String(err));
  }
}

export function ensureQuestionBankFonts(): void {
  if (registered) return;
  try {
    Font.register({
      family: 'NotoSansKR',
      fonts: [
        { src: KOREAN_400, fontWeight: 400 },
        { src: KOREAN_700, fontWeight: 700 },
      ],
    });
    // 한글은 하이픈 분절하지 않음(단어 단위 유지)
    Font.registerHyphenationCallback((word) => [word]);
    disableLigatures();
    registered = true;
  } catch (err) {
    console.error('[pdf] font registration failed:', err instanceof Error ? err.message : String(err));
    // 등록 실패해도 렌더는 시도(한글 깨질 수 있음)
  }
}
