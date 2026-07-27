# Ledger 도메인 (가계부)

> 한 줄 요약: 월별 수입·지출을 기록하고, 사용자/고정 카테고리로 분류하며, 고정 지출 템플릿에서 매월 지출 인스턴스를 멱등 생성한다. 금액·항목 본문은 클라이언트 E2E 암호문이라 서버는 복호화하지 않는다.

## 1. 용어 정의

| 용어 (코드 식별자) | 의미 |
|--------------------|------|
| `Income` | 월 수입 1건(월별 다건). `month`(평문) + 암호문 블롭. `apps/api/prisma/schema.prisma:71` |
| `Expense` | 지출 1건. `date`(평문, `@db.Date`) + 암호문 블롭. `apps/api/prisma/schema.prisma:159` |
| `RecurringExpense` | 고정 지출 템플릿(매월 자동 생성 원본). `apps/api/prisma/schema.prisma:137` |
| `AssetCategory` | 자산(지출) 카테고리. 고정(code 보유)과 사용자 생성(code null). `apps/api/prisma/schema.prisma:55` |
| `FIXED_CATEGORIES` | 고정 카테고리 11종 정의(name·color·code). `apps/api/src/asset/asset-category.service.ts:19` |
| `period` | 고정 인스턴스 멱등 키 "YYYY-MM". 일반 지출은 null. `schema.prisma:164` |
| `removed` | 이번 달만 삭제(소프트 삭제). 목록·집계 제외, 슬롯 유지. `schema.prisma:165` |
| `dayOfMonth` / `startMonth` / `termMonths` | 고정 스케줄: 생성일(1–31), 시작월, 기간(개월, null=무기한). `schema.prisma:139`·`:140`·`:141` |
| `method` | 고정 지출 방식(평문, 고정 탭 전용, 인스턴스로 전파 안 됨). `schema.prisma:145` |
| `active` | 고정 템플릿 활성 여부(false=자동생성 중지, 기록 유지). `schema.prisma:142` |
| `MONTH_RE` | 월 문자열 검증 정규식 `^\d{4}-(0[1-9]|1[0-2])$`. `apps/api/src/asset/asset.types.ts:2` |

## 2. 핵심 엔티티와 애그리게이트

- **엔티티 목록**:
  - `Income` — 월 수입(독립 행, FK 없음).
  - `Expense` — 지출 1건. 일반 지출 또는 고정 인스턴스(`recurringId`+`period`).
  - `RecurringExpense` — 고정 지출 템플릿. `instances Expense[]` 소유.
  - `AssetCategory` — 지출/고정 지출이 참조하는 분류(전역 평문).
- **애그리게이트**:
  - `RecurringExpense`(루트) ⊃ 자동 생성 `Expense` 인스턴스(`@@unique([recurringId, period])`로 월별 1건 보장). 템플릿 삭제 시 인스턴스 cascade 삭제. — `schema.prisma:163`·`:175`
  - `Income`·일반 `Expense`·`AssetCategory`는 각각 독립.
- **애그리게이트 루트**: `RecurringExpense`(고정 지출 라이프사이클의 경계·일관성 책임). `Income`·`AssetCategory`는 자체가 루트인 단순 엔티티.
- 근거: `apps/api/prisma/schema.prisma:71`·`:137`·`:159`·`:55`

## 3. 불변식 (invariant)

- INV-1: `month`·`period`·`startMonth`는 `"YYYY-MM"`(01–12) 형식. 위반 시 `INVALID_MONTH` 또는 DTO 400. — `apps/api/src/asset/income.service.ts:40`, `expense.service.ts:53`, `apps/api/src/asset/dto/recurring.dto.ts:24`
- INV-2: 고정 인스턴스는 `(recurringId, period)`가 유일하다(같은 템플릿·같은 달 1건). 중복 생성 시 `EXPENSE_DUPLICATE`(409). NULL끼리는 distinct라 일반 지출엔 제약 없음. — `schema.prisma:186`, `expense.service.ts:148`
- INV-3: `recurringId != null`이면 `period != null`이어야 한다(멱등 키 완결성). 수정 중 위반 시 `EXPENSE_PERIOD_REQUIRED`. — `apps/api/src/asset/expense.service.ts:169`
- INV-4: 고정 지출의 `date` 월은 `period`와 일치해야 한다. 불일치 시 `EXPENSE_PERIOD_MISMATCH`(날짜만 다른 달로 이동 금지). — `apps/api/src/asset/expense.service.ts:177`
- INV-5: 지출/고정/수입 본문 암호문은 `iv`·`ciphertext`·`authTag` 전부 또는 전무. 일부만 갱신 시 `CIPHERTEXT_INCOMPLETE_ASSET`. — `expense.service.ts:194`, `income.service.ts:69`, `recurring.service.ts:87`
- INV-6: 고정 카테고리(`code != null`)는 수정·삭제 불가(`assertUserCategory`). — `apps/api/src/asset/asset-category.service.ts:124`
- INV-7: 카테고리 이름은 중복 불가(생성·수정 시 `assertNameAvailable`, 수정 시 자기 자신 제외). — `apps/api/src/asset/asset-category.service.ts:139`
- INV-8: `dayOfMonth`는 1–31(DTO `@Min(1) @Max(31)`), `termMonths`는 1 이상 또는 null. — `apps/api/src/asset/dto/recurring.dto.ts:15`·`:29`
- INV-9(코드상 강제): `AssetCategory` 삭제 시 하위 `Expense`·`RecurringExpense`의 `categoryId`는 SetNull(미분류). — `schema.prisma:144`·`:167`, `asset-category.service.ts:89`

## 4. 상태와 상태 전이 규칙

- **상태 필드**: `RecurringExpense.active`(bool), `Expense.removed`(bool). 별도 enum은 없다.
- **고정 카테고리 시드 상태**: `AssetCategory.list()`가 누락된 고정 11종을 code 기준 멱등 시드한다(사실상 최초 1회). — `apps/api/src/asset/asset-category.service.ts:41`·`:47`

전이 규칙:

| From | To | 트리거 | 조건 | 근거 |
|------|----|--------|------|------|
| (없음) | 고정 인스턴스 생성 | `POST /expenses`(recurringId+period) | 해당 달 슬롯 미점유 | `expense.service.ts:133` |
| 인스턴스 존재 | 409 거부 | `POST /expenses` 재시도 | `(recurringId, period)` 중복 | `expense.service.ts:148` |
| 인스턴스 | 이번 달만 삭제 | `PATCH /expenses/:id {removed:true}` | 슬롯은 유지(재생성 차단) | `expense.service.ts:209`, `schema.prisma:165` |
| 일반 지출 | 고정 인스턴스로 전환 | `PATCH /expenses/:id {recurringId, period}` | period 동반 필수(INV-3) | `expense.service.ts:211` |
| 고정 활성 | 고정 해제(자동생성 중지) | `PATCH /recurring/:id {active:false}` | 기록은 유지 | `apps/api/src/asset/recurring.service.ts:77` |
| 고정 템플릿 | 전체 삭제 | `DELETE /recurring/:id` | cascade로 모든 인스턴스 삭제 | `apps/api/src/asset/recurring.service.ts:115`, `schema.prisma:163` |

- 자동 생성(머티리얼라이즈)의 실제 반복 로직은 **클라이언트가 수행**한다. 서버는 슬롯(`GET /expenses/slots`)·미래 인스턴스(`GET /expenses/instances`) 조회를 제공할 뿐이다. — `apps/api/src/asset/recurring.service.ts:2`, `expense.service.ts:84`·`:101`
- 말일 초과(`dayOfMonth`가 해당 월 말일 초과) 클램프도 클라이언트가 처리한다. — `schema.prisma:139`

## 5. 비즈니스 규칙/정책

- RULE-1: 월 지출 목록은 `date`가 해당 월 범위 `[start, end)`이고 `removed=false`인 행만, `date` 내림차순 반환. — `apps/api/src/asset/expense.service.ts#listByMonth`(`:52`)
- RULE-2: 소프트 삭제 슬롯도 `GET /expenses/slots`에는 포함된다(재생성 시 409 반복 방지). 슬롯 조회는 `period=month & recurringId != null`. — `apps/api/src/asset/expense.service.ts#listMonthSlots`(`:84`)
- RULE-3: 템플릿 수정 전파용 미래 인스턴스 조회는 `period > fromPeriod & removed=false`. 빈 `recurringId`는 400으로 사전 차단(Prisma undefined 필터 누출 방지). — `apps/api/src/asset/expense.service.ts#listInstancesAfter`(`:101`·`:104`)
- RULE-4: 저축·투자 탭용 기여 조회는 전 기간 `removed=false`를 `categoryId in [...]`로 필터. 빈 배열이면 빈 결과. — `apps/api/src/asset/expense.service.ts#listContributions`(`:70`)
- RULE-5: 고정 템플릿 목록은 `active=true`만, `createdAt` 오름차순. — `apps/api/src/asset/recurring.service.ts#listActive`(`:50`)
- RULE-6: `method`는 고정 탭 전용 평문이며 인스턴스(`Expense`)로 전파되지 않는다. — `schema.prisma:145`, `apps/api/src/asset/recurring.service.ts:2`
- RULE-7: 카테고리 목록은 고정(code 있음, 정의 순서) → 사용자 생성(code null, 생성순)으로 정렬. — `apps/api/src/asset/asset-category.service.ts#sortFixedThenUser`(`:109`)
- RULE-8: 사용자 카테고리 생성은 `code` 없이 `name`·`color`(#rrggbb)만. 이름 최대 20자. — `apps/api/src/asset/asset-category.service.ts:60`, `apps/api/src/asset/dto/asset-category.dto.ts:12`
- RULE-9: 존재하지 않는 `categoryId`/`recurringId` 참조(Prisma P2003)는 400 `ASSET_REFERENCE_NOT_FOUND`으로 매핑(서버 오류 아님). — `apps/api/src/asset/expense.service.ts:155`·`:269`
- RULE-10: 수입 목록은 `month` 일치 행을 `createdAt` 오름차순 반환(월별 다건). — `apps/api/src/asset/income.service.ts#listByMonth`(`:39`)

## 6. 도메인 이벤트

구현된 도메인 이벤트 없음. 수입·지출·고정·카테고리 변경은 이벤트 발행 없이 서비스에서 직접 Prisma로 처리한다(고정 인스턴스 자동 생성도 이벤트가 아니라 클라이언트 주도 API 호출). — `apps/api/src/asset/expense.service.ts`, `recurring.service.ts`

## 7. 컨텍스트 경계와 책임

- **다루는 범위**: 월 수입 CRUD, 지출 CRUD(일반·고정 인스턴스), 고정 지출 템플릿 CRUD, 자산 카테고리 CRUD·고정 시드.
- **다루지 않는 범위 / 위임**:
  - 금액·항목 복호화·집계(남은 돈, 카테고리 분해 등)는 웹이 수행한다. 서버는 암호문 패스스루.
  - 고정 지출의 실제 월별 머티리얼라이즈 루프·말일 클램프는 클라이언트 로직. 서버는 멱등 제약(unique)과 슬롯/인스턴스 조회만 보장.
  - 인증/CSRF 보호는 `authentication`의 전역 가드 + `CsrfMiddleware`에 위임. — `apps/api/src/asset/asset.module.ts:43`
- **다른 도메인과의 관계**:
  - `savings-investment`과 `AssetCategory`를 공유한다. 고정 카테고리 `code=INVESTMENT`/`SAVINGS`가 저축·투자 대시보드 앵커로 쓰이고, `GET /expenses/contributions`가 그 카테고리의 지출을 기여로 집계한다. — `apps/api/src/asset/asset-category.service.ts:29`·`:30`, `expense.service.ts:70`
  - `password-vault`와는 데이터 공유 없음.

## 8. 예외/에러 케이스

에러 코드는 `ASSET_ERRORS`(`apps/api/src/asset/asset.types.ts:5`).

| 상황 | 처리 | 에러 코드 / 예외 | 근거 |
|------|------|------------------|------|
| 지출 없음 | 404 | `EXPENSE_NOT_FOUND` | `expense.service.ts:276` |
| 고정 인스턴스 중복 | 409 | `EXPENSE_DUPLICATE` | `expense.service.ts:149`·`:225` |
| 고정 템플릿 없음 | 404 | `RECURRING_NOT_FOUND` | `recurring.service.ts:132` |
| 부분 암호문 | 400 | `CIPHERTEXT_INCOMPLETE_ASSET` | `expense.service.ts:197`, `income.service.ts:71`, `recurring.service.ts:90` |
| month/period/fromPeriod 형식 오류 | 400 | `INVALID_MONTH` | `expense.service.ts:54`·`:112`, `income.service.ts:41` |
| recurringId 누락(instances 조회) | 400 | `INVALID_RECURRING_ID` | `expense.service.ts:105` |
| 고정 전환 시 period 누락 | 400 | `EXPENSE_PERIOD_REQUIRED` | `expense.service.ts:170` |
| date 월 ≠ period | 400 | `EXPENSE_PERIOD_MISMATCH` | `expense.service.ts:181` |
| 없는 카테고리/템플릿 참조(FK) | 400 | `ASSET_REFERENCE_NOT_FOUND` | `expense.service.ts:271` |
| 수입 없음 | 404 | `INCOME_NOT_FOUND` | `income.service.ts:112` |
| 카테고리 없음 | 404 | `ASSET_CATEGORY_NOT_FOUND` | `asset-category.service.ts:164` |
| 카테고리 이름 중복 | 409 | `ASSET_CATEGORY_DUPLICATE` | `asset-category.service.ts:148` |
| 고정 카테고리 수정/삭제 시도 | 403 | `ASSET_CATEGORY_FIXED_READONLY` | `asset-category.service.ts:131` |
