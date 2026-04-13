# openwaifu

Discord bot app + local pi resources.

## 구조

```text
/
├── 00_ARCHITECTURE/  # 구조 규칙 + Go 테스트
├── 01_BOT/           # 실제 Discord bot 앱
├── 02_EXTENSIONS/    # 로컬 pi extensions
├── 03_SKILLS/        # 로컬 pi skills
└── docs/             # 스펙/계획 문서
```

## 실행

```bash
npm install
npm run dev
```

## 검증

```bash
npm run check
npm run test:arch
```

## 환경 변수

루트 `.env` 사용.

```env
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_GUILD_ID=your-dev-guild-id
ANTHROPIC_API_KEY=sk-ant-...
PI_MODEL=claude-sonnet-4-5
```
