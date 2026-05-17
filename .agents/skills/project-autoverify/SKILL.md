---
name: project-autoverify
description: project-verify와 project-patch를 오케스트레이션해 검증 → 보강 → 재검증 루프를 자동 진행한다. 기본 5라운드. slug 없이 호출하면 docs/features/의 모든 기능을 처리할지 사용자에게 묻는다. 옵션. --include-appendix, --max-rounds=N, --skip-blocked, --retry=N. 사용 예. $project-autoverify user-login, $project-autoverify user-login --include-appendix --max-rounds=3, $project-autoverify --skip-blocked
---

# project-autoverify

검증과 보강을 자동 반복한다. 본 스킬의 모든 작업은 **메인 세션에서 직접 수행**한다(서브에이전트 디스패치 없음).

이 스킬은 `project-verify`와 `project-patch`를 하위 절차로 사용한다. 각 하위 스킬의 검토, 보강, 산출물 형식은 그대로 따른다. 단, `project-verify` 완료 후 `OPEN` 항목이 있으면 같은 세션에서 `project-patch`로 이어가는 것이 이 스킬의 목적이므로, `project-verify`의 최종 안내 뒤에 멈추지 않고 루프 제어로 돌아온다.

---

## 0. 대상 기능 확인

`$ARGUMENTS` 를 feature slug와 옵션으로 파싱한다.

- 첫 번째 공백 없는 값 중 `--` 로 시작하지 않는 것을 feature slug로 사용한다. 예. `$project-autoverify user-login`
- 옵션은 어느 순서로 와도 된다.
  - `--include-appendix` — Appendix의 confidence 5 미만 `OPEN` 항목도 보강 대상에 포함한다.
  - `--max-rounds=N` — 기능당 최대 라운드 수를 N으로 설정한다(기본 5, 범위 1–10). 범위를 벗어나면 사용자에게 알리고 기본값으로 되돌린다.
  - `--skip-blocked` — 전체 모드에서 한 기능이 막혀도 다음 기능으로 계속 진행한다(기본은 즉시 중단). 막힌 기능은 보고서 끝의 잔여 목록에 누적한다.
  - `--retry=N` — 일시적 실패로 보이는 검증·테스트 명령 실패에 대해 최대 N회 재시도한다(기본 0, 범위 0–3). flaky 인프라(파일시스템 락, 포트 점유 등)에만 적용하고 실제 결함은 재시도하지 않는다.
- `$ARGUMENTS` 가 없거나 옵션만 있으면 `docs/features/` 아래 기능 전체를 검증·보강할지 사용자에게 먼저 묻는다.
- slug가 kebab-case가 아닌 자연어/한국어/다른 표기로 보이면 의미를 파악해 후보 slug를 제안하고 사용자에게 확인을 받는다.

파싱한 옵션은 다음 변수로 기억한다.

- `INCLUDE_APPENDIX` (0 또는 1)
- `MAX_ROUNDS` (정수, 기본 5)
- `SKIP_BLOCKED` (0 또는 1, slug 단일 모드에서는 무시)
- `RETRY` (정수, 기본 0)

slug가 없을 때는 다음 순서로 처리한다.

1. 기능 목록을 수집한다.

```bash
find docs/features -mindepth 1 -maxdepth 1 -type d -print | sort
```

2. 사용자에게 묻는다.

> feature slug가 없습니다. `docs/features/` 아래 모든 기능을 각각 최대 `MAX_ROUNDS` 라운드까지 자동 검증·보강할까요?

3. 사용자가 동의하면 `ALL_FEATURES=1` 로 기록하고, 각 디렉터리 basename을 순서대로 `FEATURE_SLUG` 로 사용한다.
4. 사용자가 동의하지 않으면 중단하고 특정 slug를 요청한다.

> 처리할 feature slug를 지정해 주세요. 예. `$project-autoverify ui-ux-improve`.

확인한 slug를 `FEATURE_SLUG` 로 사용한다. 전체 모드에서는 `FEATURE_SLUGS` 목록을 사용한다. 최대 라운드는 각 기능당 `MAX_ROUNDS` 회다.

대상 문서를 확인한다. 전체 모드에서는 각 slug마다 이 확인을 반복하고, `spec.md` 또는 `plan.md` 가 없는 디렉터리는 건너뛰지 말고 중단해 사용자에게 알린다.

```bash
ls docs/features/$FEATURE_SLUG/spec.md \
   docs/features/$FEATURE_SLUG/plan.md 2>/dev/null \
  && echo "DOCS_OK" || echo "DOCS_MISSING"
cat docs/features/$FEATURE_SLUG/phase.md 2>/dev/null
```

`DOCS_MISSING` 이면 중단한다.

> `docs/features/$FEATURE_SLUG/` 문서를 찾을 수 없습니다. `$project-plan` 을 먼저 실행하세요.

`phase.md` 가 `planned` 인 경우에는 중단한다.

> 아직 구현 단계가 끝나지 않은 것 같습니다. `$project-implement $FEATURE_SLUG` 를 먼저 실행하세요.

`implemented`, `verifying`, `verified`, `patching` 은 자동 루프 시작을 허용한다. 사용자가 이 스킬을 명시적으로 호출했다면 재검증에 동의한 것으로 간주한다.

전체 모드에서 한 기능이 사용자 결정, `ESCALATE`, 검증 실패, 문서 누락으로 막히면 기본은 즉시 중단이다. `SKIP_BLOCKED=1` 이어도 사용자 결정이 필요한 경우에는 자동으로 건너뛰지 않는다. 먼저 중단해 결정을 받고, 사용자가 명시적으로 "skip"을 선택한 경우에만 해당 기능을 `BLOCKED_FEATURES` 에 기록하고 다음 기능으로 진행한다. 사용자 결정이 필요 없는 검증 실패, 문서 누락, 진전 없음은 `SKIP_BLOCKED=1` 일 때 자동으로 기록 후 다음 기능으로 넘어갈 수 있다.

---

## 1. 라운드 규칙

라운드는 기능별로 최대 `MAX_ROUNDS` 회 반복한다. 한 라운드는 다음 순서다.

1. `Skill` 툴로 `project-verify` 를 호출해 `$FEATURE_SLUG` 를 검증한다.
2. `docs/features/$FEATURE_SLUG/review.md` 의 `OPEN` 항목 수집.
3. `OPEN` 0건이면 성공 종료.
4. `OPEN` 1건 이상이면 `Skill` 툴로 `project-patch` 를 호출해 `$FEATURE_SLUG` 를 보강한다. `INCLUDE_APPENDIX=1` 이면 `--include-appendix` 를 인자에 포함한다.
5. patch가 완료되어 `phase.md` 가 `implemented` 가 되면 다음 라운드로 이동.

`INCLUDE_APPENDIX=1` 이면 모든 기능의 patch 호출에 동일하게 전달한다.

라운드 중 다음 조건은 차단 상태로 처리한다.

- `project-verify` 또는 `project-patch` 가 사용자 결정을 요구한다.
- `project-patch` 가 `ESCALATE` 항목을 발견한다.
- patch 후에도 `phase.md` 가 `implemented` 가 아니다.
- 같은 `OPEN` 항목이 이전 라운드와 동일하게 남아 있어 자동 보강이 진전되지 않았다고 판단된다(라운드 종료 시 저장한 OPEN 행 스냅샷을 직전 라운드와 문자열 비교).
- 검증/테스트 명령이 실패했는데 원인과 수정 범위가 명확하지 않다(아래 재시도 정책 참고).

단일 feature 모드에서는 차단 상태를 즉시 사용자에게 보고하고 중단한다. 전체 모드에서는 `SKIP_BLOCKED=1` 이고 사용자 결정이 필요 없는 차단 상태일 때만 `BLOCKED_FEATURES` 에 기록하고 다음 기능으로 넘어간다. 사용자 결정이나 `ESCALATE` 는 `SKIP_BLOCKED=1` 이어도 먼저 멈춰서 사용자에게 `fix`, `skip`, `stop` 중 하나를 선택하게 한다.

### 재시도 정책 (`RETRY`)

`RETRY > 0` 일 때만 적용한다. 다음 신호가 모두 해당될 때만 재시도하고, 한 번이라도 같은 메시지로 다시 실패하면 진짜 결함으로 보고 중단한다.

- 명령 자체가 환경 의존(파일 락, 포트 점유, 일시적 네트워크, `EBUSY`, `EADDRINUSE`, `ECONNRESET`, `EAGAIN`).
- 실패 메시지가 코드 변경 없이 같은 명령을 다시 돌리면 풀릴 가능성이 명백.
- 직전 라운드에서 같은 시도로 통과한 이력이 있다.

`RETRY` 한도까지 재시도해도 실패하면 결함으로 분류한다. 빌드 에러, 타입 에러, 테스트 단정 실패, 컴파일 실패는 재시도하지 않고 즉시 중단한다.

전체 모드에서는 `FEATURE_SLUGS` 를 순서대로 처리한다.

```text
BLOCKED_FEATURES = []
for FEATURE_SLUG in FEATURE_SLUGS:
  run up to MAX_ROUNDS rounds for FEATURE_SLUG (with RETRY policy)
  if success with OPEN 0:
    record success(FEATURE_SLUG, rounds_used)
    continue
  else:
    if SKIP_BLOCKED:
      append FEATURE_SLUG to BLOCKED_FEATURES with reason
      continue
    else:
      stop all-feature run and report the blocking feature
report all successes + BLOCKED_FEATURES at the end
```

---

## 2. OPEN 수집 방법

기본 실행에서는 Appendix 아래의 `OPEN` 항목을 제외한다. `--include-appendix` 가 있으면 포함한다.

기본 OPEN 수를 빠르게 볼 때는 다음 명령을 사용한다.

```bash
awk '
  /^### Appendix/ { in_appendix=1 }
  /\| OPEN \|/ && !in_appendix { count++ }
  END { print count + 0 }
' docs/features/$FEATURE_SLUG/review.md
```

Appendix 포함 실행에서는 단순 grep을 사용할 수 있다.

```bash
grep -c "| OPEN |" docs/features/$FEATURE_SLUG/review.md 2>/dev/null || echo "0"
```

라운드 간 진전 여부를 보기 위해 각 라운드 종료 시 OPEN 행을 임시로 기억한다.

```bash
grep "| OPEN |" docs/features/$FEATURE_SLUG/review.md 2>/dev/null || true
```

직전 라운드의 OPEN 행 집합과 이번 라운드 결과를 비교해 동일하면 진전 없음으로 판단하고 중단한다.

---

## 3. 하위 스킬 실행

### Step 1. 검증 실행

`Skill` 툴로 `project-verify` 를 호출해 `$FEATURE_SLUG` 를 검증한다.

- 기존 리뷰가 있고 `OPEN` 0건이어도, 이 스킬의 명시적 호출은 재실행 동의로 간주한다.
- `project-verify` 는 `review.md` 를 템플릿 구조로 생성 또는 갱신해야 한다.
- 검증 중 새 코드 수정은 하지 않는다.

### Step 2. 보강 실행

OPEN 항목이 있으면 `Skill` 툴로 `project-patch` 를 호출한다.

- 기본 호출. `project-patch $FEATURE_SLUG`
- Appendix 포함 호출. `project-patch $FEATURE_SLUG --include-appendix`

`project-patch` 의 제약을 그대로 따른다.

- OPEN 항목에 명시된 부분만 수정한다.
- `ESCALATE` 항목이 있으면 자동 처리하지 않고 사용자에게 묻는다.
- 완료 후 `echo "implemented" > docs/features/$FEATURE_SLUG/phase.md` 상태여야 다음 검증 라운드로 진행한다.

---

## 4. 라운드별 진행 보고

각 라운드 종료 시점에 다음 형식으로 한 줄 보고를 출력한다.

```text
[ROUND {n}/{MAX_ROUNDS}] FEATURE=$FEATURE_SLUG  VERIFY=ok  OPEN={n}  PATCH={ok|skipped|blocked}  RETRIED={n}
```

전체 모드에서는 기능 전환 시점에 다음 형식의 구분선을 출력한다.

```text
─── FEATURE {i}/{N}: $FEATURE_SLUG ───
```

---

## 5. 완료 처리

최대 `MAX_ROUNDS` 라운드 안에 `OPEN` 0건이 되면 다음 형식으로 보고한다.

```text
✅ 자동 검증·보강 완료

FEATURE: $FEATURE_SLUG
ROUNDS: {n}/{MAX_ROUNDS}
OPEN_ITEMS: 0건

최종 산출물.
docs/features/$FEATURE_SLUG/review.md
```

`OPEN` 이 남은 채 `MAX_ROUNDS` 라운드를 모두 사용하면 중단하고 다음 형식으로 보고한다.

```text
⛔ 자동 검증·보강 한도 도달

FEATURE: $FEATURE_SLUG
ROUNDS: {MAX_ROUNDS}/{MAX_ROUNDS}
잔여 OPEN: {n}건

자동 루프가 더 진행되면 같은 변경을 반복할 가능성이 큽니다.
잔여 OPEN을 확인한 뒤 수동으로 결정하세요.
한도 자체가 부족하다고 판단되면 `--max-rounds=N` 으로 늘려 재실행하세요.
```

사용자 결정이 필요한 항목에서 중단한 경우에는 남은 질문을 구체적으로 적고, 추가 코드를 작성하지 않는다.

전체 모드가 모든 기능을 성공적으로 처리하면 다음 형식으로 보고한다.

```text
✅ 전체 자동 검증·보강 완료

FEATURES: {n}개
MAX_ROUNDS_PER_FEATURE: {MAX_ROUNDS}
OPEN_ITEMS: 0건

처리한 기능.
- {slug}: {rounds}/{MAX_ROUNDS}
- {slug}: {rounds}/{MAX_ROUNDS}
```

`SKIP_BLOCKED=1` 로 일부 기능이 막힌 채 끝났으면 다음 형식으로 보고한다.

```text
⚠️ 전체 자동 검증·보강 부분 완료 (--skip-blocked)

성공: {n}개
- {slug}: {rounds}/{MAX_ROUNDS}

차단: {n}개
- {slug}: 사유 ({라운드/한도})
- {slug}: 사유 ({라운드/한도})

차단된 기능은 사유를 확인하고 수동으로 해소하거나 옵션을 조정해 재실행하세요.
```
