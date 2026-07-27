# 직렬화 규칙

## 응답 엔벨로프

**공통 성공 엔벨로프는 없다.** 응답을 감싸는 인터셉터가 존재하지 않으며(전역 인터셉터 미등록 — `apps/api/src/main.ts`에 `useGlobalInterceptors` 없음), 서비스가 반환한 객체/배열이 그대로 JSON 직렬화된다.

- 목록 조회는 배열을 그대로 반환한다. 예: `GET /expenses` → `ExpenseView[]`. — `apps/api/src/asset/expense.service.ts:52`
- 단건 조회는 뷰 객체를 그대로 반환한다. 예: `GET /secrets/:id`. — `apps/api/src/vault/secret.service.ts:50`
- 싱글톤 조회는 없으면 `null`을 반환한다. 예: `GET /investment` → `Row | null`. — `apps/api/src/asset/investment.service.ts:31`

> `.claude/rules/ecc/typescript/patterns.md`는 `{ success, data, error, meta }` 형식을 권장하지만, 실제 구현은 이 엔벨로프를 사용하지 않는다. SSOT 기준은 구현(엔벨로프 없음)이다.

## HTTP 상태코드

컨트롤러의 `@HttpCode`/데코레이터가 정한다.

| 동작 | 상태 | 근거(예) |
|------|------|----------|
| 리소스 생성(POST `/sites`·`/secrets`·`/income`·`/expenses`·`/recurring`·`/asset-categories`·`/savings-accounts`·`/savings-box`) | 201 | `apps/api/src/vault/site.controller.ts:30` |
| 옵션/검증/로그인·로그아웃/백업 import 등 POST(auth·store) | 200(`@HttpCode(200)`) | `apps/api/src/auth/auth.controller.ts:49`, `apps/api/src/vault/backup.controller.ts:27` |
| 수정(PATCH) | 200(기본) | `apps/api/src/vault/site.controller.ts:35` |
| 싱글톤 저장(PUT `/investment`) | 200(기본) | `apps/api/src/asset/investment.controller.ts` |
| 삭제(DELETE) | 204(`@HttpCode(204)`, 본문 없음) | `apps/api/src/vault/site.controller.ts:41` |
| GET | 200 | 각 컨트롤러 |

## DTO ↔ 응답 변환

- **요청 검증**: 전역 `ValidationPipe`가 `whitelist: true`(미정의 필드 제거), `forbidNonWhitelisted: true`(미정의 필드 있으면 400), `transform: true`(타입 변환)로 동작한다. — `apps/api/src/main.ts:71`
- **DTO**: `class-validator` 데코레이터로 필드별 제약을 강제한다. 바이트 필드는 `IsBase64url`(패딩 없는 base64url)을 쓴다. — `apps/api/src/common/base64url.ts:27`, 예 `apps/api/src/asset/dto/expense.dto.ts`
- **응답 매핑**: 서비스는 Prisma 행의 `Bytes`(iv/ciphertext/authTag)를 `toBase64url`로 인코드해 뷰 객체(`toView`)로 변환한다. 목록에서는 본문 없이 메타만 반환하는 select가 따로 있다(예: Secret `LIST_SELECT`는 암호문 제외, `DETAIL_SELECT`만 포함). — `apps/api/src/vault/secret.service.ts:12`·`:20`, `apps/api/src/asset/expense.service.ts:34`

## 필드 표현 규칙

| 유형 | 규칙 | 근거 |
|------|------|------|
| 바이트(iv·ciphertext·authTag·salt·wrap 등) | 패딩 없는 base64url 문자열. `^[A-Za-z0-9_-]+$`, 빈 문자열 불허 | `apps/api/src/common/base64url.ts:9`·`:12` |
| 월(month·period·startMonth) | `"YYYY-MM"` 평문. 정규식 `MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/` | `apps/api/src/asset/asset.types.ts:2` |
| 지출 날짜(Expense.date) | 저장은 `@db.Date`, 응답은 `"YYYY-MM-DD"`로 slice 직렬화(`toDateStr`) | `apps/api/src/asset/expense.service.ts:19` |
| 저축 박스 날짜(SavingsBoxTxn.date) | `"YYYY-MM-DD"` 문자열, 정규식 `/^\d{4}-\d{2}-\d{2}$/` | `apps/api/src/asset/dto/savings-box.dto.ts:5` |
| createdAt·updatedAt | Prisma `DateTime`가 JSON에서 ISO 8601 문자열로 직렬화. 백업 export는 명시적으로 `.toISOString()` | `apps/api/src/vault/backup.service.ts:36` |
| 금액 | 서버는 금액을 평문으로 다루지 않는다. 전부 암호문 블롭 안에 들어 있다(서버 직렬화 규칙 없음) | 각 서비스 패스스루 주석 |
| 색(color) | `#rrggbb`, 정규식 `/^#[0-9a-fA-F]{6}$/` | `apps/api/src/asset/dto/asset-category.dto.ts:13` |
| returnRate | 평문 소수 문자열, `^$|^-?(\d+(\.\d+)?|\.\d+)$` | `apps/api/src/asset/dto/investment.dto.ts:6` |
| type/source(저축 박스) | 문자열 리터럴 유니온(`in`\|`out`, `cash`\|`savings`). enum 타입은 아니다 | `apps/api/src/asset/dto/savings-box.dto.ts:8` |
| nullable 필드 | `null`로 직렬화(예: `recurringId`·`period`·`categoryId`·`icon`) | `apps/api/src/asset/expense.service.ts:34` |

- `enum`은 코드에 정의돼 있지 않다(에러 코드·상태 문자열은 `as const` 객체 상수로 관리). — `apps/api/src/asset/asset.types.ts:5`, `apps/api/src/auth/auth.types.ts:4`

## 에러 응답 형식

전역 `HttpExceptionFilter`가 모든 예외를 정규화한다. — `apps/api/src/common/http-exception.filter.ts:16`

```json
{
  "code": "EXPENSE_DUPLICATE",
  "message": "해당 월의 고정 지출이 이미 존재합니다.",
  "statusCode": 409,
  "path": "/expenses",
  "timestamp": "2026-07-24T..."
}
```

- `HttpException`의 응답 객체(`{ code, message, ... }`)를 펼친 뒤 `statusCode`·`path`·`timestamp`를 항상 덧붙인다. — `apps/api/src/common/http-exception.filter.ts:49`
- `message`가 없으면 `"요청을 처리할 수 없습니다."`로 채운다. — `:38`
- 비-`HttpException`(예상치 못한 오류)은 500 + `{ message: "서버 내부 오류가 발생했습니다." }`, 서버 로그에 기록한다. — `:29`·`:42`
- `code` 필드는 도메인 서비스가 던지는 예외 payload에 담긴 문자열이다(예: `AUTH_ERRORS.*`, `VAULT_ERRORS.*`, `ASSET_ERRORS.*`). 전체 코드 목록은 각 도메인 문서 §8, 정의는 `apps/api/src/auth/auth.types.ts:4`·`apps/api/src/vault/vault.types.ts:2`·`apps/api/src/asset/asset.types.ts:5`.
- 레이트리밋(429) 응답에는 `retryAfterSeconds`가 추가로 실린다. — `apps/api/src/auth/auth.service.ts:271`
- `ValidationPipe` 위반은 400 + class-validator 메시지 배열(`message`). 배열은 필터가 그대로 `message`에 담는다. — `apps/api/src/common/http-exception.filter.ts:34`
