# Plan: 정기 지출 관리

## 단계 구성

| Phase | 이름 | 포함 태스크 |
|-------|------|------------|
| P1 | 모노레포 부트스트랩 | T001, T002, T003 |
| P2 | Prisma 스키마와 도메인 로직 | T004, T005, T006 |
| P3 | NestJS API 모듈 | T007, T008, T009, T010 |
| P4 | Next.js 클라이언트 | T011, T012, T013, T014, T015 |
| P5 | 합계·CSV·통합 테스트·문서화 | T016, T017, T018 |

## 구현 태스크

| ID | Phase | 태스크 | 상태 | 선행 태스크 | 예상 시간 | 실제 시간 |
|----|-------|--------|------|------------|----------|----------|
| T001 | P1 | pnpm workspace로 모노레포 루트 초기화. `pnpm-workspace.yaml`(`apps/*`, `packages/*`), 루트 `package.json` 스크립트(`dev`, `build`, `lint`, `typecheck`), Node 버전 고정(`.nvmrc` 또는 `engines`), `.gitignore`(`node_modules/`, `apps/api/data/`, `*.db`, `.env*`, `apps/web/.next/`). | TODO | - | 0.5h | |
| T002 | P1 | `apps/web` 생성. Next.js(App Router, TypeScript) 초기화, ESLint/Prettier, `dev`/`start` 스크립트에 `--hostname 127.0.0.1`, 한글 폰트/Tailwind 설정, 공통 레이아웃 골격. `NEXT_PUBLIC_API_BASE_URL` 환경변수 자리(기본 `http://127.0.0.1:4000`)와 `lib/api-client.ts` axios 인스턴스 골격. | TODO | T001 | 1h | |
| T003 | P1 | `apps/api` 생성. NestJS(TypeScript) 초기화, `main.ts`에서 `app.listen(4000, '127.0.0.1')` 명시, CORS는 `http://127.0.0.1:3000`만 허용, 글로벌 `ValidationPipe`(class-validator), 글로벌 예외 필터, 환경변수(`DATABASE_URL`)는 `@nestjs/config`로 로드. | TODO | T001 | 1h | |
| T004 | P2 | `apps/api`에 Prisma 설치, `prisma/schema.prisma`에 SQLite 데이터소스(`file:./data/life-key.db`) 설정, `RecurringExpense`, `ExpenseOccurrence` 모델과 enum(`Recurrence`, `OccurrenceStatus`) 정의, 첫 마이그레이션 생성·적용, `PrismaModule`/`PrismaService` 작성. | TODO | T003 | 1h | |
| T005 | P2 | `apps/api/src/expenses/recurrence.ts`. 시작일·반복 규칙·종료일을 받아 다음 N개월의 결제일 배열을 반환하는 순수 함수. 매월 31일 → 해당 월 말일(2월 28/29) 자동 조정 포함. Jest 단위 테스트(`recurrence.spec.ts`). | TODO | T004 | 1h | |
| T006 | P2 | `apps/api/src/expenses/expense.service.ts`. 마스터 생성/수정/삭제 시 occurrence 동기화(미래 미발생만 재생성, 과거 보존) 로직. Prisma 트랜잭션 사용. Jest 단위 테스트. | TODO | T005 | 1.5h | |
| T007 | P3 | `ExpensesModule`. `ExpensesController`에 `GET /expenses`(목록), `POST /expenses`(생성). DTO + class-validator로 입력 검증, 한국어 에러 메시지. | TODO | T006 | 1h | |
| T008 | P3 | `ExpensesController`에 `GET /expenses/:id`, `PATCH /expenses/:id`, `DELETE /expenses/:id`(soft delete). 미래 미발생 occurrence 재생성 흐름은 T006의 서비스를 통해 호출. | TODO | T007 | 1h | |
| T009 | P3 | `OccurrencesModule` / `OccurrencesController`. `GET /occurrences`(기간·상태·카테고리 필터), `PATCH /occurrences/:id`(완료/스킵/되돌리기). 응답 DTO 정의. | TODO | T006 | 1h | |
| T010 | P3 | NestJS `AuthGuard`(이번 단계엔 항상 통과) 자리만 마련. `APP_GUARD`로 글로벌 적용해 후속 단계에 비밀번호 인증을 한 곳에서 교체할 수 있게 한다. | TODO | T007 | 0.5h | |
| T011 | P4 | `apps/web/lib/api-client.ts` 완성. axios 인스턴스에 `NEXT_PUBLIC_API_BASE_URL` 적용, 한국어 에러 메시지 변환 인터셉터, 도메인별 클라이언트 함수(`getExpenses`, `createExpense`, `updateOccurrence` 등) 작성. | TODO | T009 | 1h | |
| T012 | P4 | 대시보드 페이지(`app/page.tsx`). api-client를 통해 이번 달 합계, 다음 7일 예정, 미완료 수 카드를 렌더. SWR 또는 React Query 사용 여부 결정 후 적용(없으면 RSC + `cache: 'no-store'` 호출). | TODO | T011 | 1.5h | |
| T013 | P4 | 정기 지출 목록 페이지(`app/expenses/page.tsx`)와 신규/수정 폼. 폼 검증, 통화 입력 마스킹, 저장 시 api-client 호출. | TODO | T011 | 2h | |
| T014 | P4 | 캘린더 페이지(`app/calendar/page.tsx`). 월 단위 그리드, 인스턴스 칩, 클릭 시 상세 패널(완료/스킵/되돌리기). | TODO | T011 | 2h | |
| T015 | P4 | 인스턴스 상세/처리 컴포넌트. 완료(실제 금액 입력)·스킵(사유)·되돌리기. 예상/실제 차이 강조. PATCH 호출 후 캐시 무효화. | TODO | T011 | 1h | |
| T016 | P5 | 합계 페이지(`app/summary/page.tsx`) + NestJS `GET /summary`. 기간 필터, 카테고리/결제 수단/상태별 집계 응답. | TODO | T009 | 1.5h | |
| T017 | P5 | CSV 내보내기. `GET /export/csv` NestJS 엔드포인트에서 UTF-8 BOM 포함 스트림 응답. 합계 페이지에서 다운로드 버튼 연결. | TODO | T016 | 0.5h | |
| T018 | P5 | 통합 테스트(api Jest e2e: 마스터 생성→occurrence 자동 생성→완료 처리 시나리오) + README. 모노레포 설치/실행(`pnpm install`, `pnpm --filter api prisma migrate dev`, `pnpm dev`), `apps/api/data/` 백업 가이드, 알려진 한계, 후속(비밀번호 관리) 자리 문서화. | TODO | T017 | 1h | |

## 패키지 매니저 선택 근거

pnpm workspace를 선택한다.

- **엄격한 의존성 격리**. hoist되지 않은 `node_modules` 구조 덕분에 `apps/web`이 `apps/api`의 의존성을 우연히 import하는 사고를 막을 수 있다. 두 앱의 경계를 강제로 유지한다.
- **속도와 디스크 효율**. content-addressable 저장으로 NestJS·Next.js처럼 의존성이 큰 앱을 한 머신에 두 개 두어도 설치/CI 속도가 빠르다.
- **워크스페이스 친화**. `pnpm --filter web dev`, `pnpm --filter api prisma migrate dev` 형태로 앱별 명령을 깔끔하게 분리할 수 있다.
- **공식 지원**. Next.js, NestJS 공식 문서가 모두 pnpm 워크스페이스를 예시로 다룬다.

Nx/Turborepo는 빌드 캐시·태스크 그래프가 필요할 만큼 앱 수가 늘었을 때 도입을 재검토한다.

## 프론트엔드 → 백엔드 호출 방식

- 환경변수 `NEXT_PUBLIC_API_BASE_URL`을 두고 기본값은 `http://127.0.0.1:4000`.
- `apps/web/lib/api-client.ts`에서 `axios.create({ baseURL: process.env.NEXT_PUBLIC_API_BASE_URL })` 인스턴스를 단일 생성해 재사용.
- 요청 인터셉터에서 추후 인증 토큰을 한 곳에 부착할 수 있도록 자리를 비워 둔다.
- 응답 인터셉터에서 NestJS의 `ValidationPipe` 표준 에러 형식을 한국어 메시지로 변환.
- 서버 컴포넌트(RSC)에서 직접 fetch가 필요한 경우 `lib/api-server.ts`(같은 baseURL 사용)에 별도 helper를 두어 클라이언트/서버 양쪽이 같은 엔드포인트를 호출하게 한다.

## 디렉토리 트리

```
life-key/
├─ package.json                    (루트, 워크스페이스 스크립트만)
├─ pnpm-workspace.yaml             (apps/*, packages/*)
├─ .gitignore                      (node_modules, .next, apps/api/data, *.db, .env*)
├─ .nvmrc
├─ docs/features/recurring-expenses/
│   ├─ spec.md
│   ├─ plan.md
│   ├─ progress.md
│   └─ phase.md
└─ apps/
    ├─ web/                        (Next.js 클라이언트)
    │   ├─ package.json
    │   ├─ next.config.ts
    │   ├─ tsconfig.json
    │   ├─ .env.local              (NEXT_PUBLIC_API_BASE_URL)
    │   ├─ app/
    │   │   ├─ layout.tsx
    │   │   ├─ page.tsx            (대시보드)
    │   │   ├─ expenses/page.tsx   (마스터 목록·폼)
    │   │   ├─ calendar/page.tsx   (월 캘린더)
    │   │   └─ summary/page.tsx    (집계·CSV)
    │   └─ lib/
    │       ├─ api-client.ts       (axios 인스턴스, 도메인 helper)
    │       └─ api-server.ts       (RSC용 fetch helper)
    └─ api/                        (NestJS 백엔드)
        ├─ package.json
        ├─ nest-cli.json
        ├─ tsconfig.json
        ├─ data/                   (gitignore, SQLite 파일)
        │   └─ life-key.db
        ├─ prisma/
        │   ├─ schema.prisma
        │   └─ migrations/
        └─ src/
            ├─ main.ts             (listen 127.0.0.1:4000, CORS, ValidationPipe)
            ├─ app.module.ts
            ├─ prisma/
            │   ├─ prisma.module.ts
            │   └─ prisma.service.ts
            ├─ auth/
            │   └─ auth.guard.ts   (이번 단계엔 항상 통과)
            ├─ expenses/
            │   ├─ expenses.module.ts
            │   ├─ expenses.controller.ts
            │   ├─ expense.service.ts
            │   ├─ recurrence.ts
            │   ├─ dto/
            │   └─ recurrence.spec.ts
            ├─ occurrences/
            │   ├─ occurrences.module.ts
            │   ├─ occurrences.controller.ts
            │   └─ dto/
            ├─ summary/
            │   ├─ summary.module.ts
            │   └─ summary.controller.ts
            └─ export/
                └─ export.controller.ts  (CSV)
```

## 아키텍처 다이어그램

```
[Browser]
   │
   ▼
┌──────────────────────────────────────────────┐
│  apps/web (Next.js, 127.0.0.1:3000)          │
│                                              │
│  app/                                        │
│   ├─ page.tsx              (Dashboard)       │
│   ├─ expenses/             (마스터 목록·폼)  │
│   ├─ calendar/             (월 캘린더)       │
│   └─ summary/              (집계·CSV)        │
│                                              │
│  lib/api-client.ts                           │
│   axios.create({ baseURL: NEXT_PUBLIC_API })│
└──────────────────────────────────────────────┘
   │ HTTP (JSON, CORS: 127.0.0.1:3000만 허용)
   ▼
┌──────────────────────────────────────────────┐
│  apps/api (NestJS, 127.0.0.1:4000)           │
│                                              │
│  main.ts                                     │
│   ├─ ValidationPipe (class-validator)        │
│   ├─ AuthGuard      (이번 단계: 항상 통과)   │
│   └─ Exception Filter                        │
│                                              │
│  ExpensesModule                              │
│   ├─ ExpensesController  GET/POST/PATCH/DEL  │
│   ├─ ExpenseService                          │
│   │    ├─ createMaster / updateMaster / del  │
│   │    └─ syncFutureOccurrences()            │
│   └─ recurrence.ts       (pure, N개월 산출)  │
│                                              │
│  OccurrencesModule                           │
│   └─ OccurrencesController GET/PATCH         │
│                                              │
│  SummaryModule / ExportModule (CSV BOM)      │
│                                              │
│  PrismaService ── better-sqlite3             │
└──────────────────────────────────────────────┘
                       │
                       ▼
              apps/api/data/life-key.db
                  (gitignore)

데이터 흐름 (마스터 생성)
  Form ─ axios.post('/expenses') ─► NestJS ExpensesController
       ─► ExpenseService.createMaster()
            ├─ prisma.recurringExpense.create()
            └─ recurrence.computeDates(start, rule, 12mo)
                  └─ prisma.expenseOccurrence.createMany()

데이터 흐름 (완료 처리)
  InstanceCard ─ axios.patch('/occurrences/:id') ─► OccurrencesController
       ─► prisma.expenseOccurrence.update({status:PAID, actualAmount})
```

## 테스트 매트릭스

| 케이스 | 입력 | 기대 결과 |
|--------|------|----------|
| 매월 1일 반복, 시작 2026-05-15, 12개월 생성 | recurrence=MONTHLY, dayOfMonth=1, start=2026-05-15 | 첫 인스턴스는 2026-06-01, 이후 매월 1일로 12건. 시작일이 결제일 이후이므로 5월은 생성되지 않는다. |
| 매월 31일 반복, 2월 처리 | recurrence=MONTHLY, dayOfMonth=31, start=2026-01-31 | 2월은 2026-02-28(평년)/2028-02-29(윤년)로 자동 조정. 3월은 다시 31일. |
| 마스터 금액 수정 후 미래만 재생성 | 기존 마스터의 amount를 50,000 → 60,000로 PATCH | 오늘 이후 SCHEDULED 인스턴스의 expectedAmount만 60,000으로 갱신. PAID/과거 인스턴스는 불변. |
| 마스터 삭제(soft) | DELETE /expenses/:id | isActive=false, 미래 SCHEDULED 인스턴스 제거, 과거 인스턴스(PAID/SKIPPED) 보존. |
| 인스턴스 완료(실제 금액 입력) | PATCH /occurrences/:id {status:PAID, actualAmount:128000, paidAt:now} | 상태와 실제 금액 저장. 대시보드 "이번 달 합계"가 실제 금액 기준으로 갱신. |
| 인스턴스 되돌리기 | PATCH /occurrences/:id {status:SCHEDULED} | actualAmount, paidAt 초기화(null). |
| 종료일 < 시작일 검증 | POST /expenses {start:2026-06-01, end:2026-05-01} | NestJS ValidationPipe가 400 응답. 한국어 메시지. |
| CSV 내보내기 한글 호환 | GET /export/csv?from=2026-01-01&to=2026-12-31 | UTF-8 BOM 포함, 엑셀에서 한글 깨짐 없이 열림. |
| 외부 인터페이스 차단(web) | `curl http://<LAN-IP>:3000` | 연결 거부(127.0.0.1만 바인딩). |
| 외부 인터페이스 차단(api) | `curl http://<LAN-IP>:4000` | 연결 거부(127.0.0.1만 바인딩). |
| CORS | 다른 Origin에서 `/expenses` 호출 | 거부. `http://127.0.0.1:3000`만 허용. |
| 빈 상태(첫 사용) | DB가 빈 상태에서 / 접속 | 빈 상태 안내와 "정기 지출 추가" CTA가 표시된다. |
| 큰 데이터 성능 | 마스터 100개, occurrence 12,000개 시 캘린더 월 뷰 | 100ms 이내 응답(인덱스. ExpenseOccurrence(dueDate), (expenseId)). |
| e2e 시나리오(api Jest) | POST /expenses → GET /occurrences → PATCH /occurrences/:id | 마스터 생성 시 12개월치 occurrence가 자동 생성되고, 완료 처리 후 상태와 실제 금액이 반영된다. |
