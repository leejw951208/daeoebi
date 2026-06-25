---
name: integration-qa
description: API↔웹 경계면 정합성(엔드포인트·shape·타입 일치)을 교차 비교하고 typecheck/lint/test를 실행. 모듈 완성 직후, 통합 검증·정합성 점검·"타입 맞는지 확인", "QA", "검증" 요청 시 반드시 이 스킬을 사용할 것.
---

# 통합 QA (경계면 정합성)

백엔드와 프론트엔드가 만나는 **경계면**을 교차 비교하고, 표준 검증 명령으로 회귀를 잡는다. 핵심은 "파일이 있는가"가 아니라 **"양쪽 shape이 일치하는가"**다.

## 경계면 교차 비교 절차
경계면 버그는 한쪽만 봐서는 안 보인다. **API와 웹을 동시에 열어** 대조한다.

1. **엔드포인트 목록 추출**
   - API: `apps/api/src/**/*.controller.ts`의 `@Controller`/`@Get`/`@Post`/`@Patch`/`@Delete` 경로·메서드.
   - 웹: `apps/web/lib/vault-client.ts`(및 호출처)의 `vaultClient.get/post/...` 경로·메서드.
2. **경로·메서드 대조**: 웹이 호출하는 모든 경로가 API에 존재하는가. 메서드(GET/POST/...)가 일치하는가.
3. **요청 shape 대조**: 웹이 보내는 바디·쿼리 필드명·타입이 API DTO(`*.dto.ts`)의 `class-validator` 필드와 일치하는가. 필수/옵셔널이 맞는가.
4. **응답 shape 대조**: API 서비스가 반환하는 객체 필드가 웹의 타입(`VaultEntry`, `VaultStatus` 등)과 일치하는가. 필드명·타입·옵셔널·날짜 직렬화(`Date` → string) 일치 여부.
5. **불일치 보고**: 어느 쪽이 옳은지 단정하지 않고 **양쪽 파일:라인을 병기**해 책임 엔지니어에게 넘긴다.

> 알려진 드리프트 예: 웹 `vault-client.ts`는 `/vault/entries`·`/vault/status`(master 모델)를 호출하지만, API는 `secrets`/`sites`/`categories`(PinGuard)로 구현돼 있다. 이런 경로·모델 불일치가 전형적인 경계면 버그다.

## 점진적 QA
- 전체 완성 후 1회가 아니라 **각 모듈 완성 직후** 검증한다. 일찍 잡을수록 싸다.
- 엔지니어가 "모듈 완성, 검증 요청" 메시지를 보내면 해당 경계면만 우선 비교한다.

## 검증 명령
프로젝트 표준 명령을 사용한다 (루트에서):
- `make typecheck` — 전체 타입 검사. 경계면 타입 불일치를 가장 잘 잡는다.
- `make lint` — ESLint (`--max-warnings 0`).
- `make test` — 전체 테스트 (api jest + web jest).
- 비주얼 회귀가 의심되면 `pnpm --filter @daeoebi/web test:visual`.

DB가 필요한 테스트는 `make dev`/`make migrate`로 DB 기동이 선행돼야 한다. 환경 문제로 인한 실패는 **코드 결함과 구분**해 보고한다.

## 보고 형식
`_workspace/`에 기록하고 리더에게 전달:
- **경계면 불일치**: `웹 파일:라인` ↔ `API 파일:라인` + 어긋난 내용 한 줄.
- **검증 결과**: typecheck/lint/test 각각 통과/실패 + 실패 시 핵심 로그(임의로 자르지 않음).

테스트 실패·불일치는 책임 엔지니어에게 즉시 통보한다.
