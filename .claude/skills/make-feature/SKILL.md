---
name: make-feature
description: Use when starting net-new feature work in this project end-to-end — creating the branch, running the guided feature-dev implementation workflow, AND leaving a persisted feature document. Trigger whenever the user says "기능 개발하자", "새 기능 만들어줘", "이 기능 구현하고 문서까지", "feature 개발", or otherwise kicks off a brand-new feature here. Prefer this over invoking feature-dev directly: feature-dev alone never writes a docs/features artifact — this skill wraps it with main-based branch creation and a FEATURE_TEMPLATE.md-based completion doc saved to docs/features/<feature_slug>.md.
---

# Feature Dev with Docs

## Overview

`feature-dev` 스킬은 기능을 훌륭하게 구현하지만 **완료 문서를 남기지 않는다** — 7단계 요약(Phase 7)이 채팅에만 출력되고 끝난다. 이 스킬은 그 공백을 메운다. 하나의 기능을 **브랜치 생성 → feature-dev 구현 → 완료 문서 저장**까지 한 흐름으로 진행해, 나중에 "이 기능이 무엇이고 왜 이렇게 만들었나"를 코드가 아니라 문서로 되짚을 수 있게 한다.

이 스킬의 제1원칙: **문서는 실제 변경에 근거한다.** 산출물은 채팅 요약을 복붙한 것이 아니라, `git diff`로 확인한 실제 변경·결정에 기반해 작성한다. 근거를 댈 수 없는 내용은 쓰지 않는다. 문서가 코드와 어긋나면 없느니만 못하기 때문이다.

## 핵심 규칙

- **범위**: 이 스킬이 관장하는 것은 3단계(브랜치·구현·문서)뿐이다. 요청하지 않은 리팩토링·머지·의존성 변경은 하지 않는다. main 머지는 항상 사용자가 직접 한다.
- **구현은 feature-dev에 위임**: 발견·탐색·질문·아키텍처·구현·리뷰는 `feature-dev` 스킬이 담당한다. 이 스킬은 그 앞뒤(브랜치·문서)만 감싼다. 구현 로직을 여기서 다시 설계하지 않는다.
- **문서는 근거 기반**: 완료 문서의 "바뀐 것"·"핵심 결정"은 `git diff main...HEAD`와 실제 대화에서 나온 결정으로 채운다. 추측으로 파일 경로나 결정을 지어내지 않는다.
- **한국어·마침표 종결**: 문서 본문은 한국어로 쓰고 문장은 마침표로 끝낸다. 코드 식별자·파일명·브랜치명은 원문 그대로 둔다.
- **간결하게**: 템플릿 안내대로 각 항목은 한두 줄. 장황하게 쓰지 않는다.

## 진행 흐름

전체를 TodoWrite로 추적한다: `브랜치 생성`, `feature-dev 구현`, `완료 문서 작성`.

### Phase 0 — feature_slug 확정 & 브랜치 생성

기능을 대표하는 **kebab-case 영문 slug**를 정한다. 기존 `docs/features/` 하위 이름(`recurring-term-months`, `monthly-income` 등)과 같은 결의 짧고 명확한 이름으로 한다. 애매하면 사용자에게 확인한다. 이 slug 하나가 브랜치명과 문서 파일명 양쪽에 쓰인다.

**base 브랜치는 main이다.** (프로젝트의 기존 develop 기준 규칙과 다르다 — 이 스킬은 main 기반으로 동작한다.) main을 최신화한 뒤 그 위에서 작업 브랜치를 만든다:

```bash
git checkout main
git pull
git checkout -b feat/<feature_slug>
```

작업 트리가 더러우면(uncommitted 변경) 먼저 사용자에게 알리고, 브랜치를 바꾸기 전에 어떻게 처리할지 확인한다. 임의로 stash·discard 하지 않는다.

### Phase 1 — feature-dev로 기능 구현

`feature-dev` 스킬(Skill 도구: `feature-dev:feature-dev`)을 호출해 구현 워크플로우를 그대로 태운다. 사용자의 원래 기능 요청을 전달한다. feature-dev의 7단계(발견 → 탐색 → 질문 → 아키텍처 → 구현 → 품질 리뷰 → 요약)를 **끝까지** 따른다.

- feature-dev가 사용자에게 질문·승인을 요구하는 단계(질문·아키텍처 선택·구현 승인·리뷰 처리)를 건너뛰지 않는다. 그 승인 지점들이 이 워크플로우의 핵심 안전장치다.
- feature-dev의 Phase 7 요약이 나오면 구현이 끝난 것이다. 그 요약(무엇을 만들었나·핵심 결정·바뀐 파일)은 다음 단계 문서의 1차 재료가 된다. 단, 재료일 뿐 최종 근거는 diff다.

### Phase 2 — 완료 문서 작성 & 저장

구현이 끝나면 완료 문서를 만든다.

1. **템플릿을 읽는다**: 스킬 번들의 `assets/FEATURE_TEMPLATE.md`. 이 파일이 완료 문서의 구조·항목·톤의 기준이다. 매번 새로 읽어 최신 템플릿을 반영한다. (맨 위 HTML 주석 안내는 문서에 넣지 않는다.)
2. **실제 변경을 확인한다** — 추측 금지:
   ```bash
   git diff main...HEAD --stat
   git log main..HEAD --oneline
   ```
   더 자세한 근거가 필요하면 해당 파일의 diff를 직접 본다.
3. **템플릿을 채운다**: `< >` 자리표시자를 실제 내용으로 바꾸고, 해당 없는 줄은 지운다.
   - 상단 표: 상태(보통 ✅ 완료), 브랜치(`feat/<feature_slug>`), 작성일(오늘 날짜), 관련 문서(있으면 spec·plan·PR 링크).
   - "무엇을 만들었나 / 왜": feature-dev 대화에서 확정된 배경·목표를 요약.
   - "핵심 결정": 기억할 가치가 있는 선택만. 아키텍처 단계에서 버린 대안이 있으면 함께 적는다.
   - "바뀐 것": §2의 diff에 실제로 나타난 파일·마이그레이션만 적는다. diff에 없는 것을 쓰지 않는다.
   - "확인 방법": 실제로 통과시킨 검증(make 타깃)과 재현 시나리오를 적는다. 관련 QA가 있으면 참조.
4. **저장한다**: `docs/features/<feature_slug>.md`.

### 마무리

- 저장한 문서 경로를 사용자에게 알린다.
- 완료 문서는 `docs: <feature_slug> 완료 문서 추가` 형식으로 커밋할 수 있다. 단 커밋·머지 여부는 프로젝트 규칙과 사용자 판단에 따른다 — main 머지는 사용자가 직접 한다.

## 품질 체크 (문서 저장 전)

- [ ] `docs/features/<feature_slug>.md` 가 생성됐다.
- [ ] `< >` 자리표시자가 하나도 남아있지 않다(채웠거나 지웠다).
- [ ] "바뀐 것"의 모든 파일·마이그레이션이 `git diff main...HEAD` 에 실제로 존재한다.
- [ ] 본문이 한국어이고 문장이 마침표로 끝난다.
- [ ] 각 항목이 간결하다(한두 줄).
