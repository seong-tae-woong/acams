// fontkit(@react-pdf 통해 설치됨)은 타입 선언을 제공하지 않음.
// PDF 폰트 리거처 패치(pdfFont.ts)에 필요한 최소 선언만.
declare module 'fontkit' {
  interface FontkitFont {
    layout(
      str: string,
      features?: unknown,
      script?: unknown,
      language?: unknown,
      direction?: unknown,
    ): unknown;
  }
  const fontkit: { openSync(path: string): FontkitFont };
  export default fontkit;
}
