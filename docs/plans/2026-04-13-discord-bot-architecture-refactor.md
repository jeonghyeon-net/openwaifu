# Discord Bot 아키텍처 리팩토링 실행 계획

작성일: 2026-04-13
상태: 완료

## 목표

- 루트 구조를 `00_ARCHITECTURE / 01_BOT / 02_EXTENSIONS / 03_SKILLS` 로 고정
- bot 런타임은 TypeScript + `discord.js` 유지
- pi resources 는 로컬 디렉터리에서 직접 로드
- 슬래시 커맨드 제거
- 모든 비봇 메시지에 응답
- 세션을 파일로 저장해 재부팅 후에도 이어가기
- bot 테스트와 Go 아키텍처 테스트 추가

## 실행 항목

1. 루트 계약 정리
- 루트 `README` 만 유지
- 루트 `.gitignore`, `.env.example`, `package-lock.json` 제거
- 루트 `package.json` 은 orchestration scripts 만 유지

2. bot 구조 정리
- `01_BOT/src/config`
- `01_BOT/src/features`
- `01_BOT/src/integrations`
- `01_BOT/tests`
- `01_BOT/vitest.config.ts`

3. Discord 입력 경로 단순화
- 슬래시 커맨드 제거
- 멘션 게이트 제거
- 모든 비봇 메시지를 chat request 로 변환

4. pi 런타임 정리
- 로컬 extensions / skills 직접 로드
- built-in tool 7종 모두 주입
- extension tool 은 `bindExtensions()` 로 바인드
- 채널/DM scope 별 session file 사용

5. 테스트 강화
- Go 아키텍처 테스트 보강
- bot unit test 추가
- lefthook 에 bot test 추가

## 완료 기준

아래가 모두 통과하면 완료로 본다.

```bash
npm run check
npm run test:bot
npm run test:arch
npm run test:extensions
bash -lc 'for dir in 02_EXTENSIONS/*/; do [ -f "$dir/package.json" ] || continue; (cd "$dir" && npm run build); done'
```
