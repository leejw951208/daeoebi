---
name: project-implement
description: 계획 문서를 기반으로 구현을 시작한다. docs/features/<slug>/ 의 spec.md, plan.md를 읽고 구현 태스크를 실행한다. 사용 예. /project-implement user-login
---

# project-implement

구현 단계를 시작한다. 본 스킬의 모든 작업은 **메인 세션에서 직접 수행**한다(서브에이전트 디스패치 없음).

---

## 0. 대상 기능 확인

`$ARGUMENTS` 를 feature slug로 사용한다.

- `$ARGUMENTS` 가 있으면 그대로 사용한다. 예: `/project-implement user-login`
- `$ARGUMENTS` 가 없으면 사용자에게 묻는다. > 어떤 기능을 구현할까요?

`$ARGUMENTS` 가 kebab-case slug 형태가 아닌 자연어/한국어/다른 표기로 보이면 의미를 파악해 후보 slug를 제안하고 사용자에게 확인을 받는다.

> `$ARGUMENTS` 는 plan 단계 slug 형식이 아닌 것 같습니다. `<후보-slug>` 가 맞나요?

`docs/features/$ARGUMENTS/` 경로가 존재하는지 확인한다.

```bash
ls docs/features/$ARGUMENTS/spec.md docs/features/$ARGUMENTS/plan.md 2>/dev/null \
  && echo "DOCS_OK" || echo "DOCS_MISSING"
```

`DOCS_MISSING` 이면 중단한다.

> `docs/features/$ARGUMENTS/` 의 `spec.md`, `plan.md` 를 찾을 수 없습니다. `/project-plan` 을 먼저 실행하세요.

확인된 slug를 `FEATURE_SLUG` 로 사용한다.

---

## 1. 준비

```bash
mkdir -p docs/features/$FEATURE_SLUG
echo "implementing" > docs/features/$FEATURE_SLUG/phase.md
```

`docs/features/$FEATURE_SLUG/spec.md` 와 `plan.md` 를 읽는다.

본 단계에서 `spec.md` 와 `plan.md` 는 **입력 전용**이다. 어떤 사유로도 수정·재작성하지 않는다. 요구사항 변경이 필요하면 작업을 중단하고 사용자에게 `/project-plan` 재실행을 안내한다.

`docs/features/$FEATURE_SLUG/progress.md` 가 없으면 `${CLAUDE_SKILL_DIR}/templates/progress.md` 템플릿을 기반으로 생성한다. `plan.md` 의 태스크 목록을 옮겨 적고 각 항목 초기 상태를 `대기` 로 둔다. 이미 존재하면 그대로 사용한다.

---

## 2. 코딩 제약

**단순함 우선**
- 한 번만 사용되는 코드에 추상화 계층을 만들지 않는다.
- 요청되지 않은 "유연성", "확장성", "설정 가능성"을 추가하지 않는다.
- 발생할 수 없는 시나리오에 대한 에러 처리를 작성하지 않는다.
- 작성한 코드가 200줄인데 50줄로 표현 가능하다면 다시 작성한다.

**변경 범위 최소화**
- 태스크와 직접 연관된 파일만 수정한다.
- 변경 대상이 아닌 인접 코드, 주석, 포맷팅을 "개선"하지 않는다.
- 깨지지 않은 코드를 리팩터링하지 않는다.
- 기존 스타일과 다르더라도 기존 스타일을 따른다.
- 변경과 무관한 데드 코드를 발견하면 보고만 한다. 직접 삭제하지 않는다.
- 자신의 변경으로 미사용 상태가 된 import, 변수, 함수는 제거한다.

---

## 3. 구현 파이프라인

**Step 1 — 구현 계획 수립**

`Skill` 툴을 사용해 `superpowers:writing-plans` 스킬을 호출한다.

- `spec.md` 의 요구사항과 `plan.md` 의 태스크 목록을 입력으로 사용한다.
- 기존 `plan.md` 에 태스크가 충분히 구체화되어 있으면 이 단계를 건너뛴다.

**Step 2 — 구현 실행**

`Skill` 툴을 사용해 `superpowers:subagent-driven-development` 스킬을 호출한다. 태스크 단위로 분해해 실행한다.

- 각 태스크 완료 시 `progress.md` 의 해당 태스크 상태를 업데이트한다.

**Step 3 — 테스트**

`Skill` 툴을 사용해 `superpowers:test-driven-development` 스킬을 호출한다.

- RED-GREEN-REFACTOR 사이클을 따른다.
- 테스트 없이 작성된 코드는 삭제하고 재작성한다.

---

## 4. progress.md 업데이트

모든 태스크 완료 후 `progress.md` 를 업데이트한다.

- 현재 단계: `구현`
- 각 태스크 상태: `✅ 완료`
- 최근 업데이트 날짜 갱신

---

## 5. 완료 보고

```bash
echo "implemented" > docs/features/$FEATURE_SLUG/phase.md
```

```
✅ 구현 완료

docs/features/$FEATURE_SLUG/
  └── progress.md (업데이트됨)

진행한 내용을 확인하셨나요? 검토가 끝났다면 다음 단계로 진행하세요.
검증 준비가 되면 `/clear` 로 세션을 초기화한 뒤 `/project-verify $FEATURE_SLUG` 를 실행하세요.
```

여기서 종료한다. /project-verify 입력 전까지 추가 코드를 작성하지 않는다.
