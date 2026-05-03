const ALIGO_API_URL = 'https://apis.aligo.in/send/';

export async function sendSms(receiver: string, msg: string): Promise<void> {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;

  if (!apiKey || !userId || !sender) {
    console.warn('[SMS] ALIGO 환경변수 미설정 — 발송 생략');
    return;
  }

  const body = new URLSearchParams({
    key: apiKey,
    userid: userId,
    sender,
    receiver,
    msg,
    msg_type: 'SMS',
  });

  const res = await fetch(ALIGO_API_URL, { method: 'POST', body });
  const data = await res.json();

  if (data.result_code !== '1') {
    console.error('[SMS] 알리고 발송 실패:', data.message);
  }
}
