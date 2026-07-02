// @react-pdf 폰트 등록 — NotoSansKR 400·700(진짜 볼드) + 한글 줄바꿈 콜백.
// korean subset은 한글·ASCII·· 만 포함(원문자 미포함) → 라벨은 pdfContent에서 ASCII 사용.
import { Font } from '@react-pdf/renderer';
import path from 'path';

let registered = false;

export function ensureQuestionBankFonts(): void {
  if (registered) return;
  try {
    const dir = path.join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans-kr', 'files');
    Font.register({
      family: 'NotoSansKR',
      fonts: [
        { src: path.join(dir, 'noto-sans-kr-korean-400-normal.woff'), fontWeight: 400 },
        { src: path.join(dir, 'noto-sans-kr-korean-700-normal.woff'), fontWeight: 700 },
      ],
    });
    // 한글은 하이픈 분절하지 않음(단어 단위 유지)
    Font.registerHyphenationCallback((word) => [word]);
    registered = true;
  } catch (err) {
    console.error('[pdf] font registration failed:', err instanceof Error ? err.message : String(err));
    // 등록 실패해도 렌더는 시도(한글 깨질 수 있음)
  }
}
