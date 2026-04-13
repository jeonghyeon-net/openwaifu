# Discord Bot 아키텍처 리팩토링 설계

작성일: 2026-04-13
상태: 승인됨

## 목표

현 레포를 단일 `src/index.ts` 중심 샘플에서, 구조가 강하게 고정된 앱 레포로 리팩토링한다.

핵심 목표:
- 최상위 디렉터리를 숫자 prefix 규칙으로 고정한다.
- Discord 봇 런타임은 TypeScript + `discord.js` 로 유지한다.
- pi extensions / skills 는 레포 내부 로컬 리소스로 관리한다.
- `pi install` 전제는 두지 않는다.
- 구조 규칙은 문서가 아니라 Go 테스트로 강제한다.

비목표:
- 봇 런타임을 Go로 재작성하지 않는다.
- 현재 단계에서 reminder/calendar/tasks 같은 비서 기능을 구현하지 않는다.
- 레포를 pi package 배포 구조로 만들지 않는다.

## 최상위 디렉터리 구조

리팩토링 후 루트 구조는 아래로 고정한다.

```text
/
├── 00_ARCHITECTURE/
├── 01_BOT/
├── 02_EXTENSIONS/
├── 03_SKILLS/
├── .env.example
├── .gitignore
├── .mise.toml
├── package-lock.json
├── package.json
└── README.md
```

각 디렉터리 역할:
- `00_ARCHITECTURE`: 구조 규칙 문서와 Go 테스트
- `01_BOT`: 실제 Discord 애플리케이션 런타임
- `02_EXTENSIONS`: 앱이 로컬에서 직접 읽는 pi extensions
- `03_SKILLS`: 앱이 로컬에서 직접 읽는 pi skills

루트에는 앱 소스코드를 두지 않는다. TypeScript 실행 코드는 `01_BOT` 밖에 두지 않는다.

## 01_BOT 내부 구조

`01_BOT` 는 실행 앱만 담당한다.

```text
01_BOT/
├── package.json
├── tsconfig.json
├── README
└── src/
    ├── main.ts
    ├── app/
    ├── config/
    ├── discord/
    ├── pi/
    └── shared/
```

역할:
- `src/main.ts`: 프로세스 부트스트랩. 의존성 조립만 수행
- `src/config/`: env 파싱, 경로 계산, 상수
- `src/discord/`: client 생성, slash command 등록, message/interaction adapter
- `src/pi/`: `createAgentSession`, `DefaultResourceLoader`, `DefaultPackageManager` 조립과 session refresh
- `src/app/`: 유스케이스
  - `chat`: DM/멘션/slash chat 처리
  - `pi_admin`: `/pi packages|resources|install|remove|reload` 처리
- `src/shared/`: 정말 공용인 유틸만 허용

원칙:
- Discord 이벤트 핸들러 안에 pi 로직을 직접 길게 쓰지 않는다.
- package/resource 관리 로직은 `app/pi_admin` 쪽으로 이동한다.
- `main.ts` 는 wiring 외 로직을 갖지 않는다.

## 02_EXTENSIONS 구조

`02_EXTENSIONS` 는 로컬 extension 저장소다. 배포용 전제는 두지 않는다. 앱이 직접 경로를 읽는다.

```text
02_EXTENSIONS/
├── README
└── <extension-name>/
    ├── package.json
    ├── tsconfig.json
    ├── README
    ├── src/
    │   └── index.ts
    └── tests/
```

원칙:
- extension 별 디렉터리 분리
- 엔트리 포인트는 `src/index.ts`
- 의존성은 각 extension 디렉터리에서 독립 관리 가능
- 현재 단계에서는 sample extension 1개 또는 placeholder README 정도만 둘 수 있다

## 03_SKILLS 구조

`03_SKILLS` 는 로컬 skill 저장소다.

```text
03_SKILLS/
├── README
└── <skill-name>/
    └── SKILL.md
```

원칙:
- skill 별 디렉터리 하나
- 필수 파일은 `SKILL.md`
- 앱은 이 디렉터리를 로컬 리소스로 직접 읽는다
- 현재 단계에서는 구조 scaffold 중심으로 두고, 기능성 skill 추가는 다음 단계에서 한다

## 리소스 로딩 방식

이 레포는 pi package 설치/배포를 전제로 하지 않는다. 실행 흐름은 아래와 같다.

1. 사용자는 루트에서 `npm install`, `npm run dev` 또는 `npm run start` 실행
2. 루트 스크립트가 `01_BOT` 실행
3. `01_BOT` 가 레포 루트 기준으로 `02_EXTENSIONS`, `03_SKILLS` 경로를 직접 로드
4. Discord bot 이 동작

의미:
- `pi install ./repo` 는 지원 목표가 아니다
- root `package.json` 의 역할은 monorepo 오케스트레이션이다
- pi resources 는 "설치"가 아니라 "레포 내부 내장 리소스" 로 취급한다

## package.json 구조

### 루트 package.json

역할:
- workspace 관리
- 루트 공통 스크립트 제공
- 아키텍처 테스트 실행 진입점 제공

예상 스크립트:
- `dev`: `01_BOT` 개발 서버 실행
- `start`: `01_BOT` 실행
- `check`: `01_BOT` 타입체크
- `test:arch`: `00_ARCHITECTURE/tests` Go 테스트 실행

루트 `package.json` 은 pi package manifest를 두지 않는다.

### 01_BOT/package.json

역할:
- 실제 앱 런타임 의존성 관리
- `discord.js`, `dotenv`, `@mariozechner/pi-coding-agent` 등 보유

### 02_EXTENSIONS/*/package.json

역할:
- extension 단위 의존성/스크립트 관리
- 현재 단계에서는 최소 구성만 둔다

## Go 아키텍처 테스트

`00_ARCHITECTURE` 의 목적은 구조를 설명하는 것이 아니라 강제하는 것이다.

```text
00_ARCHITECTURE/
├── README
└── tests/
    ├── go.mod
    ├── 00_init_test.go
    ├── 01_root_entries_test.go
    ├── 02_bot_required_files_test.go
    ├── 03_bot_src_layout_test.go
    ├── 04_extensions_required_files_test.go
    ├── 05_skills_required_files_test.go
    └── 06_root_package_json_test.go
```

1차 테스트 범위:
- 루트 허용 엔트리만 존재하는지 (`.env.example`, `package-lock.json` 포함)
- `01_BOT` 필수 파일이 존재하는지
- `01_BOT/src` 하위 허용 디렉터리만 존재하는지
- `02_EXTENSIONS/<name>` 에 필수 파일이 존재하는지
- `03_SKILLS/<name>/SKILL.md` 가 존재하는지
- 루트 `package.json` 에 필수 스크립트가 있는지

초기 단계에서는 line count, bundle output, theme schema 같은 고급 규칙은 넣지 않는다. 먼저 구조 규칙부터 잠근다.

## 현재 코드 마이그레이션

현재 파일:
- `src/index.ts`
- 루트 `package.json`
- 루트 `tsconfig.json`
- 루트 `.env.example`

리팩토링 후 이동 방향:
- `src/index.ts` → `01_BOT/src/main.ts` 및 하위 모듈로 분해
- 루트 `package.json` → monorepo orchestration 용으로 재작성
- 앱 관련 설정/의존성 → `01_BOT/package.json`, `01_BOT/tsconfig.json`
- `.env.example` 는 루트 또는 `01_BOT` 중 한 곳으로 정리하되, 1차에서는 루트 유지 가능

분해 대상 기능:
- Discord client/login
- slash command sync
- agent session 생성/refresh
- `/pi` admin command
- 일반 chat handling

## 실행 및 개발 흐름

개발자는 루트에서만 명령을 실행한다.

예상 흐름:
- `npm install`
- `npm run dev`
- `npm run check`
- `npm run test:arch`

즉, 사용자 경험은 단순 앱 레포 그대로 유지하고, 내부 구조만 monorepo 스타일로 강화한다.

## 에러 처리 원칙

1차 리팩토링에서 에러 처리 목표:
- slash command 처리 실패 시 Discord reply/editReply 에러 메시지 일관화
- session refresh 실패 시 install/remove/reload 명령 실패로 명확히 반환
- 구조 테스트 실패 시 리팩토링 위반으로 간주

구조 리팩토링 단계에서는 기능 추가보다 동작 보존을 우선한다.

## 테스트 전략

테스트는 두 층으로 나눈다.

1. 구조 테스트
- Go 기반
- 디렉터리/파일/규칙 검증

2. 앱 검증
- 기존 TypeScript 타입체크 유지
- 필요 시 이후 unit test 추가

1차 목표는 최소한 아래 두 명령이 모두 통과하는 상태다.

```bash
npm run check
npm run test:arch
```

## 구현 단계 순서

1. 루트/하위 디렉터리 scaffold 생성
2. `01_BOT` 로 기존 코드 이동
3. `src/index.ts` 를 `main.ts + app/discord/pi/config` 로 분리
4. 루트 package.json 재구성
5. Go 구조 테스트 추가
6. `02_EXTENSIONS`, `03_SKILLS` README 및 최소 scaffold 추가
7. 타입체크 및 구조 테스트 통과

## 트레이드오프

이 설계는 현재 규모 대비 다소 무거워 보일 수 있다. 하지만 의도적으로 그렇다.

얻는 것:
- 최상위 구조가 빨리 안정됨
- extension/skill 확장 여지가 미리 확보됨
- 단일 파일 성장으로 인한 재리팩토링 비용 감소
- reference repo 와 비슷한 유지보수 감각 확보

잃는 것:
- 초기 파일 수 증가
- 부트스트랩 코드 분리 작업 필요
- 지금 당장은 기능보다 구조 작업 비중이 큼

현재 목표가 “아키텍처를 확실하게 잡고 간다” 이므로 이 트레이드오프는 수용한다.
