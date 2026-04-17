import type { AttendanceRecord } from '@/lib/types/attendance';
import { AttendanceStatus } from '@/lib/types/attendance';

// 2026년 4월 수업 진행일 (월수금: 1,3,5 / 화목: 2,4)
const APRIL_MWF = ['2026-04-01', '2026-04-03', '2026-04-06', '2026-04-08', '2026-04-10',
  '2026-04-13', '2026-04-15', '2026-04-17'];
const APRIL_TTH = ['2026-04-02', '2026-04-04', '2026-04-07', '2026-04-09', '2026-04-11',
  '2026-04-14', '2026-04-16'];

type StatusDist = { s: number; a: number; l: number; e: number }; // present/absent/late/earlyLeave counts

function generateRecords(
  students: { id: string; name: string }[],
  classId: string,
  className: string,
  dates: string[],
  dist: StatusDist = { s: 85, a: 5, l: 7, e: 3 },
  checkedBy = 't2',
): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  let idSeq = 1;

  const statuses = [
    ...Array(dist.s).fill(AttendanceStatus.PRESENT),
    ...Array(dist.a).fill(AttendanceStatus.ABSENT),
    ...Array(dist.l).fill(AttendanceStatus.LATE),
    ...Array(dist.e).fill(AttendanceStatus.EARLY_LEAVE),
  ];

  students.forEach((student) => {
    dates.forEach((date) => {
      const roll = Math.floor(Math.random() * 100);
      let status: AttendanceStatus;
      if (roll < dist.s) status = AttendanceStatus.PRESENT;
      else if (roll < dist.s + dist.a) status = AttendanceStatus.ABSENT;
      else if (roll < dist.s + dist.a + dist.l) status = AttendanceStatus.LATE;
      else status = AttendanceStatus.EARLY_LEAVE;

      records.push({
        id: `att-${classId}-${student.id}-${date.replace(/-/g, '')}-${idSeq++}`,
        studentId: student.id,
        studentName: student.name,
        classId,
        className,
        date,
        status,
        checkInTime: status !== AttendanceStatus.ABSENT ? '16:05' : null,
        checkOutTime: status === AttendanceStatus.EARLY_LEAVE ? '16:45' : null,
        memo: '',
        checkedBy,
        checkedAt: `${date}T16:10:00`,
      });
    });
  });
  // satisfy lint
  void statuses;
  return records;
}

export const mockAttendanceRecords: AttendanceRecord[] = [
  ...generateRecords(
    [{ id: 's1', name: '김도윤' }, { id: 's11', name: '임도현' }, { id: 's14', name: '유하준' }, { id: 's4', name: '최하은' }, { id: 's5', name: '정민재' }, { id: 's10', name: '송지우' }],
    'c1', '초등수학 기초반', APRIL_MWF, { s: 85, a: 5, l: 7, e: 3 }, 't2',
  ),
  ...generateRecords(
    [{ id: 's6', name: '강서윤' }, { id: 's9', name: '오승현' }, { id: 's12', name: '배서연' }, { id: 's3', name: '박준서' }, { id: 's2', name: '이수아' }, { id: 's15', name: '장수빈' }, { id: 's8', name: '한예린' }],
    'c2', '초등수학 심화반', APRIL_TTH, { s: 80, a: 7, l: 9, e: 4 }, 't2',
  ),
  ...generateRecords(
    [{ id: 's2', name: '이수아' }, { id: 's4', name: '최하은' }, { id: 's8', name: '한예린' }, { id: 's10', name: '송지우' }, { id: 's13', name: '권민서' }, { id: 's14', name: '유하준' }, { id: 's19', name: '문서현' }, { id: 's5', name: '정민재' }],
    'c3', '영어 파닉스반', APRIL_MWF, { s: 88, a: 3, l: 6, e: 3 }, 't3',
  ),
  ...generateRecords(
    [{ id: 's5', name: '정민재' }, { id: 's8', name: '한예린' }, { id: 's12', name: '배서연' }, { id: 's20', name: '양하윤' }, { id: 's1', name: '김도윤' }],
    'c4', '영어 중급반', APRIL_TTH, { s: 90, a: 3, l: 5, e: 2 }, 't3',
  ),
  ...generateRecords(
    [{ id: 's17', name: '조현우' }, { id: 's18', name: '황지민' }, { id: 's9', name: '오승현' }, { id: 's6', name: '강서윤' }, { id: 's1', name: '김도윤' }, { id: 's12', name: '배서연' }, { id: 's20', name: '양하윤' }],
    'c5', '중등수학 기초반', APRIL_MWF, { s: 82, a: 6, l: 8, e: 4 }, 't1',
  ),
];
