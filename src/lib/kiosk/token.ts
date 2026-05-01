import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function createKioskToken(academyId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ academyId, type: 'kiosk' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60) // 5분 유효
    .sign(SECRET);
}

export async function verifyKioskToken(token: string): Promise<{ academyId: string }> {
  const { payload } = await jwtVerify(token, SECRET);
  if (payload['type'] !== 'kiosk') throw new Error('Invalid token type');
  return { academyId: payload['academyId'] as string };
}
