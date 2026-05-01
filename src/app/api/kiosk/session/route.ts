import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createKioskToken } from '@/lib/kiosk/token';
import QRCode from 'qrcode';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const param = searchParams.get('academyId') ?? searchParams.get('academy');

  if (!param) {
    return NextResponse.json({ error: 'academyId required' }, { status: 400 });
  }

  const academy = await prisma.academy.findFirst({
    where: { OR: [{ id: param }, { slug: param }], isActive: true },
    select: { id: true, name: true },
  });

  if (!academy) {
    return NextResponse.json({ error: '학원 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  const token = await createKioskToken(academy.id);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const qrDataUrl = await QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: { dark: '#000000ff', light: '#ffffffff' },
  });

  return NextResponse.json({ token, qrDataUrl, expiresAt, academyName: academy.name });
}
