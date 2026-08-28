# STEP 2 인증·Role·RBAC 설계

## 목표

ADMIN과 USER 권한을 브라우저, Next.js 서버, Supabase RLS의 세 계층에서 일관되게 강제한다.

## 구조

- `auth.users`: Supabase Auth의 인증 주체
- `core.app_user`: role, active, 사용자 프로필의 업무 권한 주체
- `core.audit_log`: 관리자 변경 작업의 불변 감사 기록
- `lib/auth.ts`: Server Component, Server Action, Route Handler의 공통 권한 진입점
- `middleware.ts`: 세션 존재 여부에 대한 빠른 경로 보호
- RLS: 최종 데이터 접근 권한의 강제 계층

## 데이터 흐름

로그인 성공 → Supabase SSR cookie session 저장 → middleware가 세션 갱신 → 서버에서 `core.app_user` 조회 → `requireUser`/`requireAdmin`이 active와 role 확인 → 업무 데이터는 analytics SELECT, 관리자 변경은 core mutation RLS로 제한한다.

## 권한 원칙

- anon은 core/analytics 업무 데이터에 접근하지 않는다.
- authenticated USER는 허용된 analytics 조회만 한다.
- ADMIN만 app_user 변경과 audit 대상 mutation을 수행한다.
- 메뉴 노출은 보조 UX일 뿐 권한 판단에 사용하지 않는다.
- 자기 자신의 role을 ADMIN에서 제거하거나 active를 false로 바꾸는 요청은 서버와 DB에서 모두 거부한다.

## 오류 처리

- 미로그인 보호 경로: `/login?next=<원래 경로>`
- USER의 `/admin/*`: 서버에서 403
- 비활성 사용자: 세션이 있어도 권한 거부
- 로그인 실패: 로그인 화면에 안전한 일반 오류 문구 표시

## 범위 제외

- 기존 analytics 계산 SQL 변경
- service role key 브라우저 노출
- 기존 workflow 기능 개선
