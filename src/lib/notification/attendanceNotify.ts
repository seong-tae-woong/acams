// 자동 결석/지각 알림 — 시간 윈도우 계산 유틸.
//
// 동작:
// - Vercel Cron은 UTC로 실행됨. 학원 수업 시간은 한국시간(KST = UTC+9) 기준 'HH:mm' 문자열.
// - 5분 주기 cron 가정: 현재 시각이 임계값(N분/M분) 직후 5분 윈도우에 들어왔으면 발송 대상.
// - dayOfWeek: AcaMS 컨벤션 1=월요일~7=일요일. JS Date#getDay()는 0=일~6=토 → 변환 필요.

export const KST_OFFSET_MIN = 9 * 60; // UTC+9 (한국은 DST 없음 — 단순 상수 변환으로 충분)

// UTC Date → KST 기준 { dayOfWeek (1=월~7=일), hour, minute, midnightUtc }
// midnightUtc: KST 자정에 대응하는 UTC Date (AttendanceRecord.date 비교용)
export function toKstParts(nowUtc: Date): {
  dayOfWeek: number;
  totalMinutes: number;
  midnightUtc: Date;
} {
  // KST 시각 = UTC 시각 + 9시간
  const kstMs = nowUtc.getTime() + KST_OFFSET_MIN * 60 * 1000;
  const kst = new Date(kstMs);

  // getUTC* 를 쓰는 이유: kst는 UTC 시간축에서 +9시간 시프트된 값이므로
  // 그 값의 "UTC 시각"이 곧 KST의 벽시계 시각이다.
  const jsDay = kst.getUTCDay();           // 0=일, 1=월, ..., 6=토
  const dayOfWeek = jsDay === 0 ? 7 : jsDay; // AcaMS 컨벤션 1=월~7=일

  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  const totalMinutes = hour * 60 + minute;

  // 출결 저장 컨벤션: AttendanceRecord.date = new Date('YYYY-MM-DD')
  //   = 'KST 달력 날짜'의 UTC 자정 (admin attendance/route.ts, kiosk check-in 모두 동일).
  // 따라서 cron의 출석 조회 키도 'KST 달력 날짜의 UTC 자정'이어야 매칭된다.
  // 여기서 오프셋을 빼면 9시간 어긋나 출석한 학생도 결석 대상이 되므로 빼지 않는다.
  const midnightUtc = new Date(Date.UTC(
    kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 0, 0, 0, 0
  ));

  return { dayOfWeek, totalMinutes, midnightUtc };
}

// 'HH:mm' 형식 문자열을 분(0-1439)으로 변환. 형식 위반 시 null.
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export type WindowKind = 'NONE' | 'LATE' | 'ABSENT';

// 수업 시작 분(startMin) 기준으로 현재 분(nowMin)이 어떤 임계값 윈도우인지 판정.
// 임계값 도달 후 graceMin 분 동안 발송을 허용한다.
//
// graceMin을 cron 주기보다 넉넉히 두는 이유: 호출자가 GitHub Actions 스케줄인데
// best-effort라 5분 틱이 지연/누락될 수 있다. 단일 5분 윈도우만 발송하면 틱이
// 한 번 밀리는 순간 그 반은 알림을 영영 못 받는다. 윈도우를 넓혀도 중복 발송은
// AttendanceNotificationLog UNIQUE 제약으로 차단되므로 안전하다.
//
// 우선순위: ABSENT > LATE — 결석 임계값이 더 늦으므로, elapsed가 결석 임계값을
// 넘으면 LATE 윈도우와 겹치더라도 결석으로 처리한다(LATE는 [lateMin, absentMin)로 capped).
export function classifyWindow(
  nowMin: number,
  startMin: number,
  lateMin: number,
  absentMin: number,
  graceMin: number = 20,
): WindowKind {
  // 자정 넘어가는 수업은 운영상 거의 없지만, 음수 elapsed는 그냥 NONE으로 흘림.
  const elapsed = nowMin - startMin;
  if (elapsed < 0) return 'NONE';

  // 결석 윈도우 먼저 검사 (lateMin < absentMin 이 검증되었다고 가정)
  if (elapsed >= absentMin && elapsed < absentMin + graceMin) return 'ABSENT';
  if (elapsed >= lateMin && elapsed < lateMin + graceMin) return 'LATE';
  return 'NONE';
}
