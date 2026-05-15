---
name: project-verify
description: spec.md, plan.md 기반으로 코드 리뷰, 기능 검증, 보안 감사를 수행하고 docs/features/<slug>/review.md를 생성한다. 사용 예: /project-verify user-login
---

# project-verify

검증 단계를 시작한다.

---

## 0. 대상 기능 확인

`$ARGUMENTS` 를 feature slug로 사용한다.

- `$ARGUMENTS` 가 있으면 그대로 사용한다.
- `$ARGUMENTS` 가 없으면 사용자에게 묻는다. > 어떤 기능을 검증할까요?

`docs/features/$ARGUMENTS/` 경로와 구현 완료 여부를 확인한다.

```bash
ls docs/features/$ARGUMENTS/spec.md \
   docs/features/$ARGUMENTS/plan.md 2>/dev/null \
  && echo "DOCS_OK" || echo "DOCS_MISSING"

cat docs/features/$ARGUMENTS/phase.md 2>/dev/null
```

`DOCS_MISSING` 이면 중단한다.

> `docs/features/$ARGUMENTS/` 문서를 찾을 수 없습니다. `/project:plan` 을 먼저 실행하세요.

`phase.md` 가 `implemented` 가 아니면 사용자에게 알린다.

> 구현이 완료되지 않은 것 같습니다. 그대로 진행할까요?

---

## 1. 서브에이전트 디스패치

`{FEATURE_SLUG}` 를 확인된 실제 slug 값으로 치환하여 Task 툴로 아래 지시를 전달한다.

---

> FEATURE_SLUG 는 `{FEATURE_SLUG}` 다.
> 다음 단계를 순서대로 실행하라.
>
> ### 준비
>
> ```bash
> mkdir -p docs/features/{FEATURE_SLUG}
> echo "verifying" > docs/features/{FEATURE_SLUG}/phase.md
> ```
>
> 기존 `docs/features/{FEATURE_SLUG}/review.md` 가 있으면 OPEN 항목 수를 확인한다.
>
> ```bash
> grep -c "| OPEN |" docs/features/{FEATURE_SLUG}/review.md 2>/dev/null || echo "0"
> ```
>
> 출력이 `0` 이면 이미 완료된 리뷰다. 사용자에게 알리고 중단한다.
> > 이미 완료된 리뷰가 있습니다. 재실행할까요?
>
> `docs/features/{FEATURE_SLUG}/spec.md`, `plan.md` 를 읽는다.
>
> ### 코드 리뷰
>
> `Skill` 툴을 사용해 gstack의 `review` 스킬을 호출한다. 완료 후 결과를 수집한다.
>
> 이후 `spec.md`, `plan.md` 와 대조해 다음을 추가로 검토한다.
>
> - 각 요구사항의 구현 여부 (`DONE` / `PARTIAL` / `NOT DONE` / `CHANGED`)
> - plan.md 태스크 완료 여부
> - Spec에 없는 구현 (`SCOPE_CREEP`)
> - 테스트 커버리지 (`UNTESTED`)
>
> 파일:라인 근거 없이 `DONE` 판정하지 않는다.
>
> ### 기능 검증
>
> `Skill` 툴을 사용해 gstack의 `qa-only` 스킬을 호출한다. 완료 후 결과를 수집한다.
>
> ### 보안 감사
>
> `Skill` 툴을 사용해 gstack의 `cso` 스킬을 호출한다. 완료 후 결과를 수집한다.
>
> ### 산출물 저장
>
> 결과를 `docs/features/{FEATURE_SLUG}/review.md` 에 저장한다.
>
> ```markdown
> # Review: {FEATURE_SLUG}
>
> ## 리뷰 개요
>
> - 일자: {date 결과}
> - Spec: docs/features/{FEATURE_SLUG}/spec.md
> - Plan: docs/features/{FEATURE_SLUG}/plan.md
>
> ---
>
> ## 1. Spec 일치 여부
>
> | # | 요구사항 | 상태 | 근거 |
> |---|----------|------|------|
>
> **요약:** DONE {n} / PARTIAL {n} / NOT DONE {n} / CHANGED {n}
>
> ---
>
> ## 2. Plan 일치 여부
>
> | 태스크 | 상태 | 비고 |
> |--------|------|------|
>
> **스코프 이탈:** {없음 또는 목록}
>
> ---
>
> ## 3. 테스트 커버리지
>
> | 요구사항 | 테스트 | 비고 |
> |----------|--------|------|
>
> **미테스트:** {n}건
>
> ---
>
> ## 4. 발견 항목
>
> | 상태 | 심각도 | 신뢰도 | 위치 | 내용 |
> |------|--------|--------|------|------|
>
> ### Appendix (confidence 5 미만)
>
> | 심각도 | 신뢰도 | 위치 | 내용 |
> |--------|--------|------|------|
>
> ---
>
> ## 5. 기능 검증
>
> {/qa-only 결과}
>
> ---
>
> ## 6. 보안 감사
>
> {/cso 결과}
>
> ### 완료 보고
>
> ```bash
> echo "verified" > docs/features/{FEATURE_SLUG}/phase.md
> ```
>
> ```
> ✅ 검증 완료
>
> docs/features/{FEATURE_SLUG}/
>   └── review.md (생성됨)
>
> SPEC_ITEMS:  DONE {n} / PARTIAL {n} / NOT DONE {n}
> PLAN_TASKS:  완료 {n} / 미완료 {n}
> UNTESTED:    {n}건
> OPEN_ITEMS:  {n}건
>
> /project-patch {FEATURE_SLUG} 로 OPEN 항목을 해결한 후 /project-verify 를 재실행하세요.
> ```
>
> 여기서 종료한다.

---

서브에이전트가 완료되면 메인 세션으로 결과를 반환한다.
