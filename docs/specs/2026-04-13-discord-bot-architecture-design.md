# Discord Bot 아키텍처 리팩토링 설계

작성일: 2026-04-13
상태: 승인됨

## 목표

현 레포를 숫자 prefix 기반 구조로 고정하고, Discord 봇 런타임은 TypeScript + `discord.js` 로 유지한다.

핵심 목표:
- 최상위 구조를 강하게 고정한다.
- `01_BOT` 는 실제 앱 런타임만 담당한다.
- `02_EXTENSIONS`, `03_SKILLS` 는 레포 내부 로컬 리소스로 직접 로드한다.
- bot 은 슬래시 커맨드 없이 모든 비봇 메시지에 응답한다.
- 대화 세션은 재부팅 후에도 유지되도록 파일로 저장한다.
- 구조 규칙은 Go 테스트와 훅으로 강제한다.

비목표:
- bot 런타임을 Go 로 재작성하지 않는다.
- `pi install ./repo` 배포 흐름을 주 개발 흐름으로 삼지 않는다.
- bot 내부에서 extension/skill/package 를 관리하는 관리자 커맨드를 두지 않는다.

## 최상위 구조

```text
/
├── 00_ARCHITECTURE/
├── 01_BOT/
├── 02_EXTENSIONS/
├── 03_SKILLS/
├── docs/
├── .mise.toml
├── lefthook.yml
├── package.json
└── README
```

규칙:
- 루트 소스코드는 금지한다.
- 루트 README 는 `README` 만 허용한다.
- 루트 `.gitignore`, `.env.example`, `package-lock.json` 은 금지한다.
- 루트 `package.json` 은 orchestration 용 `scripts` 만 가진다.

## 01_BOT 구조

```text
01_BOT/
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── README
├── tests/
└── src/
    ├── main.ts
    ├── config/
    ├── features/
    └── integrations/
```

역할:
- `src/main.ts`: 부트스트랩과 wiring 만 담당
- `src/config/`: env 파싱, 경로 계산
- `src/features/chat/`: 메시지를 chat request 로 정규화하고 use case 실행
- `src/integrations/discord/`: Discord 이벤트 어댑터와 Discord 관리 custom tool
- `src/integrations/pi/`: pi session, tool, resource loading, session file 관리
- `tests/`: 순수 로직 테스트

원칙:
- feature 중심, integration 은 입출력 어댑터
- `shared`, `utils` 같은 잡동사니 1차 구조 금지
- Discord 핸들러 안에 pi 세부 로직 직접 작성 금지
- 슬래시 커맨드 금지
- 모든 비봇 메시지에 응답

## 대화 동작

입력 규칙:
- DM: 모든 비봇 메시지 처리
- Guild 채널: 모든 비봇 메시지 처리
- bot 메시지와 빈 문자열은 무시

세션 규칙:
- DM 은 사용자 단위 세션
- Guild 채널은 채널+사용자 단위 세션
- 세션 파일은 `01_BOT/.data/sessions/*.jsonl`
- 서버 재부팅 후에도 같은 scope id 로 다시 열어 이어간다

## pi 런타임 규칙

리소스:
- `02_EXTENSIONS` 아래 extension 루트를 직접 로드
- `03_SKILLS` 아래 skill 루트를 직접 로드

도구:
- pi built-in tool 7종 모두 사용
  - `read`
  - `bash`
  - `edit`
  - `write`
  - `grep`
  - `find`
  - `ls`
- Discord 관리용 custom tool 제공
  - 서버 목록/상태 조회
  - 채널 생성/수정/삭제
  - 메시지 전송
  - 역할 생성
  - 멤버 역할 변경
  - timeout/kick/ban 등 moderation
- guild 메시지에서는 Administrator 권한 사용자에게만 Discord 관리 tool 제공
- DM 에서는 `DISCORD_ADMIN_USER_IDS` allowlist 사용자에게만 Discord 관리 tool 제공
- `DISCORD_ADMIN_USER_IDS` 는 전역 superadmin 용도다
- guild 메시지에서 얻은 관리 세션은 현재 guild 범위로만 제한
- extension 이 제공하는 tool 은 `bindExtensions()` 로 추가 사용
- 이 구성은 trusted Discord 환경을 전제한다

관리 커맨드:
- `/pi install`, `/pi remove`, `/pi packages`, `/chat` 모두 사용하지 않는다
- bot 은 일반 메시지 인터페이스만 가진다

## 02_EXTENSIONS 구조

```text
02_EXTENSIONS/
├── README
└── <extension-name>/
    ├── .gitignore
    ├── biome.json
    ├── package.json
    ├── package-lock.json
    ├── README
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── src/
    │   ├── index.ts
    │   └── ...
    ├── tests/
    └── dist/
        └── index.js
```

규칙:
- extension 별 독립 빌드/테스트 가능
- 엔트리 포인트는 `src/index.ts`
- `pi.extensions` 는 `dist/index.js` 만 가리킨다
- coverage threshold 는 100/100/100/100
- build 결과는 단일 `dist/index.js`

## 03_SKILLS 구조

```text
03_SKILLS/
├── README
└── <skill-name>/
    └── SKILL.md
```

## 실행 흐름

```bash
cp 01_BOT/.env.example 01_BOT/.env
npm run setup
npm run dev
```

추가 설정:
- Discord developer portal 에서 Message Content intent 활성화
- Discord developer portal 에서 Server Members intent 활성화
- 필요 시 `DISCORD_ADMIN_USER_IDS` 로 DM 관리자 allowlist 설정
- 이 값은 전역 superadmin 이므로 최소 인원만 넣는다

검증 흐름:

```bash
npm run check
npm run test
```

## 테스트 전략

루트 검증 진입점은 `npm run test` 하나다.

내부 구성:
1. 구조 테스트
- `00_ARCHITECTURE/tests` 의 Go 테스트
- 루트 계약, bot 필수 파일, slash command 금지, extension 규칙 검증

2. bot 테스트
- `01_BOT/tests` 의 Vitest
- 메시지 정규화, 세션 파일 경로, runtime tool 구성 검증

3. extension 테스트
- 각 extension 내부 Vitest 검증

## 설계 이유

이 구조는 지금 당장 파일 수는 늘리지만, 이후 기능 확장에 유리하다.

얻는 것:
- runtime, resource, architecture 관심사 분리
- 세션 지속성과 사용자 단위 문맥 보장
- 동일 저장소 작업은 전역 직렬 실행으로 보호
- extension/skill 확장 시 루트 계약 유지
- 테스트와 훅으로 구조 회귀 방지

잃는 것:
- 초기 파일 수 증가
- 구조 규칙이 강해서 임시 코드를 넣기 불편함

현재 목표가 “아키텍처를 확실히 고정하고 계속 개발 가능한 상태 만들기” 이므로 이 트레이드오프를 수용한다.
