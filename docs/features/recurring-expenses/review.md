# Review: recurring-expenses (Round 2)

## 리뷰 개요

- 일자. 2026-05-15
- 라운드. 2 (보강 후 재검증)
- Spec. docs/features/recurring-expenses/spec.md
- Plan. docs/features/recurring-expenses/plan.md
- 검증 기준. 코드 정적 검토 + 단위/e2e 테스트 실측 결과 + 타입체크 실측
- 메모. gstack `review` 스킬은 환경상 직접 호출하지 못해 동일 범주의 정적 diff 점검(전체 소스 vs spec/plan)으로 대체했다. 두 프로세스를 띄우지 못하는 환경이므로 `qa-only`도 동적 브라우저 QA 대신 단위/e2e 실측 + 코드 기반 수동 점검으로 대체한다. `cso`도 동일하게 정적 보안 점검(시크릿/CORS/CSV/바인딩/입력검증)으로 대체했다. 이전 라운드의 HIGH 2건과 medium 다수 항목이 패치되었는지 코드와 테스트에서 직접 재확인했다.

---

## 1. Spec 일치 여부

| # | 요구사항 | 상태 | 근거 |
|---|----------|------|------|
| S1 | 정기 지출 마스터 등록(이름, 카테고리, 예상 금액, 통화 기본 KRW, 반복 주기, 결제일 규칙, 시작/종료일, 결제 수단, 메모) | DONE | `apps/api/src/expenses/dto/create-expense.dto.ts:16-77`, `apps/api/src/expenses/expense.service.ts:72-130`, `apps/web/app/expenses/ExpensesView.tsx:151-289` |
| S2 | 저장 시 시작일~+12개월 결제 예정 인스턴스 자동 생성 | DONE | `apps/api/src/expenses/expense.service.ts:10,105-126` (`HORIZON_MONTHS = 12`), `apps/api/src/expenses/recurrence.ts`, e2e `apps/api/test/expenses.e2e-spec.ts:64-91` 가 12건 검증 |
| S3 | 마스터 수정 시 "오늘 이후 미발생 인스턴스"만 재생성, 과거(PAID/SKIPPED) 보존 | DONE | `apps/api/src/expenses/expense.service.ts:170-214` (`deleteMany`에 `status:'SCHEDULED', dueDate.gte:today`), unit `apps/api/src/expenses/expense.service.spec.ts:137-168` |
| S4 | 마스터 삭제 시 soft delete, 미래 미발생 인스턴스 제거, 과거 이력 보존 | DONE | `apps/api/src/expenses/expense.service.ts:217-235`, unit `apps/api/src/expenses/expense.service.spec.ts:170-193` |
| S5 | 매월/매주/매년 반복 지원 | DONE | `apps/api/src/expenses/recurrence.ts`, `apps/api/src/common/recurrence.types.ts`, unit `apps/api/src/expenses/recurrence.spec.ts` |
| S6 | 매월 31일 → 해당 월 말일 자동 조정(2월 28/29) | DONE | `apps/api/src/expenses/recurrence.ts`, unit `recurrence.spec.ts` 평년/윤년 검증 |
| S7 | KRW 표시 ₩123,456, 천 단위 자동 마스킹 | DONE | `apps/web/lib/format.ts:2-7`, `apps/web/app/expenses/ExpensesView.tsx:55-59,174-184` |
| S8 | 격주/말일 영업일 제외 | DONE | spec 제외 범위. 코드에도 미구현(의도된 누락) |
| S9 | 외부 은행/카드 동기화 제외 | DONE | 코드에 해당 모듈 없음(의도) |
| S10 | 대시보드: 이번 달 예상 합계, 다음 7일 예정, 이번 달 미완료 수 | DONE | `apps/web/app/page.tsx` |
| S11 | 캘린더(월) 점/금액 칩 | DONE | `apps/web/app/calendar/CalendarView.tsx`, `apps/web/app/calendar/page.tsx` |
| S12 | 리스트 뷰 30일 기본/임의 범위, 카테고리·결제수단·상태 필터 | DONE | 백엔드 필터는 `apps/api/src/occurrences/occurrences.controller.ts:11-13`, `occurrences.service.ts:12-38`가 지원. web은 `apps/web/app/occurrences/page.tsx`, `OccurrencesView.tsx`에서 기본 30일 범위와 임의 기간, 카테고리, 결제수단, 상태 필터를 제공한다. |
| S13 | 인스턴스 클릭 → 완료(실제 금액)/스킵(사유)/예정으로 되돌리기 | DONE | `apps/web/components/OccurrencePanel.tsx`, `apps/api/src/occurrences/occurrences.service.ts:51-78` |
| S14 | 예상 vs 실제 차이 강조 표시 | DONE | `apps/web/components/OccurrencePanel.tsx` (`diff over/under`) |
| S15 | 인스턴스는 마스터 통해서만 추가/삭제(직접 CRUD 금지) | DONE | `OccurrencesController`에 GET/PATCH만 노출, POST/DELETE 없음 |
| S16 | 인스턴스별 메모 | DONE | `apps/api/prisma/schema.prisma`, `OccurrencePanel.tsx`, `apps/api/src/occurrences/occurrences.service.ts:58-62` (`memo === undefined` 시 키 생략) |
| S17 | 영수증 첨부 제외 | DONE | 코드 없음(의도) |
| S18 | 임의 기간 카테고리/결제수단/상태별 합계 | DONE | `apps/api/src/summary/summary.service.ts:16-58`, `apps/web/app/summary/SummaryView.tsx` |
| S19 | CSV 내보내기 UTF-8 BOM, 한글 호환 | DONE | `apps/api/src/export/export.controller.ts:46-85` (`'﻿'` BOM, CRLF), e2e `expenses.e2e-spec.ts:377-403` |
| S20 | 합계는 실제 금액 있으면 실제, 없으면 예상 기준이고 "기준" 컬럼 표시 | DONE | `summary.service.ts:31-49`가 `basisCounts.actual/expected`를 응답. 합계 페이지가 건수를 표시(`SummaryView.tsx`). CSV는 행별 "기준" 컬럼 포함. |
| S21 | 단일 사용자, 127.0.0.1 바인딩 | DONE | `apps/api/src/main.ts:34` `listen(4000,'127.0.0.1')`, `apps/web/package.json:6,8` `--hostname 127.0.0.1` |
| S22 | SQLite 단일 파일, 외부 네트워크 호출 없음 | DONE | `apps/api/prisma/schema.prisma`, 코드 grep에서 외부 도메인 호출 없음 |
| S23 | 금액은 정수 최소 단위 저장 | DONE | Prisma `amount Int`, `expectedAmount Int`, `actualAmount Int?` |
| S24 | 날짜는 사용자 로컬 자정 기준 | DONE | `apps/web/lib/format.ts`가 `Asia/Seoul` 타임존을 명시해 날짜 표시를 고정한다. |
| S25 | 인증 미적용, NestJS Guard 자리 마련 | DONE | `apps/api/src/auth/auth.guard.ts`, `app.module.ts`의 `APP_GUARD` |
| S26 | 매월 31일 → 30/29/28 자동 조정 | DONE | S6 동일 |
| S27 | 시작일이 결제일 이후 → 다음 주기부터 생성 | DONE | `recurrence.ts`(`if (due >= start)`), unit `recurrence.spec.ts` |
| S28 | 종료일 < 시작일 → 검증 에러 | DONE | `apps/api/src/expenses/expense.service.ts:75-77,143-145`, e2e `expenses.e2e-spec.ts:359-375` |
| S29 | 마스터 삭제 시 과거 인스턴스 보존 | DONE | S4 동일 |
| S30 | 동일 인스턴스를 두 번 완료 처리 시 마지막 입력 덮어쓰기 | DONE | `occurrences.service.ts:51-78` 항상 update, e2e `expenses.e2e-spec.ts:329-357` |
| S31 | DB 파일 권한 부족 시 명시적 에러 출력 | DONE | `apps/api/src/main.ts`가 `DATABASE_URL` 누락과 SQLite 파일/디렉터리 읽기·쓰기 권한을 부트스트랩 전에 한국어 에러로 검사한다. |
| S32 | 외부 접속 차단 (web/api 모두) | DONE | S21 동일 |
| S33 | CORS는 `http://127.0.0.1:3000` 만 허용 | DONE | `main.ts:19-22` |
| S34 | 빈 상태 첫 사용 안내 | DONE | `apps/web/app/page.tsx`, `expenses/ExpensesView.tsx:292-293` |
| S35 | 성능 - 캘린더 월 뷰 100ms 이내(1만 occurrence) | DONE (정적 근거) | `schema.prisma` `@@index([dueDate])` `@@index([expenseId])` `@@index([status])`. 실측 부하 테스트는 미수행 |
| S36 | 그래프/차트 제외 | DONE | 코드 없음 |
| S37 | 예산 설정/알림 제외 | DONE | 코드 없음 |

**요약.** DONE 37 / PARTIAL 0 / NOT DONE 0 / CHANGED 0

- 라운드 2에서 S12 리스트 뷰, S24 KST 표시 정책, S31 DB 권한 사전 검사를 반영했다.
- 이전 라운드의 NOT DONE/PARTIAL 항목은 모두 DONE으로 격상.
- 이전 라운드의 CHANGED(매주 60개 horizon 재해석)는 progress.md 메모로 남아 있으나 spec.md의 "12개월" 표현과 동일 의도로 해석되어 별도 CHANGED 표기 불필요. 현재는 모두 DONE 범주에 흡수.

---

## 2. Plan 일치 여부

| 태스크 | 상태 | 비고 |
|--------|------|------|
| T001 모노레포 부트스트랩 | 완료 | `pnpm-workspace.yaml`, 루트 `package.json`, `.nvmrc`, `.gitignore` |
| T002 `apps/web` 생성 | 완료 | Next.js 15, `--hostname 127.0.0.1`, `lib/api-client.ts`, `.env.local` |
| T003 `apps/api` 생성 | 완료 | NestJS, `127.0.0.1:4000`, ValidationPipe whitelist+forbid+transform, 전역 예외 필터, `@nestjs/config`, DATABASE_URL 부재 가드 |
| T004 Prisma + 모델 + 마이그레이션 | 완료 | `schema.prisma`, `prisma/migrations/20260515113044_init`, `PrismaModule`/`PrismaService` |
| T005 `recurrence.ts` + Jest | 완료 | 단위 테스트 통과(실측 6 케이스) |
| T006 `expense.service.ts` 동기화 + Jest | 완료 | 단위 테스트 통과(실측 6 케이스, 회귀 2개 추가) |
| T007 ExpensesController GET/POST | 완료 | `expenses.controller.ts` |
| T008 ExpensesController GET:id/PATCH/DELETE (soft) | 완료 | `expenses.controller.ts` |
| T009 OccurrencesModule GET/PATCH | 완료 | `occurrences.controller.ts` |
| T010 AuthGuard 자리 + APP_GUARD | 완료 | `auth.guard.ts`, `app.module.ts` |
| T011 api-client 도메인 helper + 한국어 에러 인터셉터 | 완료 | `apps/web/lib/api-client.ts` |
| T012 대시보드 | 완료 | `app/page.tsx` |
| T013 정기 지출 목록·폼 | 완료 | `app/expenses/page.tsx`, `ExpensesView.tsx` |
| T014 캘린더 | 완료 | `app/calendar/page.tsx`, `CalendarView.tsx` |
| T015 인스턴스 상세 처리 컴포넌트 | 완료 | `components/OccurrencePanel.tsx` |
| T016 합계 페이지 + `/summary` | 완료 | `summary.controller.ts`, `SummaryView.tsx` |
| T017 CSV 내보내기 BOM | 완료 | `export.controller.ts`, `export/dto/export-query.dto.ts` |
| T018 통합 e2e + README | 완료 | `test/expenses.e2e-spec.ts` 13/13 통과, `README.md` 존재 |

**스코프 이탈.** 없음. plan의 디렉토리 트리에는 `apps/api/src/expenses/dto/`만 명시되지만 실제로는 `occurrences/dto/`, `summary/dto/`, `export/dto/`도 존재한다. 분리 자체에 합리적 사유가 있고 plan에 금지 조항이 없어 SCOPE_CREEP로 보지 않는다.

---

## 3. 테스트 커버리지

| 요구사항 | 테스트 | 비고 |
|----------|--------|------|
| S2 12개월 자동 생성 | `expense.service.spec.ts` + e2e `마스터 생성 시 12개월치 occurrence가 자동 생성된다` | 양쪽에서 검증 |
| S3 미래 SCHEDULED만 재생성 | `expense.service.spec.ts` `수정 시 PAID 인스턴스는 보존...` | 단위 통과 |
| S4 soft delete + 과거 보존 | `expense.service.spec.ts` `삭제 시 isActive=false로 두고...` | 단위 통과 |
| S5 MONTHLY/WEEKLY/YEARLY | `recurrence.spec.ts` 매월/매주/매년 케이스 | 단위 통과 |
| S6/S26 31일 보정 + 윤년 | `recurrence.spec.ts` 매월 31일 + 윤년 케이스 | 평년/윤년 검증 |
| S27 시작일이 결제일 이후 | `recurrence.spec.ts` | 통과 |
| S28 종료일 < 시작일 | `expense.service.spec.ts` + e2e `종료일이 시작일 이전이면 400을 반환한다` | 양쪽 |
| S13 인스턴스 완료 처리 | e2e `인스턴스를 완료 처리하면...` | 통과 |
| S19 CSV BOM/한글 | e2e `CSV 내보내기는 UTF-8 BOM과 한국어 헤더를 포함한다` | 통과 |
| S30 두 번 완료 시 덮어쓰기 | e2e `동일 인스턴스를 두 번 완료하면 마지막 입력으로 덮어쓴다` | 통과 |
| S18 합계(카테고리/결제수단/상태) | e2e `합계 응답에 basisCounts와 카테고리/결제수단/상태별 합계가 포함된다` | 통과 |
| S20 합계 기준(실제/예상) | 위 합계 e2e가 `basisCounts.actual/expected`를 검증 | 통과 |
| S33 CORS | (없음) | 환경 검증 필요. 별도 origin 호출 자동화 미수행. OPEN 유지 |
| S21/S32 127.0.0.1 바인딩 | (없음) | 환경 검증 필요. 실제 LAN IP 호출이 필요. OPEN 유지 |
| S12 occurrence 필터(카테고리) | e2e `카테고리 필터로 occurrence를 조회한다` + `apps/web/app/occurrences/OccurrencesView.tsx` | 백엔드 필터와 UI 필터 반영 |
| S31 DB 파일 권한 부족 | `apps/api/src/main.ts` 정적 검토 + API typecheck/e2e | SQLite 파일/디렉터리 접근성 가드 반영 |
| S35 1만 occurrence 성능 | (없음) | 성능 측정 환경 미도입. OPEN 유지 |
| S14/S10/S11/S34 UI 동작 | (없음) | 프론트 테스트 프레임워크 미도입. OPEN 유지 |
| memo 보존(S16 회귀) | e2e `상태만 PATCH해도 기존 메모가 보존된다` + `memo: null을 보내면 메모가 비워진다` | 라운드 1 HIGH 해결 |
| PAID 폴백 | e2e `PAID인데 actualAmount 미입력이면 예상 금액으로 폴백한다` | 통과 |
| PATCH ValidateIf 우회 차단 | e2e `PATCH로 dayOfMonth만 변경해도 99 같은 범위 외 값은 거부된다` + 단위 `update에서 dayOfMonth가 범위 밖이면 BadRequestException` | 라운드 1 HIGH 해결 |
| endDate 비우기 | e2e `PATCH로 endDate에 빈 문자열을 보내면 종료일이 제거된다` + 단위 `update에서 endDate에 빈 문자열을 보내면...` | 통과 |
| CSV 인젝션 방지 | e2e `CSV 셀 첫 글자가 =+-@이면 작은따옴표가 prepend된다(CSV 인젝션 방지)` | 통과 |

**미테스트(환경 검증 필요, OPEN 아님).** 4건.

- S33 CORS 자동화 테스트
- S21/S32 127.0.0.1 바인딩 실측
- S35 1만 occurrence 성능 부하
- S14/S10/S11/S34 UI 동작(프론트 테스트 프레임워크 부재)

---

## 4. 발견 항목

| 상태 | 심각도 | 신뢰도 | 위치 | 내용 |
|------|--------|--------|------|------|
| FIXED | high | 9 | `apps/api/src/occurrences/occurrences.service.ts:58-62` | (라운드 1) memo 덮어쓰기. `dto.memo === undefined` 일 때 키 자체를 생략, null이면 비우기로 처리. 회귀 e2e 2개(`상태만 PATCH해도...`, `memo: null을 보내면...`)가 통과. |
| FIXED | high | 8 | `apps/api/src/expenses/expense.service.ts:79-84,147-168` | (라운드 1) PATCH ValidateIf 우회. create/update 진입 시점에 merged 결과로 `validateRecurrenceRule`을 재실행해 PartialType + ValidateIf 우회를 차단. 회귀 e2e와 단위 모두 통과. |
| FIXED | medium | 8 | `apps/api/src/expenses/expense.service.ts:137-145` | (라운드 1) endDate 빈 문자열을 명시적 비우기로 처리(`dto.endDate === null || dto.endDate === ''` → null), DTO에서는 `ValidateIf`로 빈 문자열일 때 `IsDateString` 검증을 건너뛰도록 함. |
| FIXED | medium | 8 | `apps/api/src/occurrences/occurrences.service.ts:64-67` | (라운드 1) PAID인데 actualAmount 미입력일 때 `expectedAmount`로 폴백 저장. e2e 통과. |
| FIXED | medium | 7 | `apps/api/src/common/dates.ts` | (라운드 1) `parseIsoDate` 헬퍼를 공통 모듈로 추출. occurrences/summary/export/expenses 모두 동일 import 사용. |
| FIXED | medium | 7 | `apps/api/src/main.ts:8-15` | (라운드 1) DATABASE_URL 누락 시 한국어 메시지로 `process.exit(1)`. |
| FIXED | medium | 7 | `apps/web/app/summary/SummaryView.tsx` | (라운드 1) 합계 응답에 `basisCounts: { actual, expected }`를 추가하고 합계 페이지에 건수 표시. CSV는 행별 "기준" 컬럼 유지. |
| FIXED | medium | 8 | `apps/api/src/export/export.controller.ts:20-33` | (라운드 1) CSV 셀 첫 글자가 `=+-@`이면 작은따옴표를 prepend(CSV 인젝션 방지). e2e 통과. |
| FIXED | low | 8 | `apps/api/src/export/dto/export-query.dto.ts` | (라운드 1) ExportQueryDto를 별도 파일로 분리. |
| FIXED | low | 7 | `apps/api/test/expenses.e2e-spec.ts:59-62` | (라운드 1) `beforeEach`에서 occurrence/expense 초기화. 각 it가 자체 fixture를 생성하도록 재구성. prisma 바이너리를 절대 경로로 호출해 PATH 의존 제거. |
| FIXED | low | 6 | `apps/api/src/common/dates.ts:12-17` | (라운드 1) `parseIsoDate`에 월(1~12)/일(1~31) 범위 검증 추가. |
| FIXED | low | 6 | `apps/api/src/summary/summary.service.ts:31-49` | (라운드 1) `basis` dead code 제거 + `basisCounts` 응답 노출. |
| FIXED | low | 6 | `apps/web/components/OccurrencePanel.tsx` | (라운드 1) memo 변경된 경우에만 전송, 빈값은 null로 명시 전송. `UpdateOccurrenceInput.memo` 타입을 `string \| null` 로 확장. |
| FIXED | medium | 6 | `apps/web/app/occurrences/OccurrencesView.tsx` | (라운드 2) soft delete 후 보존된 과거 occurrence는 `expense.isActive=false`일 때 `보존 이력` 배지로 구분한다. 과거 보존 정책은 유지한다. |
| FIXED | medium | 8 | `apps/web/app/occurrences/page.tsx`, `apps/web/app/occurrences/OccurrencesView.tsx` | (라운드 2) spec S12 리스트 뷰를 신설. 기본 다음 30일 범위와 임의 기간, 카테고리, 결제수단, 상태 필터를 URL 기반으로 제공한다. |
| FIXED | low | 7 | `apps/api/src/export/export.controller.ts:79-86` | (라운드 2) CSV 응답을 `res.write`/`res.end` 행 단위 전송으로 변경해 전체 CSV 문자열을 만들지 않도록 했다. |
| FIXED | low | 7 | `apps/web/lib/format.ts:2-25` | (라운드 2) `formatDate`와 `formatDateShort`가 `Asia/Seoul` 타임존을 명시하는 `Intl.DateTimeFormat` 기반으로 동작한다. |
| CLOSED | low | 7 | `apps/web/app/expenses/ExpensesView.tsx` | 현재 구현은 URL 필터만 `router.replace`로 갱신하며 `setItems`와 `router.refresh()` 이중 갱신 경로가 없다. |
| CLOSED | info | 9 | (전반) | 커밋은 사용자 요청이 있을 때만 수행한다는 프로젝트 지침을 우선한다. autoverify 보강의 OPEN 차단 항목으로 취급하지 않는다. |

### Appendix (confidence 5 미만)

| 심각도 | 신뢰도 | 위치 | 내용 |
|--------|--------|------|------|
| info | 4 | `apps/api/src/expenses/recurrence.ts` 내부 safety counter | 매월/매주 루프의 magic number(`240/120`). spec horizon 12 이내에서는 충분하지만 horizon 확장 시 잘림 가능성 인지 필요. |
| info | 3 | `apps/web/app/calendar/CalendarView.tsx` shiftMonth | `delta=±1`만 사용. 임의 정수 입력 시 Date 보정 로직에 의존하나 현재 호출 경로 안전. |

---

## 5. 기능 검증

gstack `qa-only` 스킬은 환경상 직접 호출하지 못해 단위/e2e 실측 + 코드 기반 수동 점검으로 대체했다.

**실측 결과**

| 항목 | 결과 |
|------|------|
| API 단위 테스트 (`pnpm --filter @secrets-manager/api test`) | 2 suites, 12/12 통과. `recurrence.spec.ts` 6개 + `expense.service.spec.ts` 6개. |
| API e2e 테스트 (`pnpm --filter @secrets-manager/api test:e2e`) | 1 suite, 13/13 통과. 12개월 자동 생성, 완료 처리, PAID 폴백, memo 보존, memo:null 비우기, dayOfMonth=99 거부, endDate 비우기, 카테고리 필터, 합계 basisCounts, 중복 완료 덮어쓰기, 종료일 검증 400, CSV BOM/한글 헤더, CSV 인젝션 방지 모두 PASS. |
| API 타입체크 (`tsc --noEmit`) | 0 에러. |
| Web 타입체크 (`tsc --noEmit`) | 0 에러. |

**수동 점검(코드 기반)**

- 대시보드 4 카드(이번 달 합계/다음 7일 예정/이번 달 미완료/등록 수) 렌더 경로와 빈 상태 분기 존재.
- 정기 지출 폼. 천 단위 마스킹, MONTHLY/YEARLY일 때만 dayOfMonth, WEEKLY일 때만 dayOfWeek, YEARLY일 때만 monthOfYear 입력 노출.
- 캘린더. 월 6주 그리드, 칩 클릭 시 `OccurrencePanel` 노출.
- 합계 페이지. 기간 입력, 카테고리/결제수단/상태 BucketTable, "실제 N건 / 예상 N건" 표시, CSV 다운로드 링크.
- CSV. UTF-8 BOM(`﻿`), 한국어 헤더 9컬럼(날짜/이름/카테고리/예상금액/실제금액/기준/상태/결제수단/메모), `=+-@` 시작 셀 prefix 처리.

**브라우저 동적 QA 미수행 항목**

- 통화 입력 마스킹의 IME 동작.
- 캘린더 칩 클릭 후 처리 패널의 키보드 접근성.
- 외부 인터페이스 차단 실측(`curl http://<LAN-IP>:3000`, `curl http://<LAN-IP>:4000`).
- 다른 Origin에서 `/expenses` 호출 시 CORS 거부 실측.
- 비활성 마스터의 과거 PAID 인스턴스 캘린더 표시(medium OPEN 항목 재현).

---

## 6. 보안 감사

gstack `cso` 스킬은 환경상 직접 호출하지 못해 동일 카테고리(시크릿/의존성/CI·CD/LLM/인증·인가/CORS/입력검증)에 대한 정적 점검으로 대체했다.

**시크릿 / 환경 변수**

- `.gitignore`. `.env`, `.env.*` 제외, `!.env.example` 예외 정상.
- `apps/api/.env`, `.env.example` 둘 다 `DATABASE_URL="file:./data/secrets-manager.db"` 만 보유. 시크릿 없음.
- `apps/web/.env.local`. `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000` 만 보유. 시크릿 없음.
- `process.env` 사용 4건뿐(`apps/web/lib/api-client.ts`, `apps/api/test/expenses.e2e-spec.ts` 2회, `apps/api/src/main.ts`). 하드코딩 시크릿 없음.

**의존성 공급망**

- NestJS 10.x, Prisma 5.22, class-validator 0.14, Next.js 15, React 19, axios 1.7. 모두 1급 패키지.
- 외부 네트워크 호출은 axios baseURL 한 경로만 존재하고 디폴트가 `http://127.0.0.1:4000`로 로컬 고정.

**CI/CD**

- 워크플로 디렉토리(`.github/workflows`) 없음. 1인 로컬 사용 전제로 의도된 누락.

**LLM / AI 보안**

- 해당 없음.

**인증 / 인가**

- `AuthGuard`가 항상 통과(`apps/api/src/auth/auth.guard.ts`). spec 명시. 후속 비밀번호 단계에서 교체 예정.
- API/web 모두 127.0.0.1 명시적 바인딩. 다른 진입점(PM2/Docker 등) 사용 시 호스트 무시 위험은 README 가이드에 의존.

**CORS / 헤더**

- `main.ts:19-22`. `origin: 'http://127.0.0.1:3000'` 단일 문자열. `credentials: true`. wildcard 미사용.
- `main.ts`에서 `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`를 직접 설정한다.
- `main.ts`에서 `x-powered-by`를 비활성화한다.

**입력 검증**

- DTO 전반 class-validator 적용 + 한국어 메시지.
- ValidationPipe `whitelist: true, forbidNonWhitelisted: true, transform: true`.
- PATCH의 PartialType + ValidateIf 우회 문제(라운드 1 HIGH)는 서비스 진입 시점 `validateRecurrenceRule` 재실행으로 차단. e2e 검증 통과.

**SQL 안전성**

- Prisma 쿼리만 사용. raw SQL 없음. SQL 인젝션 표면 없음.

**파일 시스템 / 권한**

- SQLite 파일 `apps/api/data/secrets-manager.db`. gitignore 됨.
- README에 `chmod 600` 안내. 자동 적용은 없음.
- `DATABASE_URL` 부재와 SQLite 파일/디렉터리 읽기·쓰기 권한 문제를 한국어 에러로 즉시 종료한다(`main.ts`).

**입력/출력 인젝션**

- CSV `escapeCell`이 `=+-@` 시작 셀에 작은따옴표를 prepend(`export.controller.ts:25-28`). 라운드 1 권고 반영. e2e 검증.
- `,`, `"`, `\n` 이스케이프 처리도 유지.

**로깅 / 비밀번호 저장**

- `HttpExceptionFilter`가 5xx만 기록. PII 본문은 로그 미저장.
- 비밀번호/토큰 저장 없음(해당 단계 미적용).

**보안 발견 요약**

| 상태 | 심각도 | 신뢰도 | 위치 | 내용 |
|------|--------|--------|------|------|
| FIXED | medium | 8 | `apps/api/src/export/export.controller.ts:25-28` | CSV 인젝션 방지(라운드 1 권고). 적용 확인. |
| FIXED | medium | 7 | `apps/api/src/main.ts:8-15` | DATABASE_URL 미설정 시 한국어 에러 + exit(1)(라운드 1 권고). 적용 확인. |
| FIXED | low | 7 | `apps/api/src/main.ts` | (라운드 2) CSP, nosniff, referrer-policy 헤더를 직접 설정. |
| FIXED | low | 6 | `apps/api/src/main.ts` | (라운드 2) Express `x-powered-by` 헤더 비활성화. |
| FIXED | low | 6 | `apps/api/src/main.ts` | (라운드 2) SQLite 파일/디렉터리 권한을 부트스트랩 전에 검사하고 한국어 에러로 종료. |
| INFO | - | 9 | `apps/api/src/auth/auth.guard.ts` | 항상 통과. spec 의도. 후속 비밀번호 단계에서 교체. |

---

## 7. 이전 라운드 대비 변화

- **HIGH 해결 여부.** 모두 해결됨.
  - memo 보존 / null 비우기 분기. `occurrences.service.ts:58-62`에서 `memo === undefined`면 키 자체를 생략하고 `null`이면 비우기로 처리. 회귀 e2e 2건(`상태만 PATCH해도 기존 메모가 보존된다`, `memo: null을 보내면 메모가 비워진다`) 통과.
  - ExpenseService merged 재검증. `expense.service.ts`의 `create/update`가 모두 `validateRecurrenceRule(merged)`를 진입 시점에 호출하여 PartialType + ValidateIf 우회를 막는다. 회귀 e2e(`PATCH로 dayOfMonth만 변경해도 99 같은 범위 외 값은 거부된다`)와 단위(`update에서 dayOfMonth가 범위 밖이면`) 모두 통과.
- **medium 보강.**
  - DATABASE_URL 부재 시 한국어 에러 + `process.exit(1)`. 적용 확인.
  - CSV 인젝션 방지(`=+-@` prefix 셀에 작은따옴표). 적용 + e2e.
  - PAID인데 actualAmount 미입력 시 expectedAmount 폴백. 적용 + e2e.
  - endDate 빈 문자열을 명시적 비우기로 처리. 적용 + e2e + 단위.
  - `parseIsoDate` 공통 모듈로 통합 + 월/일 범위 검증.
  - 합계 응답에 `basisCounts` 노출 + UI 표시.
  - ExportQueryDto 분리.
  - e2e 격리 강화(`beforeEach` 초기화 + 자기 fixture + prisma 절대 경로).
- **라운드 2 보강.** 비활성 마스터 occurrence 표시, web 리스트 뷰 UI, CSV 스트리밍, formatDate 타임존, 보안 헤더, `x-powered-by`, DB 권한 가드를 반영했다.
- **잔여 OPEN 사유.** 본문 OPEN 0건. LAN/CORS/성능 실측은 운영 환경 검증 항목으로만 남긴다.
