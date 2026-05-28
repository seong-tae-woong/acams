export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 비밀번호 복잡도 규칙 검증
 * - 8자 이상
 * - 영문자 포함
 * - 숫자 포함
 * - 특수문자 포함
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < 8) {
    return { valid: false, error: '비밀번호는 8자 이상이어야 합니다.' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: '영문자를 포함해야 합니다.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: '숫자를 포함해야 합니다.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return { valid: false, error: '특수문자(!@#$% 등)를 포함해야 합니다.' };
  }
  return { valid: true };
}

/**
 * 임시 비밀번호 전용 약식 검증 (학원 SMS OFF 모드에서 원장이 직접 지정)
 * - 6자 이상 20자 이하 (bcrypt 72바이트 한계, 한국어 안전 마진)
 * - 영문 또는 숫자 1종 이상 포함
 * - 학생/계정 식별자(loginId)나 이름을 그대로 포함하지 않음
 * - 흔한 약한 비번 블랙리스트 차단
 *
 * 학생 첫 로그인 시 강제 변경은 호출자(API)가 academy.smsEnabled로 분기 결정.
 */
const COMMON_WEAK_PASSWORDS = new Set([
  '123456', '12345678', 'password', 'qwerty', '111111', 'abcdef',
  '000000', '12341234', 'asdfasdf', 'aaaaaa',
]);

export function validateTempPassword(
  password: string,
  loginId: string,
  name: string,
): PasswordValidationResult {
  if (!password || password.length < 6) {
    return { valid: false, error: '임시 비밀번호는 6자 이상이어야 합니다.' };
  }
  if (password.length > 20) {
    return { valid: false, error: '임시 비밀번호는 20자 이하여야 합니다.' };
  }
  if (!/[a-zA-Z]/.test(password) && !/[0-9]/.test(password)) {
    return { valid: false, error: '영문 또는 숫자를 포함해야 합니다.' };
  }
  const lower = password.toLowerCase();
  if (loginId && lower.includes(loginId.toLowerCase())) {
    return { valid: false, error: '아이디를 포함할 수 없습니다.' };
  }
  if (name && name.length >= 2 && password.includes(name)) {
    return { valid: false, error: '이름을 포함할 수 없습니다.' };
  }
  if (COMMON_WEAK_PASSWORDS.has(lower)) {
    return { valid: false, error: '너무 흔한 비밀번호입니다.' };
  }
  return { valid: true };
}
