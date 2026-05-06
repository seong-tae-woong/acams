import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

// GET /api/super-admin/academies/check?field=name|loginKey|slug&value=...
// 학원 등록 시 중복 여부 확인
export async function GET(req: NextRequest) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const field = searchParams.get('field');
  const value = (searchParams.get('value') ?? '').trim();

  if (!field || !value) {
    return NextResponse.json({ error: 'field와 value는 필수입니다.' }, { status: 400 });
  }

  if (field === 'name') {
    const existing = await prisma.academy.findFirst({ where: { name: value } });
    return NextResponse.json({
      available: !existing,
      message: existing ? '이미 사용 중인 학원명입니다.' : '사용 가능한 학원명입니다.',
    });
  }

  if (field === 'loginKey') {
    if (!/^[A-Z]{3}$/.test(value)) {
      return NextResponse.json({
        available: false,
        message: '학원 키는 영문 대문자 3글자여야 합니다. (예: SGR)',
      });
    }
    const existing = await prisma.academy.findUnique({ where: { loginKey: value } });
    return NextResponse.json({
      available: !existing,
      message: existing ? '이미 사용 중인 학원 키입니다.' : '사용 가능한 학원 키입니다.',
    });
  }

  if (field === 'slug') {
    if (!/^[a-z0-9-]+$/.test(value)) {
      return NextResponse.json({
        available: false,
        message: '슬러그는 영문 소문자·숫자·하이픈만 가능합니다.',
      });
    }
    const existing = await prisma.academy.findUnique({ where: { slug: value } });
    return NextResponse.json({
      available: !existing,
      message: existing ? '이미 사용 중인 슬러그입니다.' : '사용 가능한 슬러그입니다.',
    });
  }

  return NextResponse.json({ error: '지원하지 않는 field입니다.' }, { status: 400 });
}
