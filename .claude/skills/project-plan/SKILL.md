---
name: project-plan
description: 새 기능의 계획 단계를 시작한다. 기능 설명을 입력하면 비즈니스/엔지니어링 리뷰를 수행하고 docs/features/<slug>/ 경로에 spec.md, plan.md, progress.md를 생성한다. 사용 예: /project-plan 사용자 로그인
---

# project-plan

계획 단계를 시작한다.

---

## 0. 기능 설명 수집

`$ARGUMENTS` 를 기능 설명으로 사용한다.

- `$ARGUMENTS` 가 있으면 그대로 사용한다. 예: `/project-plan 사용자 로그인`
- `$ARGUMENTS` 가 없으면 사용자에게 묻는다. > 어떤 기능을 계획하고 있나요?

기능 설명을 kebab-case slug로 변환한다.

- 한국어 → 영어로 의미 번역 후 kebab-case 적용
- 예: "사용자 로그인" → `user-login`, "결제 수단 등록" → `payment-method-registration`

변환된 slug를 사용자에게 확인한다.

> `docs/features/user-login/` 경로에 문서를 생성할게요. 맞나요?

사용자가 수정을 원하면 반영한다. 확인 후 `FEATURE_SLUG` 로 사용한다.

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
> echo "planning" > docs/features/{FEATURE_SLUG}/phase.md
> ```
>
> 이미 `docs/features/{FEATURE_SLUG}/` 가 존재하면 사용자에게 알린다.
> > 이미 해당 경로에 문서가 있습니다. 기존 문서를 업데이트할까요, 새로 작성할까요?
>
> ### 계획 리뷰
>
> 요구사항이 불명확하다고 판단되면 작업을 시작하기 전에 알린다.
> > 요구사항이 구체적이지 않을 수 있습니다. `/office-hours` 를 먼저 실행해 구체화하는 것을 권장합니다. 그대로 진행할까요?
>
> `Skill` 툴을 사용해 gstack의 `autoplan` 스킬을 호출한다. 완료 후 산출물 작성으로 이동한다.
>
> ### 산출물 작성
>
> 리뷰 결과를 바탕으로 세 파일을 작성한다.
> 산출물 템플릿은 `${CLAUDE_SKILL_DIR}/templates/` 를 읽고 해당 구조를 그대로 사용한다.
>
> - `docs/features/{FEATURE_SLUG}/spec.md`
> - `docs/features/{FEATURE_SLUG}/plan.md`
> - `docs/features/{FEATURE_SLUG}/progress.md`
>
> ### 완료 보고
>
> ```bash
> echo "planned" > docs/features/{FEATURE_SLUG}/phase.md
> ```
>
> ```
> ✅ 계획 완료
>
> docs/features/{FEATURE_SLUG}/
>   ├── spec.md
>   ├── plan.md
>   ├── progress.md
>   ├── review.md
>   └── phase.md
>
> 문서를 검토한 후 구현을 시작하세요.
> 구현 준비가 되면 /project-implement 를 실행하세요.
> ```
>
> 여기서 종료한다. /project-implement 입력 전까지 코드를 작성하지 않는다.

---

서브에이전트가 완료되면 메인 세션으로 결과를 반환한다.
