# Savings & Investment 도메인 (저축·투자·쌈짓돈)

> 한 줄 요약: 적금 계좌·투자 포지션·저축 박스(쌈짓돈) 입출금을 관리한다. 금액 본문은 클라이언트 E2E 암호문이라 서버는 복호화하지 않고, `AssetCategory`의 고정 code(`SAVINGS`/`INVESTMENT`)를 대시보드 앵커로 삼아 `ledger`의 기여 지출과 연동한다.

## 1. 용어 정의

| 용어 (코드 식별자) | 의미 |
|--------------------|------|
| `SavingsAccount` | 적금 계좌 1건(다건). `name`·`color`(평문) + 암호문 블롭({base, goal}). `apps/api/prisma/schema.prisma:124` |
| `InvestmentPosition` | 투자 현재가(단건 싱글톤). `returnRate`(평문 소수 문자열) + 암호문 블롭({base}). `apps/api/prisma/schema.prisma:97` |
| `SavingsBoxTxn` | 저축 박스(쌈짓돈) 입출금 내역 1건. `type`·`source`·`date`(평문) + 암호문 블롭({amount, memo}). `apps/api/prisma/schema.prisma:109` |
| `type` | 저축 박스 방향: `"in"` \| `"out"`. `apps/api/src/asset/dto/savings-box.dto.ts:9` |
| `source` | 저축 박스 출처: `"cash"` \| `"savings"`. `apps/api/src/asset/dto/savings-box.dto.ts:11` |
| `returnRate` | 투자 수익률 평문 소수 문자열(정렬·표시용). `apps/api/src/asset/dto/investment.dto.ts:6` |
| `SavingsAccountService` / `InvestmentService` / `SavingsBoxService` | 각 엔티티 서비스. `apps/api/src/asset/savings-account.service.ts` 등 |

## 2. 핵심 엔티티와 애그리게이트

- **엔티티 목록**:
  - `SavingsAccount` — 적금 계좌(다건). CRUD 전체 지원.
  - `InvestmentPosition` — 투자 포지션(싱글톤). GET + PUT(upsert)만.
  - `SavingsBoxTxn` — 저축 박스 입출금 내역(다건). 생성·삭제·목록만(수정 없음).
- **애그리게이트**: 세 엔티티는 FK 관계 없이 각각 독립이다(서로 참조하지 않음). — `schema.prisma:124`·`:97`·`:109`
- **애그리게이트 루트**: 각 엔티티가 자체 루트인 단순 집합. 명시적 상위 애그리게이트 없음.
- 근거: `apps/api/prisma/schema.prisma:97`·`:109`·`:138`

## 3. 불변식 (invariant)

- INV-1: `SavingsBoxTxn.type`은 `in|out`, `source`는 `cash|savings`, `date`는 `"YYYY-MM-DD"`. DTO `@IsIn`/`@Matches`로 강제하며, `type`/`source`는 DB CHECK 제약도 있다(마이그레이션 `20260709020000_savings_box_txn_check`). — `apps/api/src/asset/dto/savings-box.dto.ts:8`·`:11`·`:14`
- INV-2: 본문 암호문은 `iv`·`ciphertext`·`authTag` 전부 또는 전무. `SavingsAccount` 수정에서 일부만 보내면 `CIPHERTEXT_INCOMPLETE_ASSET`. — `apps/api/src/asset/savings-account.service.ts:70`
- INV-3: `SavingsAccount.color`는 `#rrggbb`. — `apps/api/src/asset/dto/savings-account.dto.ts:11`
- INV-4: `InvestmentPosition.returnRate`는 빈 문자열 또는 (선택 음수·선행 소수점 허용) 소수 문자열. — `apps/api/src/asset/dto/investment.dto.ts:6`
- INV-5: `InvestmentPosition`은 사실상 싱글톤이다 — 서비스가 `findFirst`(createdAt 오름차순)로 기존 1행을 찾아 있으면 update, 없으면 create한다(코드 관례상 단건, DB unique 제약은 아님). — `apps/api/src/asset/investment.service.ts:38`
- INV-6: 서버는 금액 본문을 복호화하지 않는다(패스스루). — `apps/api/src/asset/savings-box.service.ts:1`

## 4. 상태와 상태 전이 규칙

명시적 상태 머신 없음. 세 엔티티 모두 상태 필드가 없다.

- `SavingsBoxTxn`은 수정 전이가 없다(생성·삭제만). — `apps/api/src/asset/savings-box.service.ts:2`, `savings-box.controller.ts`
- `InvestmentPosition`은 GET/PUT(upsert)만 — "없음 → 생성" 또는 "있음 → 갱신" 두 경로. — `apps/api/src/asset/investment.service.ts#upsert`(`:38`)

## 5. 비즈니스 규칙/정책

- RULE-1: 적금 계좌 목록은 `createdAt` 오름차순. `name`·`color` 평문 포함, 금액은 암호문. — `apps/api/src/asset/savings-account.service.ts#list`(`:44`)
- RULE-2: 적금 계좌 수정은 암호문 3필드가 다 없으면 `color`만 갱신 가능(부분 암호문만 거부). — `apps/api/src/asset/savings-account.service.ts:77`
- RULE-3: 투자 포지션 조회는 행이 없으면 `null` 반환. — `apps/api/src/asset/investment.service.ts:31`
- RULE-4: 저축 박스 목록은 `date` 내림차순, 동일 날짜는 `createdAt` 내림차순 안정 정렬. — `apps/api/src/asset/savings-box.service.ts#list`(`:39`)
- RULE-5: 이 도메인의 대시보드 집계 앵커는 `AssetCategory`의 고정 code `SAVINGS`·`INVESTMENT`이며, 해당 카테고리의 지출은 `ledger`의 `GET /expenses/contributions`로 조회한다(전 기간, removed 제외). — `apps/api/src/asset/asset-category.service.ts:29`·`:30`, `apps/api/src/asset/expense.service.ts:70`
- RULE-6: 쓰기 요청은 `CsrfMiddleware` + 전역 세션 가드로 보호된다. — `apps/api/src/asset/asset.module.ts:43`
- RULE-7(집계 위임): 저축 총액·목표 대비 진행률·투자 손익 계산은 서버에 없다. 클라이언트가 복호화 후 계산한다(서버는 `{base, goal}`·`{base}` 블롭 저장만). — `schema.prisma:124`·`:97`

## 6. 도메인 이벤트

구현된 도메인 이벤트 없음. CRUD·upsert는 이벤트 발행 없이 서비스에서 직접 Prisma로 처리한다. — `apps/api/src/asset/investment.service.ts`, `savings-account.service.ts`, `savings-box.service.ts`

## 7. 컨텍스트 경계와 책임

- **다루는 범위**: 적금 계좌 CRUD, 투자 포지션 GET/PUT, 저축 박스 목록·생성·삭제.
- **다루지 않는 범위 / 위임**:
  - 금액 복호화·총액/수익률/진행률 계산은 웹이 수행한다.
  - 저축·투자로의 "기여"에 해당하는 지출 자체는 `ledger`의 `Expense`(카테고리 SAVINGS/INVESTMENT)로 기록된다. 이 도메인은 그 지출을 소유하지 않고 앵커 code만 공유한다.
  - 인증/CSRF 보호는 `authentication`의 전역 가드 + `CsrfMiddleware`.
- **다른 도메인과의 관계**: `ledger`와 `AssetCategory` code(SAVINGS/INVESTMENT)를 공유. `password-vault`와는 무관.

## 8. 예외/에러 케이스

에러 코드는 `ASSET_ERRORS`(`apps/api/src/asset/asset.types.ts:5`).

| 상황 | 처리 | 에러 코드 / 예외 | 근거 |
|------|------|------------------|------|
| 적금 계좌 없음(수정/삭제) | 404 | `SAVINGS_ACCOUNT_NOT_FOUND` | `apps/api/src/asset/savings-account.service.ts:120` |
| 적금 계좌 부분 암호문 | 400 | `CIPHERTEXT_INCOMPLETE_ASSET` | `apps/api/src/asset/savings-account.service.ts:71` |
| 저축 박스 내역 없음(삭제) | 404 | `SAVINGS_BOX_NOT_FOUND` | `apps/api/src/asset/savings-box.service.ts:79` |
| 저축 박스 type/source/date 형식 오류 | 400(DTO) | class-validator 메시지 | `apps/api/src/asset/dto/savings-box.dto.ts:8`·`:11`·`:14` |
| 투자 returnRate 형식 오류 | 400(DTO) | class-validator 메시지 | `apps/api/src/asset/dto/investment.dto.ts:6` |

- `InvestmentService`는 전용 not-found 예외를 던지지 않는다(GET은 null, PUT은 upsert라 대상 부재 개념이 없음). — `apps/api/src/asset/investment.service.ts`

## 미사용 모델 주의

`SavingsGoal`(저축 목표 싱글톤) 모델이 `apps/api/prisma/schema.prisma:85`에 정의돼 있으나, 애플리케이션 코드(`apps/api/src`, `apps/web`)에서 참조되지 않는다(grep 결과 없음). 현재 저축 목표는 `SavingsAccount`의 `{base, goal}` 블롭으로 대체된 것으로 보인다. 서비스·컨트롤러·DTO·엔드포인트가 없어 도메인 기능으로 다루지 않는다 — **미구현/해당 없음**. — `database.md` "SavingsGoal (미사용 모델)" 참조.
