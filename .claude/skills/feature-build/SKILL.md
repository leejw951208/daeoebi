---
name: feature-build
description: 대외비 기능 개발을 백엔드·프론트엔드·보안검토·QA 에이전트 팀으로 조율하는 오케스트레이터. 기능 추가·수정, 화면+API 동시 작업, "기능 만들어줘", "구현해줘", "이 화면/엔드포인트 추가", 그리고 "다시 실행", "재실행", "보완", "수정", "이전 결과 기반으로", "~만 다시" 등 후속 요청 시 반드시 이 스킬을 사용할 것. 단순 단일 파일 수정이나 질문은 직접 응답 가능.
---

# Feature Build 오케스트레이터

대외비의 기능 개발을 **에이전트 팀**으로 조율한다. 백엔드·프론트엔드가 병렬로 만들고, 보안 검토·통합 QA가 검증하는 **생성-검증 하이브리드**다.

## 팀 구성
| 에이전트 | 정의 | 역할 | 타입 |
|---------|------|------|------|
| api-engineer | `.claude/agents/api-engineer.md` | NestJS + Prisma 백엔드 | general-purpose |
| web-engineer | `.claude/agents/web-engineer.md` | Next.js + React 프론트 | general-purpose |
| security-reviewer | `.claude/agents/security-reviewer.md` | 암호화·인증·CSRF 감사 | general-purpose |
| integration-qa | `.claude/agents/integration-qa.md` | 경계면 정합성 + 검증 명령 | general-purpose |

**모든 Agent 호출에 `model: "opus"`를 명시한다.**

## Phase 0: 컨텍스트 확인
워크플로우 시작 시 `_workspace/` 존재 여부로 실행 모드를 판별한다:
- `_workspace/` 없음 → **초기 실행**.
- `_workspace/` 있음 + 사용자가 부분 수정 요청 → **부분 재실행** (해당 에이전트만 재호출, 이전 산출물 읽고 개선).
- `_workspace/` 있음 + 새 기능 요청 → **새 실행** (`_workspace/`를 `_workspace_prev/`로 이동 후 시작).

## Phase 1: 요구사항 분해
1. 요청을 백엔드 작업·프론트 작업으로 분해한다. 영향 모듈을 식별한다 (`store`/`vault`/`pin` 등, `app/(vault)/` 화면).
2. 보안 표면에 닿는지 판단한다 (암호화·인증·세션·CSRF). 닿으면 security-reviewer 검토를 계획에 포함한다.
3. 작업 규모로 팀 크기를 정한다. 보통 4명 전원. 백엔드만/프론트만이면 해당 엔지니어 + QA로 축소 가능.

## Phase 2: 빌드 (병렬, 에이전트 팀)
**실행 모드: 에이전트 팀**

1. `TeamCreate`로 필요한 에이전트를 멤버로 팀을 구성한다.
2. `TaskCreate`로 작업을 할당한다. **API 계약을 먼저 확정**하도록 의존성을 건다 — web-engineer 작업은 api-engineer의 계약 산출에 `blockedBy`로 의존시키거나, api-engineer가 계약을 `SendMessage`로 공유하게 한다.
3. 엔지니어들은 각자 스킬(`api-development`/`web-development`)에 따라 구현하고, 산출물 요약을 `_workspace/`에 기록한다.
4. 각 엔지니어는 모듈 완성 시 integration-qa에 "검증 요청" 메시지를 보낸다 (점진적 QA).

## Phase 3: 검증 (생성-검증)
**실행 모드: 에이전트 팀 (동일 팀 내 검증 역할)**

1. **통합 QA**: integration-qa가 경계면을 교차 비교하고 `make typecheck`/`make lint`/`make test`를 실행한다. 불일치·실패는 책임 엔지니어에게 통보 → 엔지니어가 수정 → 재검증.
2. **보안 검토**: 보안 표면에 닿은 변경이면 security-reviewer가 감사한다. critical/high는 즉시 엔지니어에게 통보 → 수정 → 재검토.
3. 검증이 모두 통과하거나, 남은 이슈가 보고·기록될 때까지 반복한다.

## Phase 4: 종합
1. 팀 산출물(`_workspace/`)을 모아 변경 요약을 작성한다: 변경 파일, 추가/변경 엔드포인트·화면, 보안 검토 결과, 검증 통과 여부.
2. 미해결 이슈는 누락 없이 명시한다 (1회 재시도 후에도 실패한 항목은 결과에 표시).
3. 팀을 정리한다.
4. 사용자에게 결과를 보고하고 피드백을 요청한다 ("개선할 부분이 있나요? 팀 구성·흐름을 바꿀까요?").

## 데이터 전달 프로토콜
- **태스크 기반**: `TaskCreate`/`TaskUpdate`로 작업 의존성·진행상황 관리.
- **메시지 기반**: `SendMessage`로 API 계약 공유, 검증 요청, 취약점 통보.
- **파일 기반**: `_workspace/{phase}_{agent}_{artifact}.md`에 중간 산출물. 최종 변경만 실제 코드에 반영, `_workspace/`는 감사용으로 보존.

## 에러 핸들링
- 에이전트 실패 시 1회 재시도. 재실패하면 해당 결과 없이 진행하고 종합 보고에 누락을 명시한다.
- 경계면 불일치·상충 데이터는 삭제하지 않고 양쪽 출처를 병기해 보고한다.
- Prisma 마이그레이션 충돌·환경 문제(DB 미기동)는 코드 결함과 구분해 보고한다.

## 테스트 시나리오
**정상 흐름**: "카테고리에 메모 필드를 추가해줘" → Phase 1에서 백엔드(Secret DTO·서비스·마이그레이션) + 프론트(폼·상세 화면) 분해 → Phase 2에서 api-engineer가 DTO·마이그레이션 계약 확정·공유, web-engineer가 폼 구현 → Phase 3에서 QA가 `make typecheck`로 shape 일치 확인, 보안 검토가 입력 검증 점검 → Phase 4 종합 보고.

**에러 흐름**: web-engineer가 호출하는 응답 필드가 API 서비스 반환과 불일치 → integration-qa가 `웹 파일:라인 ↔ API 파일:라인`으로 보고 → 단정 없이 api-engineer·web-engineer에게 통보 → 옳은 쪽 확정 후 수정 → 재검증 통과 후 종합.
