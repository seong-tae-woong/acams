# 설계: 원장·강사 셀프 비밀번호 변경

생성: /office-hours · 2026-06-26
대상: AcaMS (acams) · 역할 director(원장) · teacher(강사)
상태: APPROVED (구현 대기)
범위 결정: D1=A (자발적 변경 진입점만) · D2=A (GNB 인앱 모달)

---

## 1. 문제 정의

로그인한 원장·강사가 **본인 의지로** 비밀번호를 바꿀 화면이 없다. 사용자는 "기능이 없다"고 체감하지만, 실제로는 진입점(버튼)만 빠져 있고 변경 능력 자체는 이미 구현되어 동작 중이다.

## 2. 핵심 발견 — 이미 90% 구현되어 있음

### 이미 동작하는 것 (원장·강사 포함)
- **셀프 변경 API** — `src/app/api/auth/change-password/route.ts`. JWT 쿠키 기반 **역할 무관** 동작. 현재 비번 확인(bcrypt)·복잡도 검증·최근 3개 재사용 차단·IP rate limit(15분 10회)·세션 토큰 재발급·감사로그(`PASSWORD_CHANGE`) 전부 포함.
- **변경 화면** — `src/app/change-password/page.tsx`. proxy의 `PUBLIC_PATHS`에 등록(`src/proxy.ts:12`). `mustChangePassword`면 전 경로를 이 화면으로 강제(`src/proxy.ts:155`).
- **강제 변경 트리거** — `src/app/login/actions.ts:124`. 관리자 초기화(임시 비번 발급) 또는 **원장 비번 90일 경과** 시 로그인 직후 자동 리다이렉트.
- **관리자 주도 초기화** — `src/app/api/teachers/[id]/reset-password/route.ts` 등. 원장→강사·학생 초기화 경로 완비.

### 진짜로 빠진 것
1. **자발적 진입점**: (admin) 공통 상단바 `src/components/admin/GNB.tsx`에 변경 버튼이 없음. super_admin은 `src/app/super-admin/SuperAdminHeader.tsx:88`에 동일 기능 보유. ← **이번 작업 대상.**
2. (인접 공백, **이번 범위 제외**) 원장 비번 분실 자가복구: 비번을 잊어 로그인 자체를 못 하는 원장은 운영자(super_admin)가 대신 초기화해야 함. 강사는 원장이 초기화 가능해 복구 경로 있음.

## 3. 범위 (D1 = A)

**포함**: 로그인 상태에서 현재 비밀번호를 알고 있는 원장·강사가 본인 비밀번호를 변경하는 진입점 추가. 기존 `/api/auth/change-password` 재사용. 백엔드·DB 변경 없음.

**제외(별도 과제로 분리)**:
- 원장 비번 분실 자가복구(이메일/SMS 재설정 링크) — 토큰 발급·만료·공개 재설정 페이지·발송 채널이 붙는 별도 기능.
- 강사 90일 만료 정책 적용 여부(현재 `ADMIN_ROLES`에 teacher 미포함, `login/actions.ts:104`).
- 비번 변경 폼 공유 컴포넌트화(super_admin 중복 제거) — 아래 "향후" 참조.

## 4. 구현 방식 (D2 = A) — GNB 인앱 모달

`SuperAdminHeader`의 검증된 모달 패턴을 `GNB`로 복제한다. 전체화면 `/change-password`(강제 변경 핵심 경로)는 **건드리지 않는다** → 회귀 위험 0. 화면 맥락 유지·취소 가능.

### 변경 파일: `src/components/admin/GNB.tsx` (단일 파일)

1. **imports 추가**: `useState`, lucide `KeyRound`·`X`, `toast`(`@/lib/stores/toastStore`).
2. **상태 추가**:
   ```ts
   const [pwOpen, setPwOpen] = useState(false);
   const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
   const [loading, setLoading] = useState(false);
   ```
3. **handleSubmit**: `SuperAdminHeader.tsx:27-56`을 그대로 복제.
   - 새 비번/확인 불일치 → 클라 차단(toast error).
   - `POST /api/auth/change-password` `{ currentPassword, newPassword }`.
   - 실패 → `data.error` toast. 성공 → "비밀번호가 변경되었습니다." toast + 모달 닫기 + 폼 리셋.
   - **`data.redirectTo`는 무시**(현재 admin 페이지에 머무름). super_admin 모달도 동일하게 무시함.
4. **버튼 추가**: 우측 클러스터(이름 옆, 로그아웃 버튼 **앞**)에 아이콘 버튼.
   - GNB 다크 톤에 맞춤: 기존 로그아웃 버튼과 동일하게 `text-white/50 hover:text-white/90`, `title="비밀번호 변경"`.
   - GNB가 아이콘 단독(LogOut) 스타일이므로 `KeyRound` 아이콘 단독 권장(툴팁으로 라벨 제공).
5. **모달 JSX**: `SuperAdminHeader.tsx:106-165`을 복제. 라벨은 그대로 사용 가능 — **"현재 비밀번호 / 새 비밀번호(8자 이상) / 새 비밀번호 확인"** 으로 이미 자발적 맥락에 맞음("임시 비밀번호" 카피 아님).

### 백엔드/스키마
변경 없음. 권한 게이트 불필요(본인 계정). `/api/auth/change-password`는 `PUBLIC_PATHS`라 강사 권한 규칙을 우회 → **admin 권한 없는 강사도 403 없이 동작**(`src/proxy.ts:12`).

## 5. 엣지케이스 / QA 체크리스트
- [ ] 원장 로그인 → GNB에 버튼 노출 → 현재 비번 오입력 시 "현재 비밀번호가 올바르지 않습니다."
- [ ] 정상 변경 → 성공 toast + 모달 닫힘 + **로그아웃 안 됨**(현재 세션 쿠키 재발급, `change-password/route.ts:124`).
- [ ] **강사(admin 권한 없음)** 로그인 → 동일 동작(403 없음).
- [ ] 복잡도 위반(8자 미만/영문·숫자·특수문자 누락) → 서버 검증 메시지.
- [ ] 최근 3개 비번 재사용 → 차단 메시지.
- [ ] 새 비번/확인 불일치 → 클라 차단.
- [ ] rate limit(15분 10회) 초과 → 429 메시지.
- [ ] 다른 기기의 기존 세션은 `tokenVersion`++로 다음 요청 시 무효화(의도된 보안 동작 — 비번 변경 시 타 기기 로그아웃).
- [ ] **인강 영역(/ingang) 상단바**에도 버튼이 보이는지 확인 — `src/app/ingang/layout.tsx`가 GNB를 쓰는지/별도 상단바인지 점검. 별도면 동일 진입점 추가 여부 결정.

## 6. 검증 방법 (라이브 QA)
- director 시드계정으로 폼 로그인 → GNB 버튼 → 변경 → 재로그인 없이 정상 사용 확인. (참고: 운영 DB는 읽기전용 원칙, QA는 시드계정으로.)
- 강사 시드계정(권한 최소)으로 동일 경로 403 없이 성공 확인.

## 7. 향후 (별도 과제)
- **공유 컴포넌트화(원래 Approach C)**: `PasswordChangeModal`을 추출해 super_admin 헤더와 admin GNB가 공용. 중복 2벌 → 1벌. 동작 중 `SuperAdminHeader` 리팩터가 끼므로 이번 30분 작업과 분리.
- **원장 분실 자가복구(원래 Scope B)**: 이메일/SMS 재설정. solapi(SMS)는 연동돼 있으나 이메일 채널 없음. 토큰·만료·공개 재설정 페이지 설계 필요.
- **강사 90일 만료 정책**: 적용할지 결정(`login/actions.ts:104` `ADMIN_ROLES`).

## 8. The Assignment (다음 한 가지 행동)
`SuperAdminHeader.tsx`의 모달 블록(상태 + `handleSubmit` + 모달 JSX, 27-165행)을 `GNB.tsx`로 복제하고 버튼 하나를 우측 클러스터에 추가한다. 백엔드는 손대지 않는다. 단일 파일·단일 커밋으로 끝나는 작업.

## 9. 관찰
- 사용자의 전제("기능이 없다")는 절반만 맞았다. 능력은 있고 문이 없었다. 신규 기능을 만들기 전에 기존 인증 코드를 먼저 읽는 것이 30분 작업과 며칠 작업을 가른다.
- super_admin에는 진입점을 줬는데 원장·강사 GNB엔 빠진 비대칭 — 같은 패턴을 한 곳에만 적용한 흔적. 공유 컴포넌트화(향후)로 이 비대칭이 재발하지 않게 막을 수 있다.
