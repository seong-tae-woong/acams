// 캘린더 파생 일정 생성 — 보강(MakeupClass)·반 수업(ClassSchedule)을
// CalendarEvent 레코드를 만들지 않고 조회 시점에 가상 이벤트로 합성한다.
import type { CalendarEvent } from '@/lib/types/calendar';

const MAKEUP_COLOR = '#8b5cf6';

// DayOfWeek DB 저장값(1=월..6=토, 7=일) → JS getDay()(0=일..6=토)
function toJsDay(dbDow: number): number {
  return dbDow === 7 ? 0 : dbDow;
}

export interface MakeupEventInput {
  id: string;
  makeupDate: Date;
  makeupTime: string;
  reason: string;
  originalClassId: string;
  originalClass: { name: string };
}

export interface ClassScheduleInput {
  id: string;
  name: string;
  color: string;
  schedules: { id: string; dayOfWeek: number; startTime: string; endTime: string }[];
}

// 보강 → 가상 캘린더 이벤트
export function buildMakeupEvents(makeups: MakeupEventInput[]): CalendarEvent[] {
  return makeups.map((m) => ({
    id: `makeup:${m.id}`,
    title: `${m.originalClass.name} 보강`,
    date: m.makeupDate.toISOString().slice(0, 10),
    startTime: m.makeupTime || null,
    endTime: null,
    type: '보강일정',
    isPublic: true,
    description: m.reason ? `보강 사유: ${m.reason}` : '',
    color: MAKEUP_COLOR,
    relatedStudentId: null,
    classId: m.originalClassId,
    className: m.originalClass.name,
    source: 'makeup',
  }));
}

// 반 주간 시간표 → 해당 월의 각 수업일 가상 캘린더 이벤트
export function buildClassScheduleEvents(
  classes: ClassScheduleInput[],
  year: number,
  month: number, // 1-indexed
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lastDay = new Date(year, month, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    const jsDow = new Date(year, month - 1, day).getDay();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    for (const cls of classes) {
      for (const sch of cls.schedules) {
        if (toJsDay(sch.dayOfWeek) !== jsDow) continue;
        events.push({
          id: `class:${sch.id}:${dateStr}`,
          title: cls.name,
          date: dateStr,
          startTime: sch.startTime,
          endTime: sch.endTime,
          type: '수업',
          isPublic: true,
          description: '',
          color: cls.color,
          relatedStudentId: null,
          classId: cls.id,
          className: cls.name,
          source: 'class',
        });
      }
    }
  }

  return events;
}
