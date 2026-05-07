import { createHmac, randomBytes } from 'crypto';

const SOLAPI_API_URL = 'https://api.solapi.com/messages/v4/send';

/**
 * Solapi(쿨에스엠에스) SMS 발송
 * - HMAC-SHA256 서명 인증 사용
 * - 90바이트 초과 시 자동으로 LMS로 전환됨
 *
 * 필수 환경변수:
 *   SOLAPI_API_KEY    — 발급받은 API Key
 *   SOLAPI_API_SECRET — 발급받은 API Secret
 *   SOLAPI_SENDER     — 사전등록된 발신번호 (하이픈 없이, 예: 01012345678)
 */
export async function sendSms(receiver: string, msg: string): Promise<void> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = process.env.SOLAPI_SENDER;

  if (!apiKey || !apiSecret || !sender) {
    console.warn('[SMS] SOLAPI 환경변수 미설정 — 발송 생략');
    return;
  }

  // 한국 휴대폰 번호 정규화 — 하이픈/공백 제거
  const normalizedTo = receiver.replace(/[^\d]/g, '');
  const normalizedFrom = sender.replace(/[^\d]/g, '');

  // HMAC-SHA256 서명 생성
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString('hex');
  const signature = createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');

  const authorization = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

  try {
    const res = await fetch(SOLAPI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        message: {
          to: normalizedTo,
          from: normalizedFrom,
          text: msg,
          // type 미지정 시 솔라피가 길이에 따라 SMS/LMS 자동 선택
        },
      }),
    });

    const data = await res.json();

    if (!res.ok || data.statusCode !== '2000') {
      console.error(
        '[SMS] 솔라피 발송 실패:',
        data.statusMessage ?? data.message ?? `HTTP ${res.status}`,
      );
    }
  } catch (err) {
    console.error('[SMS] 솔라피 호출 오류:', err instanceof Error ? err.message : String(err));
  }
}
