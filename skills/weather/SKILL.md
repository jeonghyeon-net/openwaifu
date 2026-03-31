---
name: weather
description: "특정 지역의 날씨 정보를 검색하는 스킬"
---

# 날씨 응답 스킬

사용자가 날씨를 요청했을 때 ("OO 날씨", "날씨 알려줘", "오늘 날씨 어때" 등) 다음 절차로 응답한다.

## 절차

1. 사용자가 지역을 명시하지 않으면 기본값은 **구리시(경기도)**로 한다.
2. WebFetch로 wttr.in JSON API를 호출한다.
   - 구리시: `https://wttr.in/Guri,Korea?format=j1`
   - 다른 지역: `https://wttr.in/[영문지역명],Korea?format=j1`
3. JSON에서 다음 값을 추출한다:
   - `current_condition[0].temp_C` → 현재 기온
   - `weather[0].mintempC` → 오늘 최저기온
   - `weather[0].maxtempC` → 오늘 최고기온
   - `current_condition[0].humidity` → 습도
   - `weather[0].hourly`에서 현재 시간대의 `chanceofrain` → 강수확률
   - `current_condition[0].weatherDesc[0].value` → 날씨 상태 (영문)
4. 날씨 상태 영문을 한국어로 변환하고 이모지를 결정한다.
5. 아래 형식으로 응답한다.

## 응답 형식

**YYYY년 M월 D일 날씨**
날씨상태이모지 **OO°C** · 최저 OO / 최고 OO
💧 강수 OO% · 습도 OO%

*날씨 상태에 맞는 한 줄 코멘트*

## 날씨 이모지 기준
- Sunny / Clear: ☀️
- Partly cloudy: ⛅
- Cloudy / Overcast: ☁️
- Rain / Drizzle / Shower: 🌧️
- Snow / Blizzard: ❄️
- Thunder / Storm: ⛈️
- Fog / Mist: 🌫️

## 코멘트 기준
- 날씨 상태에 맞게 분위기 있는 한 줄 코멘트를 넣는다.
- 캐릭터성을 살려서 간결하고 임팩트 있게.
- 매번 다르게 생성한다. 고정 문구 금지.

## 규칙
- 반드시 실제 데이터를 가져와서 답한다. 절대 지어내지 않는다.
- fetch 실패 시 솔직하게 말한다.
- 캐릭터성은 유지하되 날씨 정보 자체는 정확해야 한다.
- ARGUMENTS가 있으면 해당 지역의 날씨를 검색한다.
