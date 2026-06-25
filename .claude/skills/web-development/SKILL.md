---
name: web-development
description: Next.js 15 App Router 화면·React 컴포넌트 구현, API 클라이언트 연동, 접근성(WCAG AA)·한국어 UI·반응형·PWA·Playwright 비주얼 테스트 작업을 수행. apps/web에서 화면 추가·수정, 컴포넌트 작성, 상태 처리, 프론트 버그 수정·재작업 시 반드시 이 스킬을 사용할 것.
---

# 웹 개발 (Next.js + React)

`apps/web`의 프론트엔드를 구현하는 절차와 규약. 모바일 우선 PWA, 한국어 UI, 접근성이 핵심 제약이다.

## 작업 전 확인
1. 손댈 화면·컴포넌트의 기존 파일을 먼저 읽는다. 라우트는 `app/(vault)/` App Router 구조, 공용 컴포넌트는 `components/`에 있다.
2. 요구사항은 `DESIGN_BRIEF.md`의 화면 명세를 기준으로 한다 (인증·보관함·백업 흐름, 그릴 화면 1~10).
3. API 호출은 반드시 `lib/vault-client.ts`를 통한다. 새 엔드포인트가 필요하면 api-engineer의 계약을 받아 클라이언트 함수를 추가한다.

## 구현 규약
- **클라이언트/서버 컴포넌트**: 상호작용·상태가 필요하면 `'use client'`. 그 외엔 서버 컴포넌트 기본. 디렉티브는 파일 첫 줄, 한국어 헤더 주석은 그 바로 아래.
- **상태 처리**: 로딩·에러·빈 상태·rate-limit/backoff를 모두 그린다 (`VaultStatusView`의 `loading`/`error` 패턴 참고). 상태 누락은 미완성으로 본다.
- **API 에러**: `lib/api-error.ts`의 `ApiError`로 처리한다. axios 에러를 화면에 그대로 노출하지 않는다.
- **민감 필드**: 비밀번호 등은 복사 후 자동 마스킹(30초) 동작을 보존한다. 클립보드는 `clipboard-clear.ts` 패턴으로 일정 시간 후 비운다.

## 접근성·한국어·반응형 (필수)
- **WCAG AA**: 키보드 포커스 가시성, aria 속성, 시맨틱 마크업, 터치 타깃 44px. 접근성 검사는 `tests/visual/accessibility.spec.ts`(axe) 기준을 통과해야 한다.
- **한국어**: 모든 사용자 노출 문구는 한국어. 문장 종결은 마침표, 콜론으로 끝내지 않는다.
- **반응형**: 모바일(≈375) → 태블릿(≈768) → 데스크탑(≈1280) 모두 동작.

## 비주얼 테스트
- 화면을 바꾸면 관련 Playwright 스냅샷을 갱신한다: `pnpm --filter @daeoebi/web test:visual:update` (의도된 변경일 때만).
- 회귀 확인은 `test:visual`. 스냅샷은 모바일/태블릿/데스크탑 3종이 있다.
- 단위 테스트는 `pnpm --filter @daeoebi/web test` (jest + testing-library).

## 검증
- 변경 후 `make typecheck`. API 응답 shape과 클라이언트 타입(`VaultEntry` 등)이 어긋나면 추측하지 말고 api-engineer에게 확인한다.
- 산출물 요약을 `_workspace/`에 남긴다.
