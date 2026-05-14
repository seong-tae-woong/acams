import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const lectureId = 'cmp5ccicq00087wtwkm84c8v0';
  const classId   = 'cmoegd1ku00000aju3h1l7sqc'; // 영어 기초반

  // 1. 강의 PUBLISHED 처리
  await prisma.lecture.update({
    where: { id: lectureId },
    data: { status: 'PUBLISHED', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  });
  console.log('✅ 강의 PUBLISHED');

  // 2. LectureTarget (강의 → 반 배정)
  await prisma.lectureTarget.upsert({
    where: { lectureId_classId: { lectureId, classId } },
    create: { lectureId, classId },
    update: {},
  });
  console.log('✅ LectureTarget 생성 (영어 기초반)');

  // 3. 영어 기초반에 수강 중인 학생 조회
  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId, isActive: true },
    include: { student: { select: { id: true, name: true, attendanceNumber: true } } },
    take: 3,
  });

  if (enrollments.length === 0) {
    // 학생이 없으면 첫 번째 학생을 반에 등록
    const firstStudent = await prisma.student.findFirst({ orderBy: { createdAt: 'asc' } });
    if (firstStudent) {
      await prisma.classEnrollment.upsert({
        where: { classId_studentId: { classId, studentId: firstStudent.id } },
        create: { studentId: firstStudent.id, classId, isActive: true },
        update: { isActive: true },
      });
      console.log(`✅ 학생 등록: ${firstStudent.name} (${firstStudent.attendanceNumber}) → 영어 기초반`);
      console.log(`\n📋 테스트 정보:`);
      console.log(`  - 태블릿 ID: tablet_segyero_01 / PW: test1234`);
      console.log(`  - 학생 출결번호: ${firstStudent.attendanceNumber}`);
    }
  } else {
    console.log('\n📋 테스트 정보:');
    console.log(`  - 태블릿 ID: tablet_segyero_01 / PW: test1234`);
    enrollments.forEach(e => {
      console.log(`  - 학생: ${e.student.name} | 출결번호: ${e.student.attendanceNumber}`);
    });
  }

  // 4. 오늘 daily code 확인
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const academyId = 'cmo47ismf00017ktw004otax1';
  const code = await prisma.ingangDailyCode.findUnique({
    where: { academyId_date: { academyId, date: todayUTC } },
  });
  if (code) {
    console.log(`  - 오늘 인증 코드: ${code.code}`);
  } else {
    console.log('  - 인증 코드 없음 (director로 로그인 후 인강 > 일일 인증 코드 페이지에서 확인)');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
