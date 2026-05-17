---
name: project-patch
description: review.md의 모든 OPEN 항목을 분류해 보강하고 project-verify 재실행을 준비한다. 미구현, 미완료, 결함, 미테스트 항목을 처리한다. 사용 예. /project-patch user-login
---

# project-patch

보강 단계를 시작한다. 본 스킬의 모든 작업은 **메인 세션에서 직접 수행**한다(서브에이전트 디스패치 없음).

---

## 0. 대상 기능 확인

`$ARGUMENTS` 를 feature slug와 옵션으로 파싱한다.

- 첫 번째 공백 없는 값을 feature slug로 사용한다. 예: `/project-patch user-login`
- `$ARGUMENTS` 뒤에 `--include-appendix` 가 있으면 Appendix의 confidence 5 미만 `OPEN` 항목도 포함한다.
- `$ARGUMENTS` 가 없으면 사용자에게 묻는다. > 어떤 기능을 보강할까요?

`$ARGUMENTS` 가 kebab-case slug 형태가 아닌 자연어/한국어/다른 표기로 보이면 의미를 파악해 후보 slug를 제안하고 사용자에게 확인을 받는다.

> `$ARGUMENTS` 는 plan 단계 slug 형식이 아닌 것 같습니다. `<후보-slug>` 가 맞나요?

파싱하고 확인한 slug를 `FEATURE_SLUG` 로 사용한다.
`docs/features/$FEATURE_SLUG/review.md` 의 OPEN 항목 수를 확인한다.

```bash
grep -c "| OPEN |" docs/features/$FEATURE_SLUG/review.md 2>/dev/null || echo "0"
```

출력이 `0` 이면 중단한다.

> OPEN 항목이 없습니다. `/project-verify` 결과를 먼저 확인하세요.

`--include-appendix` 가 있으면 `INCLUDE_APPENDIX=1` 로 기록한다.

---

## 1. 준비

```bash
echo "patching" > docs/features/$FEATURE_SLUG/phase.md
```

`docs/features/$FEATURE_SLUG/review.md` 를 읽고 `| OPEN |` 상태인 항목만 추출한다.
`docs/features/$FEATURE_SLUG/spec.md`, `plan.md` 를 읽는다.

기본 실행에서는 `### Appendix (confidence 5 미만)` 아래의 `OPEN` 항목을 제외한다. `--include-appendix` 가 있으면 Appendix 항목도 포함한다. Appendix의 `OPEN` 은 잠재 보강 후보이며, 옵션 없이 실행한 patch의 기본 수집 대상이 아니다.

OPEN 항목을 심각도 순으로 정렬한다. (`HIGH` → `MEDIUM` → `LOW`)

OPEN 항목을 다음 작업 유형으로 분류한다.

| 작업 유형 | 대상 |
|-----------|------|
| `IMPLEMENT` | 섹션 1의 `PARTIAL` / `NOT DONE`, 섹션 2의 미완료 태스크 |
| `TEST` | 섹션 3의 `UNTESTED` / 테스트 보강 항목 |
| `FIX` | 섹션 4의 `BUG`, `SECURITY`, `QA`, `REGRESSION`, `DX`, `OTHER` |
| `ESCALATE` | `CHANGED`, `SCOPE_CREEP`, 요구사항 변경 필요, 사용자 결정이 필요한 항목 |

`ESCALATE` 항목이 있으면 작업을 중단하고 사용자에게 결정이 필요한 항목을 묻는다.

---

## 2. 코딩 제약

**변경 범위 최소화.**
- OPEN 항목에 명시된 부분만 수정한다.
- 변경 대상이 아닌 인접 코드, 주석, 포맷팅을 "개선"하지 않는다.
- 깨지지 않은 코드를 리팩터링하지 않는다.
- 기존 스타일과 다르더라도 기존 스타일을 따른다.
- 자신의 수정으로 미사용 상태가 된 import, 변수, 함수는 제거한다.

이 제약은 `FIX` 와 `TEST` 항목에 엄격히 적용한다.
`IMPLEMENT` 항목은 해당 OPEN 항목을 완성하는 데 필요한 `plan.md` 의 원래 설계 범위까지 수정할 수 있다.

**단순함 우선.**
- 수정에 필요한 최소한의 변경만 한다.
- 한 번만 사용되는 코드에 추상화 계층을 만들지 않는다.
- 발생할 수 없는 시나리오에 대한 에러 처리를 추가하지 않는다.

---

## 3. 수정

**Step 1 — 미구현 기능과 미완료 태스크 처리**

`IMPLEMENT` 항목이 있으면 `Skill` 툴을 사용해 `project-implement` 스킬을 호출한다.

- 인자는 `$FEATURE_SLUG --only-open` 으로 전달한다.
- `project-implement` 는 `review.md` 를 다시 읽고 동일한 `IMPLEMENT` 항목을 수집한다.
- `project-implement` 는 수집한 범위만 부분 구현한다.

**Step 2 — 테스트 보강**

`TEST` 항목이 있으면 `Skill` 툴을 사용해 `superpowers:test-driven-development` 스킬을 먼저 호출한다.

- 테스트 보강 항목에 대해 RED-GREEN-REFACTOR 사이클을 따른다.
- 테스트 없이 작성된 테스트 대상 코드는 삭제하고 재작성한다.

**Step 3 — 결함 수정**

`FIX` 항목이 있으면 `Skill` 툴을 사용해 `superpowers:subagent-driven-development` 스킬을 호출한다. OPEN 항목을 보강 태스크 단위로 분해해 실행한다.

**Step 4 — 회귀 테스트**

`Skill` 툴을 사용해 `superpowers:test-driven-development` 스킬을 호출한다.

- 수정한 항목에 대해 RED-GREEN-REFACTOR 사이클을 따른다.
- 테스트 없이 수정된 코드는 삭제하고 재작성한다.

---

## 4. 완료 보고

```bash
echo "implemented" > docs/features/$FEATURE_SLUG/phase.md
```

```
✅ 보강 완료

FIXED: {n}건
잔여 OPEN: {n}건

보강 결과를 확인하셨나요? 검토가 끝났다면 검증을 재실행하세요.
`/clear` 로 세션을 초기화한 뒤 `/project-verify $FEATURE_SLUG` 를 실행하세요.
```

여기서 종료한다. /project-verify 재실행 전까지 추가 코드를 작성하지 않는다.
