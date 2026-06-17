# CLAUDE.md — 보안 지침 (Security Guidelines)

> 이 파일은 Claude Code가 개발 작업 시 반드시 준수해야 할 보안 원칙을 정의합니다.
> 두 가지 영역을 커버합니다:
> 1. Claude Code 사용 환경 보안 (도구 자체를 안전하게 쓰는 법)
> 2. 앱 개발 보안 하네스 (개발 중 실수를 능동적으로 차단하는 법)

---

## PART 1. 🔐 Claude Code 사용 보안

> Claude Code 도구 자체를 안전하게 운용하기 위한 규칙입니다.

---

### 1. 권한 아키텍처 (Permission Architecture)

<!-- MUST: 기본 원칙 -->
- Claude Code는 기본적으로 읽기 전용(read-only) 권한으로 동작한다.
- 파일 편집·테스트 실행·명령어 실행은 매번 명시적 승인이 필요하다.
- "Allow always" 자동 승인은 안전이 확인된 명령어에 한해 사용한다.
- Claude Code는 시작 폴더와 하위 폴더에만 쓰기 가능 — 상위 디렉터리 수정 시 명시적 승인 필수.
- 자주 사용하는 안전한 명령어만 allowlist에 등록한다 (permission fatigue 방지).

<!-- WARN: 샌드박스 활용 -->
- 외부 웹 서비스와 상호작용하는 스크립트·도구 호출은 VM 또는 /sandbox 모드에서 실행한다.
- /permissions 명령으로 현재 권한 설정을 주기적으로 감사한다.

---

### 2. 프롬프트 인젝션 방어 (Prompt Injection Defense)

<!-- MUST: 인젝션 방지 원칙 -->
- 외부에서 가져온 콘텐츠(웹 페이지·파일·이메일 등)를 Claude에 직접 파이핑하지 않는다.
- curl / wget 등 임의 웹 콘텐츠를 가져오는 명령은 기본 차단(blocklist) 상태를 유지한다.
- 네트워크 요청을 수행하는 도구는 사용자 승인 후에만 실행된다.
- 웹 fetch는 격리된 별도 컨텍스트 창에서 실행 — 메인 컨텍스트 오염 방지.
- 의심스러운 bash 명령은 allowlist 등록 여부와 무관하게 수동 승인을 요청한다.

<!-- WARN: 신뢰 검증 -->
- 처음 실행하는 코드베이스 또는 새 MCP 서버는 반드시 신뢰 검증(trust verification) 절차를 거친다.
- -p 플래그 비대화형 실행 시 trust verification이 비활성화됨 — 자동화 파이프라인에서 주의.
- 복잡한 bash 명령에는 자연어 설명이 포함되어야 이해 후 승인할 수 있다.

---

### 3. MCP 서버 보안 (MCP Security)

<!-- MUST: MCP 신뢰 원칙 -->
- MCP 서버는 직접 작성하거나, 신뢰할 수 있는 공급자의 서버만 사용한다.
- Anthropic은 서드파티 MCP 서버를 관리·감사하지 않는다 — 사용 전 직접 검토 필수.
- MCP 서버 목록(허용 목록)은 소스 컨트롤에 체크인된 Claude Code 설정으로 관리한다.
- MCP 서버별 권한은 명시적으로 구성한다 (최소 권한 원칙 적용).

<!-- WARN: ConfigChange 훅 -->
- 세션 중 설정 변경을 감사·차단해야 할 경우 ConfigChange 훅을 활용한다.

---

### 4. 클라우드 실행 & 환경 보안 (Cloud & Environment Security)

<!-- INFO: 클라우드 환경 특성 -->
- 클라우드 세션은 격리된 Anthropic 관리 VM에서 실행 — 각 세션 독립 보장.
- 네트워크 접근은 기본 제한; 필요 시 특정 도메인만 허용하도록 구성.
- Git push는 현재 작업 브랜치로만 제한 (클라우드 환경).
- 세션 종료 후 클라우드 환경은 자동 정리된다.

<!-- SAFE: 환경 격리 -->
- 민감한 저장소는 dev container를 활용해 추가 격리 환경에서 작업한다.
- 팀 환경에서는 managed settings로 조직 표준을 강제하고 버전 컨트롤로 공유한다.

---

## PART 2. 🛡️ 앱 개발 보안 하네스 (App Security Harness)

> Claude Code가 코드를 생성·수정할 때 능동적으로 적용하는 보안 규칙입니다.
> "일단 동작하게 만들고 나중에 보안 추가"는 허용하지 않습니다.
> 보안 취약점이 의심되면 코드 생성을 멈추고 먼저 알립니다.

---

### 5. 환경변수 & 시크릿 관리 (Secrets Management)

#### 🚨 BLOCK — 발견 즉시 중단하고 수정 요청

- 코드 내 API 키·토큰·비밀번호 하드코딩 발견 시 즉시 중단
  - 예: `const API_KEY = "sk-..."`, `password: "mypassword123"`
  - → "이 값을 환경변수로 이동하겠습니다. .env 파일을 생성해도 될까요?"
- `.env` 파일이 `.gitignore`에 없는 상태에서 커밋 시도 시 차단
  - → ".gitignore에 .env를 추가한 뒤 진행하겠습니다."
- 이미 노출된 키(git history, 공개 저장소)를 재사용하는 코드 발견 시 차단
  - → "이 키는 이미 노출되었을 수 있습니다. 새 키를 발급 후 교체를 권장합니다."

#### ✅ AUTO — 자동으로 안전한 패턴 적용

- 새 프로젝트 시작 시 자동으로 `.env.example` + `.gitignore` 생성
- 환경변수 접근은 항상 `process.env.KEY` 또는 `os.getenv("KEY")` 패턴 사용
- 환경변수 누락 시 앱 시작을 막는 validation 코드 자동 포함

```js
// ✅ AUTO 생성 예시 (Node.js)
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'API_KEY'];
requiredEnvVars.forEach(key => {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
});
```

#### 💡 SUGGEST — 더 안전한 대안 제안

- 로컬 `.env` 대신 Vercel / Supabase / AWS Secrets Manager 등 시크릿 관리 서비스 연동 제안
- 키 로테이션 주기(90일) 안내

---

### 6. DB & 데이터 보안 (Database Security)

#### 🚨 BLOCK — 발견 즉시 중단하고 수정 요청

- 비밀번호를 평문(plain text)으로 DB에 저장하는 코드
  - → "비밀번호는 반드시 bcrypt / argon2로 해시 후 저장합니다. 수정하겠습니다."
- SQL 쿼리에 사용자 입력값을 직접 문자열 연결하는 코드 (SQL Injection)
  - 예: `"SELECT * FROM users WHERE id = " + userId`
  - → "Prepared Statement / ORM 쿼리로 교체하겠습니다."
- 개인정보(이름·전화번호·주민번호·이메일)를 암호화 없이 저장하는 스키마

#### ✅ AUTO — 자동으로 안전한 패턴 적용

- 비밀번호 저장 시 항상 bcrypt (saltRounds ≥ 12) 또는 argon2 사용
- DB 쿼리는 항상 Prepared Statement 또는 ORM(Prisma, Drizzle, SQLAlchemy) 사용
- 민감 컬럼(주민번호, 카드번호 등) 생성 시 자동으로 암호화 컬럼 제안

```js
// ✅ AUTO 생성 예시 (비밀번호 저장)
import bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(plainPassword, 12);
await db.user.create({ data: { email, password: hashedPassword } });
```

#### ⚠️ WARN — 경고 후 개발자 확인 요구

- DB 연결 정보가 코드에 포함된 경우 경고
- 백업 파일(.sql, .dump)이 공개 디렉터리에 있는 경우 경고
- 프로덕션 DB를 개발 환경에서 직접 연결하는 경우 경고

---

### 7. 인증 & 인가 (Authentication & Authorization)

#### 🚨 BLOCK — 발견 즉시 중단하고 수정 요청

- JWT Secret이 짧거나 추측 가능한 값인 경우
  - 예: `JWT_SECRET=secret`, `JWT_SECRET=1234`
  - → "JWT_SECRET은 최소 32자 랜덤 문자열이어야 합니다. 안전한 값을 생성해 드릴까요?"
- 인증 없이 민감 API 엔드포인트가 공개되는 경우
  - → "이 엔드포인트에 인증 미들웨어가 없습니다. 추가하겠습니다."
- 클라이언트 사이드에서만 권한 검사하는 코드 (서버 검증 없음)

#### ✅ AUTO — 자동으로 안전한 패턴 적용

- JWT 생성 시 만료 시간(exp) 자동 포함 (access: 15m, refresh: 7d 권장)
- 비밀번호 재설정 토큰은 단회용(one-time) + 만료 시간 포함으로 생성
- 관리자 기능 라우트에는 역할(role) 기반 미들웨어 자동 추가

```js
// ✅ AUTO 생성 예시 (JWT 발급)
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);
```

#### 💡 SUGGEST — 더 안전한 대안 제안

- 자체 인증 구현 대신 Supabase Auth / NextAuth / Clerk 등 검증된 서비스 도입 제안
- MFA(다중 인증) 추가 여부 확인

---

### 8. API & 통신 보안 (API & Network Security)

#### 🚨 BLOCK — 발견 즉시 중단하고 수정 요청

- API 키를 프론트엔드 코드(브라우저에서 보이는 곳)에 포함하는 경우
  - → "이 키는 서버 사이드에서만 사용해야 합니다. API 라우트로 이동하겠습니다."
- HTTPS가 아닌 HTTP로 민감 데이터를 전송하는 엔드포인트

#### ⚠️ WARN — 경고 후 개발자 확인 요구

- CORS를 `*` (전체 허용)으로 설정한 경우
  - → "CORS를 허용할 도메인을 명시적으로 지정하는 것을 권장합니다. 어떤 도메인을 허용할까요?"
- Rate Limiting이 없는 인증 엔드포인트 (브루트포스 공격 위험)
  - → "로그인 엔드포인트에 rate limiting을 추가하겠습니다."
- 에러 메시지에 스택 트레이스·DB 구조·내부 경로가 노출되는 경우

#### ✅ AUTO — 자동으로 안전한 패턴 적용

- API 응답에서 민감 필드(password, secret, token) 자동 제거
- 프로덕션 환경에서 상세 에러 메시지 숨김 처리 자동 적용

```js
// ✅ AUTO 생성 예시 (민감 필드 제거)
const { password, ...safeUser } = user;
return res.json(safeUser);
```

---

### 9. 코드 생성 원칙 (Code Generation Principles)

- 보안 취약점이 의심되면 코드 생성을 멈추고 먼저 알린다
- "일단 동작하게 만들고 나중에 보안 추가"는 허용하지 않는다
- 외부 라이브러리 추가 시 마지막 배포일·취약점 이력을 언급한다
- 보안 관련 TODO 주석은 반드시 구현 후 제거한다 (미완성 보안 코드 배포 방지)
- 보안 이슈 발견 시 HackerOne(https://hackerone.com/anthropic-vdp)으로 신고

---

## ✅ 통합 배포 전 체크리스트 (Pre-Deploy Security Checklist)

### [PART 1] Claude Code 사용 보안
- [ ] 현재 권한 설정 확인 (/permissions)
- [ ] 신규 MCP 서버 신뢰 검증 완료 여부 확인
- [ ] 외부 콘텐츠 직접 파이핑 없음 확인
- [ ] 민감 정보 포함 파일 격리 여부 확인

### [PART 2] 앱 개발 보안

#### 시크릿 & 환경변수
- [ ] .env가 .gitignore에 포함되어 있는가
- [ ] git history에 키·비밀번호가 노출된 커밋이 없는가
- [ ] 프로덕션 환경변수가 플랫폼 시크릿 관리에 등록되어 있는가
- [ ] 모든 환경변수가 코드가 아닌 .env에서 읽히는가

#### 데이터 보안
- [ ] 비밀번호가 bcrypt/argon2로 해시 저장되는가
- [ ] SQL 쿼리가 Prepared Statement 또는 ORM을 사용하는가
- [ ] 민감 개인정보 컬럼이 암호화되어 있는가

#### 인증 & API
- [ ] JWT Secret이 32자 이상 랜덤 문자열인가
- [ ] 모든 민감 API에 인증 미들웨어가 적용되어 있는가
- [ ] CORS가 필요한 도메인만 허용하는가
- [ ] 로그인·회원가입 엔드포인트에 Rate Limiting이 있는가
- [ ] 에러 응답에 내부 정보가 노출되지 않는가

#### 프론트엔드
- [ ] 브라우저 번들에 서버 전용 API 키가 포함되지 않는가
- [ ] 권한 검사가 서버 사이드에서도 이루어지는가