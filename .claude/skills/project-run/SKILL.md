---
name: project-run
description: 기능 개발 파이프라인(plan → implement → verify → patch → verify)을 한 번의 호출로 순차 실행한다. 기능 설명 또는 기존 slug를 입력으로 받는다. 사용 예: /project-run 사용자 로그인
---

# project-run

기능 개발 파이프라인을 순차 실행하는 오케스트레이터다.

`project-plan` → `project-implement` → `project-verify` → (`project-patch` → `project-verify`)\* 를
한 번의 호출로 이어서 실행한다.

---

## 핵심 계약

- 각 하위 스킬은 `"여기서 종료한다"` 로 끝나지만, **project-run 모드에서는 이 지시를 무시하고 다음 단계로 진행한다.**
- 단, PLAN 직후의 spec 검토 게이트는 유지한다. 사용자 승인을 1회 받는다.
- 어느 단계든 서브에이전트가 **실패를 보고하면 즉시 중단**하고 현재까지의 결과를 보고한다.
- 하위 스킬은 `Skill` 툴로 호출한다. dispatch 로직을 복제하지 않는다.

---

## 0. 입력 판별

`$ARGUMENTS` 를 입력으로 사용한다.

- `$ARGUMENTS` 가 없으면 사용자에게 묻는다. > 어떤 기능을 실행할까요? 기능 설명 또는 기존 slug를 입력하세요.

`docs/features/$ARGUMENTS/` 디렉터리 존재 여부로 분기한다.

```bash
ls docs/features/$ARGUMENTS/spec.md 2>/dev/null && echo "RESUME" || echo "NEW"
```

- **`NEW`** → `$ARGUMENTS` 를 기능 설명으로 보고 **1. PLAN** 부터 시작한다.
- **`RESUME`** → `$ARGUMENTS` 를 slug로 보고 `phase.md` 를 읽어 아래 매핑대로 시작 지점을 정한다.

```bash
cat docs/features/$ARGUMENTS/phase.md 2>/dev/null
```

| phase.md | 시작 지점 |
|----------|-----------|
| `planned` | 2. IMPLEMENT |
| `implemented` | 3. VERIFY |
| `verified` | 4. PATCH 루프 (review.md OPEN 확인) |
| `planning` / `implementing` / `verifying` (중단됨) | 해당 단계 재실행 |

---

## 1. PLAN (대화형)

`Skill` 툴로 `project-plan` 스킬을 호출한다. (`$ARGUMENTS` 를 기능 설명으로 전달)

- slug 확인 등 project-plan 내부의 대화형 프롬프트는 그대로 작동시킨다.
- project-plan 이 `"여기서 종료한다"` 로 끝나면, **종료하지 말고** 생성된 `docs/features/<slug>/` 경로에서 `FEATURE_SLUG` 를 확인한다.

완료 후 **1회 정지**하여 사용자 승인을 받는다.

> `docs/features/<slug>/spec.md` 와 `plan.md` 를 검토하세요. 구현을 진행할까요?

사용자가 승인하면 **2. IMPLEMENT** 로 진행한다. 거부하거나 수정을 요청하면 멈춘다.

---

## 2. IMPLEMENT (자동)

`Skill` 툴로 `project-implement` 스킬을 호출한다. (`FEATURE_SLUG` 를 인자로 전달)

- project-implement 가 `"여기서 종료한다"` 로 끝나면, **종료하지 말고** **3. VERIFY** 로 진행한다.
- 서브에이전트가 구현 실패를 보고하면 즉시 중단하고 보고한다.

---

## 3. VERIFY (자동)

`Skill` 툴로 `project-verify` 스킬을 호출한다. (`FEATURE_SLUG` 를 인자로 전달)

- project-verify 가 `review.md` 를 생성하고 종료하면, **종료하지 말고** **4. PATCH 루프** 로 진행한다.
- 서브에이전트가 검증 실패를 보고하면 즉시 중단하고 보고한다.

---

## 4. PATCH 루프 (자동, 최대 2회)

`review.md` 의 OPEN 항목 수를 확인한다.

```bash
grep -c "| OPEN |" docs/features/<slug>/review.md 2>/dev/null || echo "0"
```

- 출력이 `0` 이면 루프를 종료하고 **5. 최종 보고** 로 간다.
- 출력이 `1` 이상이면 아래를 수행하고 반복 카운터를 +1 한다.
  1. `Skill` 툴로 `project-patch` 스킬 호출. (`FEATURE_SLUG` 인자 전달)
  2. `Skill` 툴로 `project-verify` 스킬 호출. (`FEATURE_SLUG` 인자 전달)
  3. `review.md` OPEN 항목 수를 다시 확인한다.
- 반복 카운터가 **2** 에 도달하면, OPEN 항목이 남아 있어도 루프를 멈추고 **5. 최종 보고** 로 간다.

---

## 5. 최종 보고

전체 파이프라인 결과를 요약한다.

```
✅ project-run 완료: <slug>

PLAN       : 완료
IMPLEMENT  : 완료
VERIFY     : 완료
PATCH 루프 : {n}회 실행

잔여 OPEN  : {n}건
review.md  : docs/features/<slug>/review.md

{잔여 OPEN이 있으면}
OPEN 항목이 남아 있습니다. /project-patch <slug> 로 수동 보강 후 /project-verify <slug> 를 재실행하세요.
```

여기서 종료한다.
