---
name: project-plan
description: 새 기능의 계획 단계를 시작한다. 기능 설명을 입력하면 비즈니스/엔지니어링 리뷰를 수행하고 docs/features/<slug>/ 경로에 spec.md, plan.md, progress.md를 생성한다. 사용 예. $project-plan 사용자 로그인
---

# project-plan

계획 단계를 시작한다. 본 스킬의 모든 작업은 **메인 세션에서 직접 수행**한다(서브에이전트 디스패치 없음).

---

## 0. 기능 설명 수집

`$ARGUMENTS` 를 기능 설명으로 사용한다.

- `$ARGUMENTS` 가 있으면 그대로 사용한다. 예: `$project-plan 사용자 로그인`
- `$ARGUMENTS` 가 없으면 사용자에게 묻는다. > 어떤 기능을 계획하고 있나요?

기능 설명을 kebab-case slug로 변환한다.

- 한국어 → 영어로 의미 번역 후 kebab-case 적용
- 예: "사용자 로그인" → `user-login`, "결제 수단 등록" → `payment-method-registration`

변환된 slug를 사용자에게 확인한다.

> `docs/features/<slug>/` 경로에 문서를 생성할게요. 맞나요?

사용자가 수정을 원하면 반영한다. 확인 후 `FEATURE_SLUG` 로 사용한다.

---

## 1. 준비

```bash
mkdir -p docs/features/$FEATURE_SLUG
echo "planning" > docs/features/$FEATURE_SLUG/phase.md
```

이미 `docs/features/$FEATURE_SLUG/` 가 존재하면 사용자에게 알린다.

> 이미 해당 경로에 문서가 있습니다. 기존 문서를 업데이트할까요, 새로 작성할까요?

---

## 2. 아이디어 구체화 게이트 (선택)

`AskUserQuestion` 으로 사용자에게 묻는다.

> 이 기능이 어느 단계인가요?
> - 아이디어 단계 (구체화 필요) — 무엇을/왜 만드는지 아직 명확하지 않음
> - 요구사항 명확 (바로 계획 리뷰) — 무엇을 만들지 정해져 있음

"아이디어 단계" 를 선택한 경우에만 `Skill` 툴로 gstack의 `office-hours` 스킬을 호출한다. office-hours 의 모든 질문은 메인 세션의 `AskUserQuestion` 으로 사용자에게 그대로 노출된다. 우회·합성 금지. office-hours 가 산출한 디자인 문서/요약을 다음 단계의 입력으로 사용한다.

"요구사항 명확" 을 선택했으면 이 단계를 건너뛴다.

---

## 3. 계획 리뷰

`Skill` 툴을 사용해 gstack의 `autoplan` 스킬을 호출한다. autoplan 의 모든 게이트(premise / decision / final approval)는 메인 세션의 `AskUserQuestion` 으로 그대로 사용자에게 노출된다. 우회·합성 금지. 완료 후 산출물 작성으로 이동한다.

---

## 4. 산출물 작성

리뷰 결과를 바탕으로 두 파일을 작성한다.
산출물 템플릿은 `${CLAUDE_SKILL_DIR}/templates/` 를 읽고 해당 구조를 그대로 사용한다. 헤더/표 컬럼/순서를 임의로 바꾸지 않고, 각 섹션의 빈 셀과 플레이스홀더만 채운다.

- `docs/features/$FEATURE_SLUG/spec.md`
- `docs/features/$FEATURE_SLUG/plan.md`

각 파일을 작성한 직후 `ls -la docs/features/$FEATURE_SLUG/` 로 존재를 검증한다.

---

## 5. 완료 보고

```bash
echo "planned" > docs/features/$FEATURE_SLUG/phase.md
```

```
✅ 계획 완료

docs/features/$FEATURE_SLUG/
  ├── spec.md
  ├── plan.md
  └── phase.md

문서를 검토하셨나요? 검토가 끝났다면 다음 단계로 진행하세요.
구현 준비가 되면 `/clear` 로 세션을 초기화한 뒤 `$project-implement $FEATURE_SLUG` 를 실행하세요.
```

여기서 종료한다. $project-implement 입력 전까지 코드를 작성하지 않는다.
