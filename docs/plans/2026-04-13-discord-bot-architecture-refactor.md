# Discord Bot 아키텍처 리팩토링 구현 계획

> **에이전트 워커용:** REQUIRED SUB-SKILL: 이 계획은 `- [ ]` 체크박스 문법으로 진행 상황을 추적하므로, 작업별로 구현할 때는 subagent-driven-development(권장) 또는 executing-plans를 사용한다.

**목표:** 현 레포를 `00_ARCHITECTURE / 01_BOT / 02_EXTENSIONS / 03_SKILLS` 구조로 재배치하고, Discord 봇 런타임을 feature-first + integrations 구조로 분해한다.

**아키텍처:** 루트는 monorepo 오케스트레이터만 담당하고, 실제 앱은 `01_BOT` 에 둔다. `features` 는 유스케이스를, `integrations` 는 Discord/pi 외부 시스템 어댑터를 맡는다. 구조 규칙은 `00_ARCHITECTURE/tests` 의 Go 테스트로 고정한다.

**기술 스택:** TypeScript, discord.js, @mariozechner/pi-coding-agent, npm workspaces, Go test

---

### 작업 1: 루트 구조 재편

**파일:**
- 생성: `00_ARCHITECTURE/README`
- 생성: `01_BOT/README`
- 생성: `02_EXTENSIONS/README`
- 생성: `03_SKILLS/README`
- 수정: `package.json`
- 수정: `README.md`
- 수정: `.gitignore`
- 이동: `src/index.ts -> 01_BOT/src/main.ts`
- 이동: `tsconfig.json -> 01_BOT/tsconfig.json`

- [ ] **1단계: 실패 기준 정리**

```text
루트에 앱 소스 `src/` 가 남아 있으면 안 된다.
루트 package.json 은 dev/start/check/test:arch 스크립트를 가져야 한다.
```

- [ ] **2단계: 새 디렉터리 scaffold 생성**

```bash
mkdir -p 00_ARCHITECTURE/tests 01_BOT/src 02_EXTENSIONS 03_SKILLS
mv src 01_BOT/
mv tsconfig.json 01_BOT/
```

Expected: 루트에 `src/` 가 사라지고 `01_BOT/src/main.ts` 준비 상태가 된다.

- [ ] **3단계: 루트 스크립트 재작성**

```json
{
  "private": true,
  "workspaces": ["01_BOT", "02_EXTENSIONS/*"],
  "scripts": {
    "dev": "npm --workspace 01_BOT run dev",
    "start": "npm --workspace 01_BOT run start",
    "check": "npm --workspace 01_BOT run check",
    "test:arch": "cd 00_ARCHITECTURE/tests && go test -count=1 ./..."
  }
}
```

- [ ] **4단계: 문서/ignore 정리**

```gitignore
node_modules/
.env
.pi/
01_BOT/dist/
02_EXTENSIONS/*/dist/
.DS_Store
```

- [ ] **5단계: 커밋**

```bash
git add package.json README.md .gitignore 00_ARCHITECTURE 01_BOT 02_EXTENSIONS 03_SKILLS
git commit -m "refactor: scaffold architecture directories"
```

### 작업 2: bot 런타임 분해

**파일:**
- 생성: `01_BOT/package.json`
- 생성: `01_BOT/src/config/paths.ts`
- 생성: `01_BOT/src/config/env.ts`
- 생성: `01_BOT/src/features/chat/chat-service.ts`
- 생성: `01_BOT/src/features/pi-admin/pi-admin-service.ts`
- 생성: `01_BOT/src/integrations/discord/client.ts`
- 생성: `01_BOT/src/integrations/discord/commands.ts`
- 생성: `01_BOT/src/integrations/discord/register-commands.ts`
- 생성: `01_BOT/src/integrations/discord/handlers.ts`
- 생성: `01_BOT/src/integrations/pi/local-resource-paths.ts`
- 생성: `01_BOT/src/integrations/pi/pi-runtime.ts`
- 수정: `01_BOT/src/main.ts`
- 테스트: `npm run check`

- [ ] **1단계: bot package 정의**

```json
{
  "name": "@openwaifu/bot",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "start": "tsx src/main.ts",
    "check": "tsc --noEmit"
  }
}
```

- [ ] **2단계: config 분리**

```ts
// 01_BOT/src/config/paths.ts
export const paths = { repoRoot, botRoot, extensionsRoot, skillsRoot };

// 01_BOT/src/config/env.ts
export const env = { discordBotToken, discordGuildId, piModel };
```

- [ ] **3단계: pi integration 추출**

```ts
export class PiRuntime {
  async prompt(prompt: string): Promise<string> {}
  async listPackages(): Promise<string> {}
  async listResources(): Promise<string> {}
  async installPackage(source: string): Promise<string> {}
  async removePackage(source: string): Promise<string> {}
  async reload(): Promise<string> {}
}
```

- [ ] **4단계: feature 서비스 추출**

```ts
export const createChatService = (runtime: PiRuntime) => ({
  run: (prompt: string) => runtime.prompt(prompt),
});

export const createPiAdminService = (runtime: PiRuntime) => ({
  packages: () => runtime.listPackages(),
  resources: () => runtime.listResources(),
  install: (source: string) => runtime.installPackage(source),
  remove: (source: string) => runtime.removePackage(source),
  reload: () => runtime.reload(),
});
```

- [ ] **5단계: discord adapter 분리**

```ts
export function registerDiscordHandlers(deps: {
  client: Client;
  chatService: { run(prompt: string): Promise<string> };
  piAdminService: {
    packages(): Promise<string>;
    resources(): Promise<string>;
    install(source: string): Promise<string>;
    remove(source: string): Promise<string>;
    reload(): Promise<string>;
  };
}): void {}
```

- [ ] **6단계: 엔트리포인트를 wiring 전용으로 축소**

```ts
const runtime = await PiRuntime.create(...);
const chatService = createChatService(runtime);
const piAdminService = createPiAdminService(runtime);
const client = createDiscordClient();
registerDiscordHandlers({ client, chatService, piAdminService });
await registerSlashCommands(client, env.discordGuildId);
```

- [ ] **7단계: 타입체크 실행**

Run: `npm run check`
Expected: PASS

- [ ] **8단계: 커밋**

```bash
git add 01_BOT package.json package-lock.json
git commit -m "refactor: split bot into features and integrations"
```

### 작업 3: 구조 테스트와 로컬 리소스 scaffold 추가

**파일:**
- 생성: `00_ARCHITECTURE/tests/go.mod`
- 생성: `00_ARCHITECTURE/tests/00_init_test.go`
- 생성: `00_ARCHITECTURE/tests/01_root_entries_test.go`
- 생성: `00_ARCHITECTURE/tests/02_bot_required_files_test.go`
- 생성: `00_ARCHITECTURE/tests/03_bot_src_layout_test.go`
- 생성: `00_ARCHITECTURE/tests/04_extensions_required_files_test.go`
- 생성: `00_ARCHITECTURE/tests/05_skills_required_files_test.go`
- 생성: `00_ARCHITECTURE/tests/06_root_package_json_test.go`
- 생성: `02_EXTENSIONS/noop/package.json`
- 생성: `02_EXTENSIONS/noop/tsconfig.json`
- 생성: `02_EXTENSIONS/noop/README`
- 생성: `02_EXTENSIONS/noop/src/index.ts`
- 생성: `02_EXTENSIONS/noop/tests/.gitkeep`
- 테스트: `npm run test:arch`

- [ ] **1단계: Go init/helper 작성**

```go
var root string

func repoRoot(t *testing.T) string {
  if root != "" { return root }
  cwd, err := os.Getwd()
  if err != nil { t.Fatal(err) }
  root = filepath.Clean(filepath.Join(cwd, "../.."))
  return root
}
```

- [ ] **2단계: 루트/봇 구조 테스트 작성**

```go
var rootAllowed = map[string]bool{
  ".env": true, ".env.example": true, ".git": true, ".gitignore": true,
  ".mise.toml": true, ".pi": true, "00_ARCHITECTURE": true, "01_BOT": true,
  "02_EXTENSIONS": true, "03_SKILLS": true, "README.md": true, "docs": true,
  "node_modules": true, "package-lock.json": true, "package.json": true,
}
```

- [ ] **3단계: extension/skill scaffold 추가**

```ts
// 02_EXTENSIONS/noop/src/index.ts
export default function () {}
```

```text
03_SKILLS/
└── README
```

- [ ] **4단계: 구조 테스트 실행**

Run: `npm run test:arch`
Expected: PASS

- [ ] **5단계: 전체 검증 실행**

Run:
```bash
npm run check
npm run test:arch
```
Expected: PASS / PASS

- [ ] **6단계: 커밋**

```bash
git add 00_ARCHITECTURE 02_EXTENSIONS 03_SKILLS docs/plans
git commit -m "test: enforce repository architecture"
```
