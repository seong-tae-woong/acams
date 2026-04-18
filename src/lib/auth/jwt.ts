import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  role: string;
  academyId: string | null;
  name: string;
}

const SECRET = process.env.JWT_SECRET!;

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
