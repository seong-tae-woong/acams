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
