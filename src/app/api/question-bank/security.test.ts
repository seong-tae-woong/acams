// T11 (IRON RULE) — 문제출제 라우트 보안·검증 통합 테스트.
// 라우트 핸들러를 직접 호출하고 requireAuth/prisma를 목킹한다(이 프로젝트 첫 API 라우트 테스트 패턴).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.mock 팩토리에서 참조할 수 있게 hoist
const { prismaMock, mockAuth } = vi.hoisted(() => {
  const prismaMock = {
    testDraft: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    testDraftItem: { createMany: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    qualityFlag: { createMany: vi.fn(), updateMany: vi.fn() },
    bankQuestion: { createMany: vi.fn() },
    generationTurn: { create: vi.fn(), findFirst: vi.fn() },
    testPreset: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prismaMock, mockAuth: vi.fn() };
});

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/auth/requireAuth', () => ({ requireAuth: mockAuth }));
vi.mock('@/lib/log/logServerError', () => ({ logServerError: vi.fn() }));
vi.mock('@/lib/ai/generate', () => ({ generateQuestions: vi.fn() }));
vi.mock('@/lib/ai/review', () => ({ reviewGeneratedQuestions: vi.fn() }));

import { POST as generatePOST } from './generate/route';
import { GET as draftsGET } from './drafts/route';
import { GET as detailGET } from './drafts/[id]/route';
import { POST as feedbackPOST } from './drafts/[id]/feedback/route';
import { POST as approvePOST } from './drafts/[id]/approve/route';
import { GET as presetsGET, POST as presetsPOST } from './presets/route';
import { DELETE as presetDELETE } from './presets/[id]/route';
import { POST as mockPOST } from './mock/route';
import { POST as sectionPOST } from './drafts/[id]/section/route';

function mkReq(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/question-bank/x', {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
      : {}),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
const director = { academyId: 'A', userId: 'u1', role: 'director' };
const validSpec = { subject: '영어', gradeLevel: '중3', type: '어법', difficulty: 3, count: 5 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('역할 가드 (권한 403)', () => {
  it('generate: parent → 403', async () => {
    mockAuth.mockResolvedValue({ academyId: 'A', userId: 'u', role: 'parent' });
    const res = await generatePOST(mkReq('POST', validSpec));
    expect(res.status).toBe(403);
  });

  it('drafts 목록: student → 403', async () => {
    mockAuth.mockResolvedValue({ academyId: 'A', userId: 'u', role: 'student' });
    const res = await draftsGET(mkReq('GET'));
    expect(res.status).toBe(403);
  });

  it('approve: parent → 403', async () => {
    mockAuth.mockResolvedValue({ academyId: 'A', userId: 'u', role: 'parent' });
    const res = await approvePOST(mkReq('POST', {}), ctx('d1'));
    expect(res.status).toBe(403);
  });
});

describe('입력 검증 (generate, ≤20)', () => {
  beforeEach(() => mockAuth.mockResolvedValue(director));

  it('count > 20 → 400', async () => {
    const res = await generatePOST(mkReq('POST', { ...validSpec, count: 21 }));
    expect(res.status).toBe(400);
  });
  it('count < 1 → 400', async () => {
    const res = await generatePOST(mkReq('POST', { ...validSpec, count: 0 }));
    expect(res.status).toBe(400);
  });
  it('difficulty 범위 밖(6) → 400', async () => {
    const res = await generatePOST(mkReq('POST', { ...validSpec, difficulty: 6 }));
    expect(res.status).toBe(400);
  });
  it('필수 필드(subject) 누락 → 400', async () => {
    const res = await generatePOST(mkReq('POST', { ...validSpec, subject: '' }));
    expect(res.status).toBe(400);
  });
});

describe('academyId 격리 (타 학원 데이터 차단)', () => {
  beforeEach(() => mockAuth.mockResolvedValue(director));

  it('상세 GET: 타 학원 초안 → 404 + academyId 스코프 쿼리', async () => {
    prismaMock.testDraft.findFirst.mockResolvedValue(null);
    const res = await detailGET(mkReq('GET'), ctx('other-academy-draft'));
    expect(res.status).toBe(404);
    expect(prismaMock.testDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other-academy-draft', academyId: 'A' } }),
    );
  });

  it('feedback POST: 타 학원 → 404 + 스코프', async () => {
    prismaMock.testDraft.findFirst.mockResolvedValue(null);
    const res = await feedbackPOST(mkReq('POST', { feedback: '수정해주세요' }), ctx('other'));
    expect(res.status).toBe(404);
    expect(prismaMock.testDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other', academyId: 'A' } }),
    );
  });

  it('approve POST: 타 학원 → 404 + 스코프', async () => {
    prismaMock.testDraft.findFirst.mockResolvedValue(null);
    const res = await approvePOST(mkReq('POST', { override: false }), ctx('other'));
    expect(res.status).toBe(404);
    expect(prismaMock.testDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other', academyId: 'A' } }),
    );
  });

  it('drafts 목록: academyId로 스코프', async () => {
    prismaMock.testDraft.findMany.mockResolvedValue([]);
    await draftsGET(mkReq('GET'));
    expect(prismaMock.testDraft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { academyId: 'A' } }),
    );
  });
});

describe('승인 게이트 · 초안 상태 전이', () => {
  beforeEach(() => mockAuth.mockResolvedValue(director));

  it('미해결 ERROR 플래그 + override 없음 → 422 (오답 인쇄 0)', async () => {
    prismaMock.testDraft.findFirst.mockResolvedValue({
      id: 'd1',
      status: 'REVIEW',
      spec: { subject: '영어', gradeLevel: '중3' },
      items: [{ id: 'i1', flags: [{ severity: 'ERROR', resolved: false }] }],
    });
    const res = await approvePOST(mkReq('POST', { override: false }), ctx('d1'));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.unresolvedErrors).toBe(1);
    // 차단되었으므로 은행 적재/상태변경 없음
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('이미 APPROVED 초안 재승인 → 409', async () => {
    prismaMock.testDraft.findFirst.mockResolvedValue({
      id: 'd1',
      status: 'APPROVED',
      spec: {},
      items: [{ id: 'i1', flags: [] }],
    });
    const res = await approvePOST(mkReq('POST', {}), ctx('d1'));
    expect(res.status).toBe(409);
  });

  it('feedback: APPROVED 초안 수정 시도 → 409', async () => {
    prismaMock.testDraft.findFirst.mockResolvedValue({ id: 'd1', status: 'APPROVED', spec: {} });
    const res = await feedbackPOST(mkReq('POST', { feedback: '수정' }), ctx('d1'));
    expect(res.status).toBe(409);
  });

  it('feedback: 빈 피드백 → 400', async () => {
    const res = await feedbackPOST(mkReq('POST', { feedback: '   ' }), ctx('d1'));
    expect(res.status).toBe(400);
  });
});

describe('프리셋(양식) API 보안·검증', () => {
  it('GET presets: student → 403', async () => {
    mockAuth.mockResolvedValue({ academyId: 'A', userId: 'u', role: 'student' });
    expect((await presetsGET(mkReq('GET'))).status).toBe(403);
  });

  it('POST presets: parent → 403', async () => {
    mockAuth.mockResolvedValue({ academyId: 'A', userId: 'u', role: 'parent' });
    expect((await presetsPOST(mkReq('POST', { name: '양식', ...validSpec }))).status).toBe(403);
  });

  it('GET presets: academyId로 스코프', async () => {
    mockAuth.mockResolvedValue(director);
    prismaMock.testPreset.findMany.mockResolvedValue([]);
    await presetsGET(mkReq('GET'));
    expect(prismaMock.testPreset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { academyId: 'A' } }),
    );
  });

  it('POST presets: 이름 없으면 400', async () => {
    mockAuth.mockResolvedValue(director);
    expect((await presetsPOST(mkReq('POST', { name: '  ', ...validSpec }))).status).toBe(400);
  });

  it('POST presets: spec 검증(count>20) → 400', async () => {
    mockAuth.mockResolvedValue(director);
    expect(
      (await presetsPOST(mkReq('POST', { name: '양식', ...validSpec, count: 21 }))).status,
    ).toBe(400);
  });

  it('DELETE preset: academyId 스코프 + 타 학원/미존재 → 404', async () => {
    mockAuth.mockResolvedValue(director);
    prismaMock.testPreset.deleteMany.mockResolvedValue({ count: 0 });
    const res = await presetDELETE(mkReq('DELETE'), ctx('other'));
    expect(res.status).toBe(404);
    expect(prismaMock.testPreset.deleteMany).toHaveBeenCalledWith({
      where: { id: 'other', academyId: 'A' },
    });
  });
});

describe('모의고사(P2) API 보안·검증', () => {
  const mockBody = {
    subject: '영어',
    gradeLevel: '고1',
    sections: [{ type: '어법', count: 5, difficulty: 3 }],
  };

  it('mock 생성: parent → 403', async () => {
    mockAuth.mockResolvedValue({ academyId: 'A', userId: 'u', role: 'parent' });
    expect((await mockPOST(mkReq('POST', mockBody))).status).toBe(403);
  });

  it('mock 생성: 섹션 0개 → 400', async () => {
    mockAuth.mockResolvedValue(director);
    expect((await mockPOST(mkReq('POST', { ...mockBody, sections: [] }))).status).toBe(400);
  });

  it('section 생성: student → 403', async () => {
    mockAuth.mockResolvedValue({ academyId: 'A', userId: 'u', role: 'student' });
    expect((await sectionPOST(mkReq('POST', { sectionIndex: 0 }), ctx('d1'))).status).toBe(403);
  });

  it('section 생성: 타 학원 → 404 + academyId 스코프', async () => {
    mockAuth.mockResolvedValue(director);
    prismaMock.testDraft.findFirst.mockResolvedValue(null);
    const res = await sectionPOST(mkReq('POST', { sectionIndex: 0 }), ctx('other'));
    expect(res.status).toBe(404);
    expect(prismaMock.testDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other', academyId: 'A' } }),
    );
  });

  it('section 생성: 모의고사 아님(BASIC) → 400', async () => {
    mockAuth.mockResolvedValue(director);
    prismaMock.testDraft.findFirst.mockResolvedValue({
      id: 'd1',
      status: 'REVIEW',
      layout: 'BASIC',
      spec: {},
    });
    const res = await sectionPOST(mkReq('POST', { sectionIndex: 0 }), ctx('d1'));
    expect(res.status).toBe(400);
  });
});
