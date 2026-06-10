// 학생 등록/정보 관리 — 공용 상수·타입·입력 폼

import { StudentStatus } from '@/lib/types/student';

export const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: StudentStatus.ACTIVE, label: '재원' },
  { value: StudentStatus.ON_LEAVE, label: '휴원' },
  { value: StudentStatus.WITHDRAWN, label: '퇴원' },
  { value: StudentStatus.WAITING, label: '대기' },
];

export const DETAIL_TABS = [
  { value: 'info', label: '기본정보' },
  { value: 'class', label: '수강정보' },
  { value: 'attendance', label: '출결정보' },
  { value: 'grade', label: '성적정보' },
  { value: 'payment', label: '결제정보' },
  { value: 'consult', label: '상담정보' },
  { value: 'report', label: '리포트' },
];

export const AVATAR_COLORS = ['#4A90D9','#7B68EE','#20B2AA','#FF6B6B','#FFD93D','#6BCB77','#F4A261','#A78BFA','#34D399','#FB7185'];

export interface StudentForm {
  name: string; school: string; schoolLevel: string; grade: string;
  phone: string; parentName: string; parentPhone: string;
  status: StudentStatus; enrollDate: string; memo: string;
  birthDate: string;
  // 학원 SMS OFF 시 원장이 직접 지정 (smsEnabled=true면 무시됨)
  customStudentPassword: string;
  customParentPassword: string;
}

export const SCHOOL_LEVELS = ['초등학교', '중학교', '고등학교', '대학교'] as const;

export function parseSchool(full: string): { school: string; schoolLevel: string } {
  for (const lv of SCHOOL_LEVELS) {
    if (full.endsWith(lv)) return { school: full.slice(0, -lv.length), schoolLevel: lv };
  }
  return { school: full, schoolLevel: '초등학교' };
}

export const EMPTY_FORM: StudentForm = {
  name: '', school: '', schoolLevel: '초등학교', grade: '3',
  phone: '', parentName: '', parentPhone: '',
  status: StudentStatus.ACTIVE, enrollDate: new Date().toISOString().slice(0, 10), memo: '',
  birthDate: '',
  customStudentPassword: '', customParentPassword: '',
};

export interface PostRegisterInfo {
  newStudentId: string;
  studentLoginId: string;
  parentLoginId: string;
  studentTempPassword: string | null;
  parentTempPassword: string | null;
  parentAccountCreated: boolean; // 신규 학부모 계정 생성 여부 (기존 보호자 재사용이면 false)
  smsEnabled: boolean; // false면 모달에서 "직접 전달" 안내 + PW 강조
  siblingCandidates: Array<{ id: string; name: string; school: string; grade: number; avatarColor: string }>;
}

export function StudentFormFields({
  form,
  setForm,
  showTempPasswords = false,
}: {
  form: StudentForm;
  setForm: (f: StudentForm) => void;
  /** 학원 SMS OFF 상태일 때만 true — 임시 비밀번호 입력 필드 노출 */
  showTempPasswords?: boolean;
}) {
  const fieldClass = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* 이름 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">이름 *</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" className={fieldClass} />
      </div>
      {/* 학년 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">학년</label>
        <input type="number" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="3" className={fieldClass} />
      </div>
      {/* 학교명 + 학교급 (한 행 full-width) */}
      <div className="col-span-2 grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11.5px] text-[#6b7280] block mb-1">학교명</label>
          <input type="text" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="예: 한국" className={fieldClass} />
        </div>
        <div>
          <label className="text-[11.5px] text-[#6b7280] block mb-1">학교급</label>
          <select value={form.schoolLevel} onChange={(e) => setForm({ ...form, schoolLevel: e.target.value })} className={fieldClass}>
            {SCHOOL_LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
          </select>
        </div>
      </div>
      {/* 생년월일 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">생년월일</label>
        <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={fieldClass} />
      </div>
      {/* 입원일 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">입원일</label>
        <input type="date" value={form.enrollDate} onChange={(e) => setForm({ ...form, enrollDate: e.target.value })} className={fieldClass} />
      </div>
      {/* 학생 연락처 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">학생 연락처</label>
        <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01000000000" className={fieldClass} />
        {form.phone.includes('-') && (
          <p className="text-[10.5px] text-[#991b1b] mt-1">'-' 없이 숫자만 입력해주세요.</p>
        )}
      </div>
      {/* 보호자 이름 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">보호자 이름</label>
        <input type="text" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} placeholder="홍부모" className={fieldClass} />
      </div>
      {/* 보호자 연락처 */}
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">보호자 연락처 *</label>
        <input type="tel" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} placeholder="01000000000" className={fieldClass} />
        {form.parentPhone.includes('-') && (
          <p className="text-[10.5px] text-[#991b1b] mt-1">'-' 없이 숫자만 입력해주세요.</p>
        )}
      </div>
      <div>
        <label className="text-[11.5px] text-[#6b7280] block mb-1">상태</label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
          className={fieldClass}
        >
          {STATUS_OPTIONS.slice(1).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="text-[11.5px] text-[#6b7280] block mb-1">메모</label>
        <textarea
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
          rows={2}
          className={`${fieldClass} resize-none`}
          placeholder="내부 메모 (보호자 비공개)"
        />
      </div>

      {showTempPasswords && (
        <div className="col-span-2 bg-[#fffbeb] border border-[#fcd34d] rounded-[8px] p-3 space-y-3">
          <div className="text-[11.5px] text-[#92400E] font-medium">
            테스트 모드 — SMS 발송이 꺼져 있어 임시 비밀번호를 직접 지정합니다.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">학생 임시 비밀번호 *</label>
              <input
                type="text"
                value={form.customStudentPassword}
                onChange={(e) => setForm({ ...form, customStudentPassword: e.target.value })}
                placeholder="6~20자, 영문/숫자 포함"
                maxLength={20}
                className={fieldClass}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">학부모 임시 비밀번호 *</label>
              <input
                type="text"
                value={form.customParentPassword}
                onChange={(e) => setForm({ ...form, customParentPassword: e.target.value })}
                placeholder="6~20자, 영문/숫자 포함"
                maxLength={20}
                className={fieldClass}
                autoComplete="off"
              />
            </div>
          </div>
          <p className="text-[10.5px] text-[#78350f]">
            아이디·이름 포함 금지. 학생 첫 로그인 시 변경이 강제되지 않아 같은 비번을 계속 쓸 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
