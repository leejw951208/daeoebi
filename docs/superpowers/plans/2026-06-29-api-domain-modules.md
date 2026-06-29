# API 도메인 모듈 리팩토링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/api`의 god-module `store`를 NestJS 피처 모듈 권장에 따라 비밀번호 도메인(VaultModule)과 자산 도메인(AssetModule)으로 분리하고, 공용 유틸을 `common/`으로 옮긴다. 동작·API 계약은 불변.

**Architecture:** 순수 구조 리팩토링이다. 새 테스트를 쓰지 않는다 — **기존 단위/통합 테스트가 이동 후에도 전부 그대로 통과하는 것**이 동작 보존의 증거다. 각 태스크는 파일 이동(`git mv`) → import 경로 갱신 → `typecheck` → `test:unit` → 커밋 순서이며, 각 커밋 시점에 항상 green을 유지한다.

**Tech Stack:** NestJS 10, TypeScript, Prisma, Jest. pnpm 모노레포(`@daeoebi/api`).

## Global Constraints

- 엔드포인트 prefix 불변: `sites`·`categories`·`secrets`·`search`·`store`·`income`·`expenses`·`recurring`. 응답 형태·DTO 검증·인증(전역 세션 가드)·CSRF 동작·에러 코드 문자열 전부 불변.
- `apps/web`·prisma 스키마·마이그레이션은 손대지 않는다.
- `rm` 사용 금지 — 파일 삭제는 `git rm` 또는 `git mv`로만. 빈 디렉터리는 `git`이 추적하지 않으므로 별도 삭제 불필요.
- 패키지 설치 금지(`*install`).
- 커밋·develop 머지는 사용자 요청 시에만. main 머지 금지. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- macOS `sed`는 `-i ''` 형식.
- 작업 브랜치: `develop`에서 `refactor/api-domain-modules`.
- 검증 명령(태스크별 반복):
  - 타입: `pnpm --filter @daeoebi/api typecheck`
  - 단위: `pnpm --filter @daeoebi/api test:unit`
  - (최종) e2e 포함 전체: `make dev-up` 후 `pnpm --filter @daeoebi/api test`

---

### Task 0: 작업 브랜치 생성

- [ ] **Step 1: develop 최신화 후 브랜치 생성**

```bash
git switch develop && git pull && git switch -c refactor/api-domain-modules
```

- [ ] **Step 2: 기준선 확인(이동 전 전부 green)**

Run: `pnpm --filter @daeoebi/api typecheck && pnpm --filter @daeoebi/api test:unit`
Expected: PASS. 통과하는 테스트 수를 기록해 둔다(이후 태스크에서 같은 수가 유지돼야 함).

---

### Task 1: `base64url`을 `common/`으로 이동

`auth/base64url`은 auth와 store 양쪽이 쓰는 인코딩 공용 유틸이다. `common/`으로 옮기고 모든 import 경로를 갱신한다.

**Files:**
- Move: `apps/api/src/auth/base64url.ts` → `apps/api/src/common/base64url.ts`
- Move: `apps/api/src/auth/base64url.spec.ts` → `apps/api/src/common/base64url.spec.ts`
- Modify (import 경로): `auth/auth.service.ts`, `auth/dto/auth.dto.ts`, `store/backup.service.ts`, `store/backup.service.spec.ts`, `store/dto/backup.dto.ts`, `store/dto/expense.dto.ts`, `store/dto/income.dto.ts`, `store/dto/recurring.dto.ts`, `store/dto/secret.dto.ts`, `store/expense.service.ts`, `store/income.service.ts`, `store/income.service.spec.ts`, `store/recurring.service.ts`, `store/secret.service.ts`, `store/secret.service.spec.ts`

**Interfaces:**
- Produces: `apps/api/src/common/base64url` — 기존과 동일한 export(`fromBase64url`, `toBase64url`, `isBase64url`, `IsBase64url`). 이후 모든 base64url import는 이 경로를 쓴다(상대경로는 사용처 깊이에 따라 `../common/base64url` 또는 `../../common/base64url`).

- [ ] **Step 1: 파일 이동**

```bash
cd apps/api
mkdir -p src/common
git mv src/auth/base64url.ts src/common/base64url.ts
git mv src/auth/base64url.spec.ts src/common/base64url.spec.ts
```
(이동한 `base64url.spec.ts`의 `import ... from "./base64url"`는 같이 옮겨졌으므로 그대로 둔다.)

- [ ] **Step 2: import 경로 일괄 갱신**

```bash
cd apps/api
# auth (src/auth/ 한 단계, dto는 두 단계)
sed -i '' 's#from "./base64url"#from "../common/base64url"#' src/auth/auth.service.ts
sed -i '' 's#from "../base64url"#from "../../common/base64url"#' src/auth/dto/auth.dto.ts
# store 서비스/스펙 (src/store/ 한 단계: ../auth → ../common)
sed -i '' 's#from "../auth/base64url"#from "../common/base64url"#' \
  src/store/backup.service.ts src/store/backup.service.spec.ts \
  src/store/expense.service.ts src/store/income.service.ts src/store/income.service.spec.ts \
  src/store/recurring.service.ts src/store/secret.service.ts src/store/secret.service.spec.ts
# store dto (src/store/dto/ 두 단계: ../../auth → ../../common)
sed -i '' 's#from "../../auth/base64url"#from "../../common/base64url"#' \
  src/store/dto/backup.dto.ts src/store/dto/expense.dto.ts src/store/dto/income.dto.ts \
  src/store/dto/recurring.dto.ts src/store/dto/secret.dto.ts
```

- [ ] **Step 3: 잔존 참조 없는지 확인**

Run: `cd apps/api && grep -rn "auth/base64url" src --include='*.ts'`
Expected: 결과 없음(0건).

- [ ] **Step 4: typecheck + 단위 테스트**

Run: `pnpm --filter @daeoebi/api typecheck && pnpm --filter @daeoebi/api test:unit`
Expected: PASS, 테스트 수는 Task 0과 동일.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(api): base64url 유틸을 common 으로 이동

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: CSRF 미들웨어를 `common/`으로 이동

`store-csrf.middleware`는 분리 후 두 도메인 모듈이 공유한다. `common/csrf.middleware.ts`로 옮기고 클래스를 `CsrfMiddleware`로 개명한다. 유일 사용처이므로 `CSRF_INVALID` 코드를 파일 안에 인라인하고 `store.types`에서 제거한다(코드 문자열 `"CSRF_INVALID"`는 불변).

**Files:**
- Create: `apps/api/src/common/csrf.middleware.ts`
- Modify: `apps/api/src/store/store.module.ts` (import 경로·클래스명), `apps/api/src/store/store.types.ts` (CSRF_INVALID 제거)
- Delete: `apps/api/src/store/store-csrf.middleware.ts`

**Interfaces:**
- Produces: `apps/api/src/common/csrf.middleware` exports `class CsrfMiddleware implements NestMiddleware`. 동작은 기존 `StoreCsrfMiddleware`와 동일.

- [ ] **Step 1: 새 미들웨어 파일 작성**

`apps/api/src/common/csrf.middleware.ts`:
```ts
// 쓰기 요청 CSRF 정책. Origin 화이트리스트 + 커스텀 헤더 X-Vault-Request: 1 을 요구한다.
// 세션 쿠키는 SameSite=Strict 라 cross-site 전송이 차단되므로 쿠키 보유는 별도로 강제하지 않는다.
// 보관함·자산 두 도메인이 공유한다.
import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

// CSRF 거부 응답 코드. 이 미들웨어가 유일 사용처라 도메인 에러 모듈과 분리해 여기 둔다.
const CSRF_INVALID = "CSRF_INVALID"

const DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
const ALLOWED_ORIGINS = new Set(
    (process.env.VAULT_ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS)
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
)
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction): void {
        if (SAFE_METHODS.has(req.method.toUpperCase())) {
            next()
            return
        }

        // Origin 이 있으면 반드시 화이트리스트여야 한다(cross-site 차단).
        // Origin 이 없으면 same-origin 요청이다 — 브라우저는 cross-origin 요청에는 항상 Origin 을 붙이지만,
        // Safari(WebKit)는 same-origin POST 에서 Origin 을 생략한다. 이 경우는 아래 커스텀 헤더로 검증한다.
        const origin = req.headers.origin as string | undefined
        if (origin !== undefined && !ALLOWED_ORIGINS.has(origin)) {
            throw new ForbiddenException({
                code: CSRF_INVALID,
                message: "Origin 이 허용되지 않습니다.",
            })
        }

        // 커스텀 헤더 X-Vault-Request 는 CSRF 1차 방어다. cross-origin 요청이 이 헤더를 붙이면 preflight 가
        // 발생하고, 우리 CORS 는 허용 오리진만 통과시키므로 위조 요청은 브라우저 단계에서 차단된다.
        if (req.headers["x-vault-request"] !== "1") {
            throw new ForbiddenException({
                code: CSRF_INVALID,
                message: "X-Vault-Request 헤더가 필요합니다.",
            })
        }

        next()
    }
}
```

- [ ] **Step 2: 옛 미들웨어 삭제 + store.module 갱신**

```bash
cd apps/api && git rm src/store/store-csrf.middleware.ts
```
`src/store/store.module.ts`에서 import 줄 교체:
```ts
import { StoreCsrfMiddleware } from "./store-csrf.middleware"
```
→
```ts
import { CsrfMiddleware } from "../common/csrf.middleware"
```
그리고 `configure` 본문의 `.apply(StoreCsrfMiddleware)` → `.apply(CsrfMiddleware)`.

- [ ] **Step 3: store.types에서 CSRF_INVALID 제거**

`src/store/store.types.ts`의 `STORE_ERRORS` 객체에서 `CSRF_INVALID: "CSRF_INVALID",` 줄을 삭제한다.

- [ ] **Step 4: 잔존 참조 확인**

Run: `cd apps/api && grep -rn "StoreCsrfMiddleware\|store-csrf" src --include='*.ts'`
Expected: 결과 없음(0건).

- [ ] **Step 5: typecheck + 단위 테스트 + 커밋**

Run: `pnpm --filter @daeoebi/api typecheck && pnpm --filter @daeoebi/api test:unit`
Expected: PASS, 테스트 수 동일.
```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(api): CSRF 미들웨어를 common 으로 이동·개명

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 자산 도메인을 `src/asset/` + `AssetModule`로 추출

income·expense·recurring을 `src/asset/`으로 옮기고, 자산 에러 코드를 `asset.types.ts`로 분리하며, `AssetModule`을 만든다. `store.module`에서 자산 컨트롤러·서비스 등록을 제거하고 `app.module`에 `AssetModule`을 추가한다. 이 시점 `StoreModule`은 보관함 전용으로 남는다(이름은 Task 4에서 변경).

**Files:**
- Move: `income`·`expense`·`recurring`의 `*.controller.ts`/`*.service.ts`/`*.service.spec.ts` → `src/asset/`; `dto/{income,expense,recurring}.dto.ts` → `src/asset/dto/`
- Create: `apps/api/src/asset/asset.types.ts`, `apps/api/src/asset/asset.module.ts`
- Modify: `src/asset/expense.service.ts`, `src/asset/expense.service.spec.ts`, `src/asset/recurring.service.ts`, `src/asset/recurring.service.spec.ts` (types import·상수명), `src/store/store.module.ts`, `src/store/store.types.ts`, `src/app.module.ts`

**Interfaces:**
- Consumes: `../common/base64url`, `../prisma/prisma.service` (이동 후에도 동일 상대경로), `../common/csrf.middleware`의 `CsrfMiddleware`.
- Produces: `apps/api/src/asset/asset.types`의 `ASSET_ERRORS`; `apps/api/src/asset/asset.module`의 `class AssetModule`.

- [ ] **Step 1: 파일 이동**

```bash
cd apps/api
mkdir -p src/asset/dto
git mv src/store/income.controller.ts src/asset/income.controller.ts
git mv src/store/income.service.ts src/asset/income.service.ts
git mv src/store/income.service.spec.ts src/asset/income.service.spec.ts
git mv src/store/expense.controller.ts src/asset/expense.controller.ts
git mv src/store/expense.service.ts src/asset/expense.service.ts
git mv src/store/expense.service.spec.ts src/asset/expense.service.spec.ts
git mv src/store/recurring.controller.ts src/asset/recurring.controller.ts
git mv src/store/recurring.service.ts src/asset/recurring.service.ts
git mv src/store/recurring.service.spec.ts src/asset/recurring.service.spec.ts
git mv src/store/dto/income.dto.ts src/asset/dto/income.dto.ts
git mv src/store/dto/expense.dto.ts src/asset/dto/expense.dto.ts
git mv src/store/dto/recurring.dto.ts src/asset/dto/recurring.dto.ts
```

- [ ] **Step 2: `asset.types.ts` 작성**

`apps/api/src/asset/asset.types.ts`:
```ts
// 자산(가계부) 도메인 에러 코드.
export const ASSET_ERRORS = {
    EXPENSE_NOT_FOUND: "EXPENSE_NOT_FOUND",
    EXPENSE_DUPLICATE: "EXPENSE_DUPLICATE",
    RECURRING_NOT_FOUND: "RECURRING_NOT_FOUND",
    CIPHERTEXT_INCOMPLETE_ASSET: "CIPHERTEXT_INCOMPLETE_ASSET",
    INVALID_MONTH: "INVALID_MONTH",
} as const
```

- [ ] **Step 3: 이동한 자산 파일의 types import·상수명 교체**

```bash
cd apps/api
sed -i '' -e 's#from "./store.types"#from "./asset.types"#' -e 's#STORE_ERRORS#ASSET_ERRORS#g' \
  src/asset/expense.service.ts src/asset/expense.service.spec.ts \
  src/asset/recurring.service.ts src/asset/recurring.service.spec.ts
```
(income은 에러 코드를 쓰지 않으므로 변경 없음. dto의 base64url import는 `../../common/base64url`로 이미 Task 1에서 갱신됐고 이동 후에도 동일 깊이라 유효하다.)

- [ ] **Step 4: `asset.module.ts` 작성**

`apps/api/src/asset/asset.module.ts`:
```ts
// 자산(가계부) 도메인 모듈. 수입·지출·고정지출 컨트롤러와 서비스를 조립한다.
// 본문은 클라이언트 E2E 암호문이라 서버 크립토 의존이 없다. 보호는 AuthModule 의 전역 세션 가드가 담당한다.
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { CsrfMiddleware } from "../common/csrf.middleware"
import { IncomeController } from "./income.controller"
import { ExpenseController } from "./expense.controller"
import { RecurringController } from "./recurring.controller"
import { IncomeService } from "./income.service"
import { ExpenseService } from "./expense.service"
import { RecurringService } from "./recurring.service"

@Module({
    imports: [PrismaModule],
    controllers: [IncomeController, ExpenseController, RecurringController],
    providers: [IncomeService, ExpenseService, RecurringService],
})
export class AssetModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(CsrfMiddleware)
            .forRoutes(IncomeController, ExpenseController, RecurringController)
    }
}
```

- [ ] **Step 5: `store.module.ts`에서 자산 제거**

`src/store/store.module.ts`에서 다음을 모두 삭제: Income/Expense/Recurring `Controller`·`Service` import 줄, `controllers` 배열의 3개 컨트롤러, `providers` 배열의 3개 서비스, `forRoutes`의 3개 컨트롤러. 결과적으로 site·category·secret·search·backup만 남는다.

- [ ] **Step 6: `app.module.ts`에 AssetModule 추가**

`src/app.module.ts`에 `import { AssetModule } from "./asset/asset.module"` 추가하고 `imports` 배열에 `AssetModule`을 `StoreModule` 뒤에 추가한다.

- [ ] **Step 7: 잔존 참조 확인 + typecheck + 단위 테스트**

Run: `cd apps/api && grep -rn "STORE_ERRORS" src/asset --include='*.ts'`
Expected: 결과 없음.
Run: `pnpm --filter @daeoebi/api typecheck && pnpm --filter @daeoebi/api test:unit`
Expected: PASS, 테스트 수 동일.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(api): 자산 도메인을 AssetModule 로 분리

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 보관함 도메인을 `src/vault/` + `VaultModule`로 개명·이동

남은 보관함 리소스를 `src/vault/`로 옮기고, `store.module` → `vault.module`(`VaultModule`), `store.types` → `vault.types`(`VAULT_ERRORS`)로 개명한다. `app.module`을 `VaultModule`로 교체하고 빈 `src/store/`를 정리한다.

**Files:**
- Move: site·category·secret·search·backup의 `*.controller.ts`/`*.service.ts`/`*.service.spec.ts` → `src/vault/`; `dto/{site,category,secret,backup}.dto.ts` → `src/vault/dto/`; `store.module.ts` → `src/vault/vault.module.ts`; `store.types.ts` → `src/vault/vault.types.ts`
- Modify: 이동한 vault 서비스/컨트롤러의 types import·상수명; `src/vault/vault.module.ts` 내용; `src/app.module.ts`

**Interfaces:**
- Consumes: `../common/base64url`, `../prisma/prisma.service`, `../common/csrf.middleware`의 `CsrfMiddleware`.
- Produces: `apps/api/src/vault/vault.types`의 `VAULT_ERRORS`; `apps/api/src/vault/vault.module`의 `class VaultModule`.

- [ ] **Step 1: 파일 이동**

```bash
cd apps/api
mkdir -p src/vault/dto
git mv src/store/site.controller.ts src/vault/site.controller.ts
git mv src/store/site.service.ts src/vault/site.service.ts
git mv src/store/site.service.spec.ts src/vault/site.service.spec.ts
git mv src/store/category.controller.ts src/vault/category.controller.ts
git mv src/store/category.service.ts src/vault/category.service.ts
git mv src/store/category.service.spec.ts src/vault/category.service.spec.ts
git mv src/store/secret.controller.ts src/vault/secret.controller.ts
git mv src/store/secret.service.ts src/vault/secret.service.ts
git mv src/store/secret.service.spec.ts src/vault/secret.service.spec.ts
git mv src/store/search.controller.ts src/vault/search.controller.ts
git mv src/store/search.service.ts src/vault/search.service.ts
git mv src/store/search.service.spec.ts src/vault/search.service.spec.ts
git mv src/store/backup.controller.ts src/vault/backup.controller.ts
git mv src/store/backup.service.ts src/vault/backup.service.ts
git mv src/store/backup.service.spec.ts src/vault/backup.service.spec.ts
git mv src/store/dto/site.dto.ts src/vault/dto/site.dto.ts
git mv src/store/dto/category.dto.ts src/vault/dto/category.dto.ts
git mv src/store/dto/secret.dto.ts src/vault/dto/secret.dto.ts
git mv src/store/dto/backup.dto.ts src/vault/dto/backup.dto.ts
git mv src/store/store.types.ts src/vault/vault.types.ts
git mv src/store/store.module.ts src/vault/vault.module.ts
```

- [ ] **Step 2: `vault.types.ts` 내용을 VAULT_ERRORS로 개명**

`src/vault/vault.types.ts` 전체를 아래로 교체:
```ts
// 보관함 도메인 에러 코드. 서버는 클라이언트 E2E 암호문을 패스스루하므로 복호화/잠금 관련 코드는 두지 않는다.
export const VAULT_ERRORS = {
    SITE_NOT_FOUND: "SITE_NOT_FOUND",
    CATEGORY_NOT_FOUND: "CATEGORY_NOT_FOUND",
    CATEGORY_SITE_MISMATCH: "CATEGORY_SITE_MISMATCH",
    SECRET_NOT_FOUND: "SECRET_NOT_FOUND",
    CIPHERTEXT_INCOMPLETE: "CIPHERTEXT_INCOMPLETE",
    IMPORT_CONFLICT: "IMPORT_CONFLICT",
    IMPORT_INVALID: "IMPORT_INVALID",
} as const
```

- [ ] **Step 3: 이동한 vault 파일의 types import·상수명 교체**

```bash
cd apps/api
sed -i '' -e 's#from "./store.types"#from "./vault.types"#' -e 's#STORE_ERRORS#VAULT_ERRORS#g' \
  src/vault/backup.controller.ts src/vault/backup.service.ts src/vault/backup.service.spec.ts \
  src/vault/category.service.ts src/vault/category.service.spec.ts \
  src/vault/secret.service.ts src/vault/secret.service.spec.ts \
  src/vault/site.service.ts src/vault/site.service.spec.ts
```

- [ ] **Step 4: `vault.module.ts`로 개명·정리**

`src/vault/vault.module.ts` 전체를 아래로 교체:
```ts
// 보관함 도메인 모듈. 사이트·카테고리·비밀번호·검색·백업 컨트롤러와 서비스를 조립한다.
// 본문은 클라이언트 E2E 암호문이라 서버 크립토 의존이 없다. 보호는 AuthModule 의 전역 세션 가드가 담당한다.
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { CsrfMiddleware } from "../common/csrf.middleware"
import { SiteController } from "./site.controller"
import { CategoryController } from "./category.controller"
import { SecretController } from "./secret.controller"
import { SearchController } from "./search.controller"
import { BackupController } from "./backup.controller"
import { SiteService } from "./site.service"
import { CategoryService } from "./category.service"
import { SecretService } from "./secret.service"
import { SearchService } from "./search.service"
import { BackupService } from "./backup.service"

@Module({
    imports: [PrismaModule],
    controllers: [
        SiteController,
        CategoryController,
        SecretController,
        SearchController,
        BackupController,
    ],
    providers: [
        SiteService,
        CategoryService,
        SecretService,
        SearchService,
        BackupService,
    ],
})
export class VaultModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(CsrfMiddleware)
            .forRoutes(
                SiteController,
                CategoryController,
                SecretController,
                BackupController,
            )
    }
}
```

- [ ] **Step 5: `app.module.ts`를 VaultModule로 교체**

`src/app.module.ts`에서 `import { StoreModule } from "./store/store.module"` → `import { VaultModule } from "./vault/vault.module"`, `imports` 배열의 `StoreModule` → `VaultModule`.

- [ ] **Step 6: store 디렉터리 비었는지 확인**

Run: `cd apps/api && ls -A src/store 2>/dev/null; grep -rn "store\.types\|store\.module\|StoreModule\|STORE_ERRORS" src --include='*.ts'`
Expected: `src/store`는 비어 있음(git이 빈 디렉터리를 추적하지 않으므로 커밋 시 자동 사라짐). grep 결과 0건.

- [ ] **Step 7: typecheck + 단위 테스트**

Run: `pnpm --filter @daeoebi/api typecheck && pnpm --filter @daeoebi/api test:unit`
Expected: PASS, 테스트 수는 Task 0과 동일.

- [ ] **Step 8: lint + e2e 포함 전체 테스트(동작 보존 최종 증거)**

Run: `pnpm --filter @daeoebi/api lint`
Expected: PASS(경고 0).
Run: `make dev-up`(dev DB 기동) 후 `pnpm --filter @daeoebi/api test`
Expected: 단위 + e2e 전부 PASS. e2e는 라우트 문자열만 참조하므로 이동 영향 없음.

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(api): 보관함 도메인을 VaultModule 로 분리하고 store 모듈 제거

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- 도메인 2개 모듈 분리 → Task 3(asset), Task 4(vault). ✓
- base64url → common → Task 1. ✓
- CSRF 미들웨어 → common, CSRF_INVALID 인라인 → Task 2. ✓
- STORE_ERRORS → vault.types/asset.types 분리 → Task 2(CSRF 제거), 3(asset), 4(vault). ✓
- 엔드포인트/응답 불변 → 컨트롤러 `@Controller` prefix·서비스 로직 코드 그대로 이동, 검증은 typecheck+test green. ✓
- app.module 교체, store/ 제거 → Task 3·4. ✓
- 4개 의미 단위 커밋 → Task 1~4. ✓

**Placeholder scan:** 모든 새 파일 전체 내용·sed 명령·검증 명령이 구체적으로 명시됨. TODO/TBD 없음. ✓

**Type consistency:** 클래스명 `CsrfMiddleware`(Task 2 생성 → Task 3·4에서 import), `AssetModule`/`VaultModule`(생성 후 app.module에서 import), 상수 `ASSET_ERRORS`/`VAULT_ERRORS`(생성과 사용 일치). 상대경로는 src 2단계 디렉터리(asset/vault/store 동일 깊이) 기준 `../common`·`../prisma`, dto는 `../../common`로 일관. ✓
