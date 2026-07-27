# 데이터베이스

## 개요

- DBMS: PostgreSQL. `pg_trgm` 확장을 사용한다(라벨 부분검색용 GIN trigram 인덱스). — `apps/api/prisma/schema.prisma:9`·`:10`
- ORM: Prisma ^7.8.0. generator는 `prisma-client`(출력 `../generated/prisma`, `moduleFormat = cjs`), 드라이버 어댑터는 `@prisma/adapter-pg`(`PrismaPg`)로 `DATABASE_URL`에 연결한다. — `apps/api/prisma/schema.prisma:1`, `apps/api/src/prisma/prisma.service.ts:11`
- 스키마 파일: `apps/api/prisma/schema.prisma`. 마이그레이션: `apps/api/prisma/migrations/`(25개 디렉터리).

공통 규약: 본문이 암호화되는 모델은 `iv`/`ciphertext`/`authTag`(모두 `Bytes`) 3필드에 클라이언트 AES-256-GCM 암호문을 나눠 담는다. 서버는 이 값을 복호화하지 않는다. `id`는 특별한 언급이 없으면 `@default(cuid())` 문자열 PK다.

## 스키마

### WebauthnCredential

passkey 자격증명 + PRF로 래핑한 VK. 다중 기기 등록 허용. — `apps/api/prisma/schema.prisma:14`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| credentialId | Bytes | unique | raw credential id |
| publicKey | Bytes | | COSE 공개키 |
| counter | BigInt | default 0 | 서명 카운터 |
| transports | String[] | | 전송 방식 |
| deviceType | String? | nullable | |
| backedUp | Boolean | default false | |
| prfSalt | Bytes | | 이 자격증명의 PRF eval salt |
| wrappedVkPrf | Bytes | | packed `iv‖ct‖tag`(PRF로 래핑한 VK) |
| nickname | String? | nullable | |
| createdAt | DateTime | default now | |
| lastUsedAt | DateTime? | nullable | |
| updatedAt | DateTime | @updatedAt | |

### RecoveryWrap

복구코드로 래핑한 VK(단일 행, break-glass). — `apps/api/prisma/schema.prisma:31`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, default `"singleton"` | 단일 행 고정 id |
| rcSalt | Bytes | | 복구 래핑 salt |
| wrappedVkRc | Bytes | | packed `iv‖ct‖tag`(복구코드로 래핑한 VK) |
| verifier | Bytes | | `SHA-256(복구코드 바이트)`. 복구 시 상수시간 비교용 |
| createdAt | DateTime | default now | |
| updatedAt | DateTime | @updatedAt | |

### Site

비밀번호를 묶는 최상위 단위(라벨 평문). — `apps/api/prisma/schema.prisma:41`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| label | String | | 검색용 평문 |
| icon | String? | nullable | |
| createdAt / updatedAt | DateTime | | |

관계: `secrets Secret[]`. 인덱스: `@@index([label])`, GIN trigram `Site_label_trgm_idx`.

### Secret

라벨 평문 + AEAD 암호화된 비밀번호 본문 1건. — `apps/api/prisma/schema.prisma:182`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| siteId | String | FK→Site, onDelete Cascade | |
| label | String | | 평문 |
| iv / ciphertext / authTag | Bytes | | 암호문 블롭 |
| kdfVersion | Int | default 1 | |
| createdAt / updatedAt | DateTime | | |

인덱스: `@@index([siteId, label])`, GIN trigram `Secret_label_trgm_idx`.

### AssetCategory

자산(지출) 카테고리(전역 평문). — `apps/api/prisma/schema.prisma:55`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| name | String | | 카테고리명 |
| color | String | | 색(#rrggbb) |
| code | String? | unique, nullable | 고정 카테고리 안정 식별자. null = 사용자 생성 |
| createdAt / updatedAt | DateTime | | |

관계: `expenses Expense[]`, `recurring RecurringExpense[]`. 인덱스: `@@index([name])`.

> 현재 스키마의 AssetCategory에는 `kind` 컬럼이 없다(과거 `add_asset_category_kind` 마이그레이션은 후속 마이그레이션에서 정리됨). 문서에는 현재 스키마의 `name`·`color`·`code`만 기술한다.

### Income

월 수입(월별 다건). 금액은 암호문 블롭. — `apps/api/prisma/schema.prisma:71`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| month | String | | "YYYY-MM" 평문(월 범위 조회용) |
| iv / ciphertext / authTag | Bytes | | 암호문 블롭 |
| createdAt / updatedAt | DateTime | | |

인덱스: `@@index([month])`.

### RecurringExpense

고정 지출 템플릿(매월 자동 생성의 원본). — `apps/api/prisma/schema.prisma:137`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| dayOfMonth | Int | | 1–31. 말일 초과 시 클라가 클램프 |
| startMonth | String | | "YYYY-MM" 평문. 이 달부터 인스턴스 생성 |
| termMonths | Int? | nullable | null = 무기한, N = N개월 생성 |
| active | Boolean | default true | |
| categoryId | String? | FK→AssetCategory, onDelete SetNull | |
| method | String? | nullable | 지출 방식(평문). 고정 지출 탭 전용, 인스턴스로 전파 안 됨 |
| iv / ciphertext / authTag | Bytes | | 암호문 블롭({item,amount}) |
| createdAt / updatedAt | DateTime | | |

관계: `category AssetCategory?`, `instances Expense[]`. 인덱스: `@@index([active, createdAt])`, `@@index([categoryId])`.

### Expense

지출 1건. — `apps/api/prisma/schema.prisma:159`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| date | DateTime | `@db.Date` | 월 범위 조회·달력용 평문 |
| recurringId | String? | FK→RecurringExpense, onDelete Cascade | 일반 지출은 null |
| period | String? | nullable | "YYYY-MM". 고정 인스턴스 멱등 키 |
| removed | Boolean | default false | 이번 달만 삭제(소프트 삭제). 목록·집계 제외, 슬롯 유지 |
| categoryId | String? | FK→AssetCategory, onDelete SetNull | |
| iv / ciphertext / authTag | Bytes | | 암호문 블롭 |
| createdAt / updatedAt | DateTime | | |

제약/인덱스: `@@unique([recurringId, period])`(같은 템플릿·같은 달 1건, NULL끼리는 distinct), `@@index([removed, date])`, `@@index([categoryId])`.

### SavingsAccount

적금 계좌(다건). — `apps/api/prisma/schema.prisma:124`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| name | String | | 평문(item 매칭·식별) |
| color | String | | 평문 |
| iv / ciphertext / authTag | Bytes | | 암호문 블롭({base, goal}) |
| createdAt / updatedAt | DateTime | | |

### InvestmentPosition

투자 현재가(단건 싱글톤). — `apps/api/prisma/schema.prisma:97`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| returnRate | String | default "" | 수익률(평문 소수 문자열, 정렬·표시용) |
| iv / ciphertext / authTag | Bytes | | 암호문 블롭({base}) |
| createdAt / updatedAt | DateTime | | |

### SavingsBoxTxn

저축 박스(쌈짓돈) 입출금 내역(다건). — `apps/api/prisma/schema.prisma:109`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid | |
| type | String | | in\|out(평문) |
| source | String | | cash\|savings(평문) |
| date | String | | "YYYY-MM-DD" 평문(정렬·조회용) |
| iv / ciphertext / authTag | Bytes | | 암호문 블롭({amount, memo}) |
| createdAt / updatedAt | DateTime | | |

인덱스: `@@index([date])`. `type`/`source` 값 제약은 CHECK 마이그레이션(`20260709020000_savings_box_txn_check`)과 DTO `@IsIn`으로 강제된다(`apps/api/src/asset/dto/savings-box.dto.ts:8`·`:11`).

### SavingsGoal (미사용 모델)

저축 목표(단건 싱글톤) 모델이 스키마에 정의돼 있으나, **애플리케이션 코드에서 참조되지 않는다**. `apps/api/src/` 및 `apps/web/`(app·lib·components)에 `SavingsGoal`/`savingsGoal` 사용처가 없다(grep 확인). 저축 목표는 현재 `SavingsAccount`의 `{base, goal}` 블롭으로 대체된 것으로 보인다. — 모델 정의 `apps/api/prisma/schema.prisma:85`, 미참조 확인(grep 결과 없음)

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | String | PK, cuid |
| name | String | |
| iv / ciphertext / authTag | Bytes | |
| createdAt / updatedAt | DateTime | |

## 관계

- `Site 1 —— N Secret` (onDelete Cascade). — `apps/api/prisma/schema.prisma:185`
- `AssetCategory 1 —— N Expense` (onDelete SetNull). — `:167`
- `AssetCategory 1 —— N RecurringExpense` (onDelete SetNull). — `:144`
- `RecurringExpense 1 —— N Expense` (onDelete Cascade). 템플릿 삭제 시 인스턴스 전체 삭제. — `:163`
- `WebauthnCredential`·`RecoveryWrap`·`Income`·`SavingsAccount`·`InvestmentPosition`·`SavingsBoxTxn`은 다른 모델과 FK 관계가 없다(독립 테이블).

애그리게이트 경계: `Site`(루트) ⊃ `Secret`, `RecurringExpense`(루트) ⊃ 자동 생성 `Expense` 인스턴스. 자세한 경계는 도메인 문서 참조.

## 인덱스

| 모델 | 인덱스 | 목적 |
|------|--------|------|
| Site | `[label]`, GIN `Site_label_trgm_idx` | 정렬, 라벨 부분검색 |
| Secret | `[siteId, label]`, GIN `Secret_label_trgm_idx` | 사이트별 조회, 라벨 부분검색 |
| AssetCategory | `[name]` | 이름 정렬/중복 검사 |
| Income | `[month]` | 월별 조회 |
| RecurringExpense | `[active, createdAt]`, `[categoryId]` | 활성 목록, 카테고리 필터 |
| Expense | `unique[recurringId, period]`, `[removed, date]`, `[categoryId]` | 고정 멱등 키, 월 목록, 카테고리 집계 |
| SavingsBoxTxn | `[date]` | 날짜 정렬 |

## 마이그레이션

- 도구: Prisma Migrate. 적용은 `prisma migrate dev`(로컬, `apps/api/package.json` `prisma:migrate` / `make dev-migrate`), 배포는 `prisma migrate deploy`(`prisma:deploy`). — `apps/api/package.json`, `Makefile`
- 디렉터리: `apps/api/prisma/migrations/*` + `migration_lock.toml`.
- **규칙(불변)**: 이미 적용된 마이그레이션은 수정/삭제하지 않는다. 스키마 변경이 필요하면 새 마이그레이션을 추가한다. — 루트 `CLAUDE.md` §3
- e2e 테스트는 `apps/api/test/setup-env.ts`가 주입한 DB에 대해 실제 스키마로 검증한다(마이그레이션/reset은 e2e spec 내에서 실행).
