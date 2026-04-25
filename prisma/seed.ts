import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ─── 기존 데이터 초기화 (중복 방지) ───────────────────
  await prisma.attendanceRecord.deleteMany({});
  await prisma.gradeRecord.deleteMany({});
  await prisma.makeupClassTarget.deleteMany({});
  await prisma.consultationRecord.deleteMany({});
  await prisma.bill.deleteMany({});
  await prisma.studentParent.deleteMany({});
  await prisma.studentSibling.deleteMany({});
  await prisma.classEnrollment.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.parent.deleteMany({});
  await prisma.calendarEvent.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.exam.deleteMany({});
  await prisma.makeupClass.deleteMany({});
  await prisma.classTeacher.deleteMany({});
  await prisma.classSchedule.deleteMany({});
  await prisma.class.deleteMany({});
  console.log('🗑️  기존 데이터 초기화 완료');

  // ─── 슈퍼어드민 ────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@acams.kr' },
    update: {},
    create: {
      email: 'superadmin@acams.kr',
      passwordHash: await bcrypt.hash('acams2026!', 12),
      name: 'Super Admin',
      role: 'super_admin',
    },
  });
  console.log('✅ Super admin:', superAdmin.email);

  // ─── 세계로학원 ────────────────────────────────────
  const academy = await prisma.academy.upsert({
    where: { slug: 'segyero' },
    update: {},
    create: {
      name: '세계로학원',
      slug: 'segyero',
      phone: '02-1234-5678',
    },
  });
  console.log('✅ Academy:', academy.name);

  // ─── 원장 계정 ────────────────────────────────────
  const director = await prisma.user.upsert({
    where: { email: 'director@segyero.kr' },
    update: {},
    create: {
      email: 'director@segyero.kr',
      passwordHash: await bcrypt.hash('segyero2026!', 12),
      name: '원장',
      role: 'director',
      academyId: academy.id,
    },
  });
  console.log('✅ Director:', director.email);

  // ─── 강사 계정 ────────────────────────────────────
  const teacherData = [
    { name: '김선생', subject: '수학', email: 'kim@segyero.kr', phone: '010-1111-2222', color: '#4A90D9' },
    { name: '박선생', subject: '영어', email: 'park@segyero.kr', phone: '010-3333-4444', color: '#7B68EE' },
    { name: '이선생', subject: '수학', email: 'lee@segyero.kr', phone: '010-5555-6666', color: '#20B2AA' },
  ];

  const teachers = await Promise.all(
    teacherData.map(async (td) => {
      const user = await prisma.user.upsert({
        where: { email: td.email },
        update: {},
        create: {
          email: td.email,
          passwordHash: await bcrypt.hash('teacher2026!', 12),
          name: td.name,
          role: 'teacher',
          academyId: academy.id,
        },
      });
      const teacher = await prisma.teacher.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          academyId: academy.id,
          name: td.name,
          subject: td.subject,
          phone: td.phone,
          email: td.email,
          avatarColor: td.color,
          userId: user.id,
          permissions: {
            manageStudents: false,
            manageClasses: false,
            manageAttendance: true,
            manageGrades: true,
            manageFinance: false,
            manageNotifications: false,
            viewReports: true,
            admin: false,
          },
        },
      });
      return teacher;
    })
  );
  console.log('✅ Teachers:', teachers.length);

  // ─── 반 (Classes) ─────────────────────────────────
  const classData = [
    { name: '초등수학 기초반', subject: '수학', level: '초등', fee: 280000, maxStudents: 8, color: '#4fc3a1', room: 'A강의실', teacherIdx: 0, schedule: [{ day: 1, start: '15:00', end: '17:00' }, { day: 3, start: '15:00', end: '17:00' }, { day: 5, start: '15:00', end: '17:00' }] },
    { name: '초등수학 심화반', subject: '수학', level: '초등', fee: 320000, maxStudents: 8, color: '#6366f1', room: 'B강의실', teacherIdx: 0, schedule: [{ day: 2, start: '15:00', end: '17:00' }, { day: 4, start: '15:00', end: '17:00' }] },
    { name: '영어 파닉스반', subject: '영어', level: '초등', fee: 150000, maxStudents: 10, color: '#f59e0b', room: 'C강의실', teacherIdx: 1, schedule: [{ day: 1, start: '17:00', end: '18:30' }, { day: 3, start: '17:00', end: '18:30' }] },
    { name: '영어 중급반', subject: '영어', level: '중등', fee: 200000, maxStudents: 8, color: '#ec4899', room: 'C강의실', teacherIdx: 1, schedule: [{ day: 2, start: '17:00', end: '18:30' }, { day: 4, start: '17:00', end: '18:30' }] },
    { name: '중등수학반', subject: '수학', level: '중등', fee: 350000, maxStudents: 6, color: '#8b5cf6', room: 'B강의실', teacherIdx: 2, schedule: [{ day: 2, start: '19:00', end: '21:00' }, { day: 4, start: '19:00', end: '21:00' }] },
  ];

  const classes = await Promise.all(
    classData.map(async (cd) => {
      const cls = await prisma.class.create({
        data: {
          academyId: academy.id,
          name: cd.name,
          subject: cd.subject,
          level: cd.level,
          fee: cd.fee,
          maxStudents: cd.maxStudents,
          color: cd.color,
          room: cd.room,
          schedules: {
            create: cd.schedule.map((s) => ({
              dayOfWeek: s.day,
              startTime: s.start,
              endTime: s.end,
            })),
          },
          teachers: {
            create: { teacherId: teachers[cd.teacherIdx].id, isPrimary: true },
          },
        },
      });
      return cls;
    })
  );
  console.log('✅ Classes:', classes.length);

  // ─── 학생 (Students) ──────────────────────────────
  const studentData = [
    { name: '김도윤', school: '한국초', grade: 4, phone: '010-1001-0001', parent: '김부모', parentPhone: '010-2001-0001', color: '#4A90D9', classIdxs: [0, 2] },
    { name: '이수아', school: '행복초', grade: 5, phone: '010-1001-0002', parent: '이부모', parentPhone: '010-2001-0002', color: '#7B68EE', classIdxs: [0, 2] },
    { name: '박준서', school: '한국초', grade: 6, phone: '010-1001-0003', parent: '박부모', parentPhone: '010-2001-0003', color: '#20B2AA', classIdxs: [1, 3] },
    { name: '최하은', school: '행복초', grade: 5, phone: '010-1001-0004', parent: '최부모', parentPhone: '010-2001-0004', color: '#FF6B6B', classIdxs: [0] },
    { name: '정민재', school: '미래초', grade: 3, phone: '010-1001-0005', parent: '정부모', parentPhone: '010-2001-0005', color: '#FFD93D', classIdxs: [2] },
    { name: '강서윤', school: '한국초', grade: 4, phone: '010-1001-0006', parent: '강부모', parentPhone: '010-2001-0006', color: '#6BCB77', classIdxs: [0, 3] },
    { name: '윤지호', school: '미래초', grade: 6, phone: '010-1001-0007', parent: '윤부모', parentPhone: '010-2001-0007', color: '#F4A261', classIdxs: [1] },
    { name: '한소희', school: '행복초', grade: 3, phone: '010-1001-0008', parent: '한부모', parentPhone: '010-2001-0008', color: '#A78BFA', classIdxs: [2] },
    { name: '오민준', school: '한국초', grade: 5, phone: '010-1001-0009', parent: '오부모', parentPhone: '010-2001-0009', color: '#34D399', classIdxs: [1, 3] },
    { name: '신예린', school: '미래초', grade: 4, phone: '010-1001-0010', parent: '신부모', parentPhone: '010-2001-0010', color: '#FB7185', classIdxs: [0] },
    { name: '류성현', school: '한국중', grade: 7, phone: '010-1001-0011', parent: '류부모', parentPhone: '010-2001-0011', color: '#60A5FA', classIdxs: [4] },
    { name: '임지은', school: '행복중', grade: 8, phone: '010-1001-0012', parent: '임부모', parentPhone: '010-2001-0012', color: '#FBBF24', classIdxs: [4, 3] },
    { name: '배현우', school: '한국중', grade: 7, phone: '010-1001-0013', parent: '배부모', parentPhone: '010-2001-0013', color: '#A3E635', classIdxs: [4] },
    { name: '조수진', school: '미래초', grade: 6, phone: '010-1001-0014', parent: '조부모', parentPhone: '010-2001-0014', color: '#F87171', classIdxs: [1, 3] },
    { name: '문지원', school: '행복초', grade: 5, phone: '010-1001-0015', parent: '문부모', parentPhone: '010-2001-0015', color: '#38BDF8', classIdxs: [0, 2] },
    { name: '황태양', school: '한국초', grade: 4, phone: '010-1001-0016', parent: '황부모', parentPhone: '010-2001-0016', color: '#C084FC', classIdxs: [2] },
    { name: '서나연', school: '미래중', grade: 8, phone: '010-1001-0017', parent: '서부모', parentPhone: '010-2001-0017', color: '#4ADE80', classIdxs: [4, 3] },
    { name: '권도현', school: '행복초', grade: 3, phone: '010-1001-0018', parent: '권부모', parentPhone: '010-2001-0018', color: '#FDE68A', classIdxs: [2] },
    { name: '송미래', school: '한국초', grade: 6, phone: '010-1001-0019', parent: '송부모', parentPhone: '010-2001-0019', color: '#FCA5A5', classIdxs: [1] },
    { name: '표진우', school: '미래초', grade: 5, phone: '010-1001-0020', parent: '표부모', parentPhone: '010-2001-0020', color: '#93C5FD', classIdxs: [0, 3] },
  ];

  const students = await Promise.all(
    studentData.map(async (sd, i) => {
      const attendanceNumber = String(1001 + i);

      // 학생 User 생성
      const studentUser = await prisma.user.create({
        data: {
          loginId: attendanceNumber,
          passwordHash: await bcrypt.hash('student2026!', 12),
          name: sd.name,
          role: 'student',
          academyId: academy.id,
        },
      });

      const student = await prisma.student.create({
        data: {
          academyId: academy.id,
          name: sd.name,
          school: sd.school,
          grade: sd.grade,
          phone: sd.phone,
          avatarColor: sd.color,
          attendanceNumber,
          qrCode: `QR-S${String(i + 1).padStart(3, '0')}`,
          enrollDate: new Date('2026-03-01'),
          userId: studentUser.id,
          classEnrollments: {
            create: sd.classIdxs.map((idx) => ({
              classId: classes[idx].id,
              isActive: true,
            })),
          },
        },
      });

      // 학부모 User 생성 및 연결
      const parentUser = await prisma.user.create({
        data: {
          loginId: sd.parentPhone,
          passwordHash: await bcrypt.hash('parent2026!', 12),
          name: sd.parent,
          role: 'parent',
          academyId: academy.id,
        },
      });

      const parent = await prisma.parent.create({
        data: {
          name: sd.parent,
          phone: sd.parentPhone,
          userId: parentUser.id,
        },
      });
      await prisma.studentParent.create({
        data: { studentId: student.id, parentId: parent.id },
      });

      return student;
    })
  );
  console.log('✅ Students:', students.length);

  // ─── 청구서 (Bills) ───────────────────────────────
  const bills = await Promise.all(
    students.flatMap((student, si) =>
      studentData[si].classIdxs.map(async (classIdx) => {
        const cls = classes[classIdx];
        const bill = await prisma.bill.create({
          data: {
            academyId: academy.id,
            studentId: student.id,
            classId: cls.id,
            month: '2026-04',
            amount: cls.fee,
            paidAmount: si % 3 === 0 ? cls.fee : si % 3 === 1 ? Math.floor(cls.fee / 2) : 0,
            status: si % 3 === 0 ? 'PAID' : si % 3 === 1 ? 'PARTIAL' : 'UNPAID',
            dueDate: new Date('2026-04-10'),
            paidDate: si % 3 === 0 ? new Date('2026-04-05') : si % 3 === 1 ? new Date('2026-04-08') : null,
            method: si % 3 === 0 ? 'CARD' : si % 3 === 1 ? 'TRANSFER' : null,
          },
        });
        return bill;
      })
    )
  );
  console.log('✅ Bills:', bills.length);

  // ─── 지출 (Expenses) ──────────────────────────────
  await prisma.expense.createMany({
    data: [
      { academyId: academy.id, category: '임대료', description: '4월 강의실 임대료', amount: 2500000, date: new Date('2026-04-01') },
      { academyId: academy.id, category: '강사비', description: '김선생 4월 강사비', amount: 2000000, date: new Date('2026-04-25') },
      { academyId: academy.id, category: '강사비', description: '박선생 4월 강사비', amount: 1800000, date: new Date('2026-04-25') },
      { academyId: academy.id, category: '강사비', description: '이선생 4월 강사비', amount: 1500000, date: new Date('2026-04-25') },
      { academyId: academy.id, category: '교재비', description: '교재 구입비', amount: 350000, date: new Date('2026-04-03') },
      { academyId: academy.id, category: '공과금', description: '전기/수도 요금', amount: 120000, date: new Date('2026-04-15') },
      { academyId: academy.id, category: '기타', description: '소모품 구입', amount: 80000, date: new Date('2026-04-10') },
    ],
  });
  console.log('✅ Expenses created');

  // ─── 시험 + 성적 (Exams & Grades) ─────────────────
  const exam1 = await prisma.exam.create({
    data: {
      academyId: academy.id,
      classId: classes[0].id,
      name: '4월 단원평가',
      subject: '수학',
      date: new Date('2026-04-15'),
      totalScore: 100,
    },
  });

  const exam1Students = students.filter((_, si) => studentData[si].classIdxs.includes(0));
  const scores1 = [95, 88, 72, 65, 91, 78];
  const sorted1 = [...scores1].sort((a, b) => b - a);
  await Promise.all(
    exam1Students.slice(0, 6).map((s, i) =>
      prisma.gradeRecord.create({
        data: {
          academyId: academy.id,
          examId: exam1.id,
          studentId: s.id,
          score: scores1[i],
          rank: sorted1.indexOf(scores1[i]) + 1,
        },
      })
    )
  );
  console.log('✅ Exam + grades created');

  // ─── 캘린더 이벤트 ──────────────────────────────────
  await prisma.calendarEvent.createMany({
    data: [
      { academyId: academy.id, title: '개원기념일', date: new Date('2026-04-10'), type: 'ACADEMY_SCHEDULE', color: '#4fc3a1', isPublic: true },
      { academyId: academy.id, title: '봄 방학', date: new Date('2026-04-25'), type: 'ACADEMY_SCHEDULE', color: '#4fc3a1', isPublic: true },
      { academyId: academy.id, title: '4월 단원평가', date: new Date('2026-04-15'), type: 'ACADEMY_SCHEDULE', color: '#6366f1', isPublic: true },
      { academyId: academy.id, title: '김도윤 학부모 상담', date: new Date('2026-04-17'), startTime: '14:00', endTime: '14:30', type: 'CONSULTATION_SCHEDULE', color: '#6366f1', isPublic: false },
      { academyId: academy.id, title: '박준서 보강 수업', date: new Date('2026-04-19'), startTime: '15:00', endTime: '17:00', type: 'MAKEUP_SCHEDULE', color: '#8b5cf6', isPublic: true },
    ],
  });
  console.log('✅ Calendar events created');

  // ─── 공지사항 ────────────────────────────────────
  await prisma.announcement.createMany({
    data: [
      {
        academyId: academy.id,
        authorId: director.id,
        title: '4월 수강료 납부 안내',
        content: '4월 수강료 납부 기한은 4월 10일(목)까지입니다.\n계좌이체 또는 카드 결제 가능합니다.\n\n문의: 02-1234-5678',
        status: 'PUBLISHED',
        pinned: true,
        publishedAt: new Date('2026-04-01'),
      },
      {
        academyId: academy.id,
        authorId: director.id,
        title: '4월 단원평가 일정 안내',
        content: '초등수학 기초반 단원평가가 4월 15일(화)에 진행됩니다.\n시험 범위: 1~3단원\n\n열심히 준비해 주세요!',
        status: 'PUBLISHED',
        pinned: false,
        publishedAt: new Date('2026-04-05'),
      },
    ],
  });
  console.log('✅ Announcements created');

  // ─── 출결 기록 (AttendanceRecords) ────────────────────
  // 각 반의 수업 요일 (1=월,2=화,3=수,4=목,5=금 == getDay() 값과 동일)
  const classScheduleDaysArr = [
    [1, 3, 5], // classes[0] 초등수학 기초반: 월/수/금
    [2, 4],    // classes[1] 초등수학 심화반: 화/목
    [1, 3],    // classes[2] 영어 파닉스반: 월/수
    [2, 4],    // classes[3] 영어 중급반: 화/목
    [2, 4],    // classes[4] 중등수학반: 화/목
  ];
  // 각 반에 수강하는 학생 인덱스 (studentData 배열 기준)
  const classStudentIdxsArr = [
    [0, 1, 3, 5, 9, 14, 19],   // classes[0]
    [2, 6, 8, 13, 18],          // classes[1]
    [0, 1, 4, 7, 14, 15, 17],  // classes[2]
    [2, 5, 8, 11, 13, 16, 19], // classes[3]
    [10, 11, 12, 16],           // classes[4]
  ];
  // 각 반의 담당 강사 인덱스 (teachers 배열 기준)
  const classTeacherIdxArr = [0, 0, 1, 1, 2];
  // 상태 분포: PRESENT 80%, LATE 10%, ABSENT 7%, EARLY_LEAVE 3% (20칸)
  const ATT_STATUSES = [
    'PRESENT','PRESENT','PRESENT','PRESENT','PRESENT',
    'PRESENT','PRESENT','PRESENT','PRESENT','PRESENT',
    'PRESENT','PRESENT','PRESENT','PRESENT','PRESENT',
    'PRESENT','LATE','LATE','ABSENT','EARLY_LEAVE',
  ] as const;

  let attCount = 0;
  for (let ci = 0; ci < 5; ci++) {
    const scheduleDays = classScheduleDaysArr[ci];
    const studentIdxs = classStudentIdxsArr[ci];
    const teacherUserId = teachers[classTeacherIdxArr[ci]].id;

    // 2026년 4월 1일~17일 중 해당 반 수업 날짜만 순회
    for (let day = 1; day <= 17; day++) {
      const dateStr = `2026-04-${String(day).padStart(2, '0')}`;
      const dow = new Date(dateStr).getDay(); // 0=일,1=월,...,6=토
      if (!scheduleDays.includes(dow)) continue;
      const date = new Date(dateStr);

      for (let si = 0; si < studentIdxs.length; si++) {
        // 결정적(deterministic) 시드로 분포 유지
        const status = ATT_STATUSES[(ci * 23 + si * 7 + day) % ATT_STATUSES.length];
        await prisma.attendanceRecord.create({
          data: {
            academyId: academy.id,
            classId: classes[ci].id,
            studentId: students[studentIdxs[si]].id,
            date,
            status,
            checkedById: teacherUserId,
            checkedAt: date,
          },
        });
        attCount++;
      }
    }
  }
  console.log(`✅ AttendanceRecords: ${attCount}`);

  console.log('\n✨ Seeding complete!');
  console.log('\n📧 계정 정보:');
  console.log('  슈퍼어드민: superadmin@acams.kr / acams2026!');
  console.log('  원장:       director@segyero.kr / segyero2026!');
  console.log('  강사:       kim@segyero.kr / teacher2026!');
  console.log('  학생:       출석번호(1001~1020) + student2026!  (학원 선택 후 사용)');
  console.log('  학부모:     전화번호 + parent2026!  (학원 선택 후 사용)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
