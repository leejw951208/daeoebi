// 폼 작성 도움용 필드 이름 추천 목록. 읽기 전용이며 빠른 추가 보조 수단이다.

export interface FieldSuggestion {
    name: string
    // 값이 민감해 기본 마스킹 대상인지 여부.
    sensitive: boolean
}

// 자주 쓰는 필드 이름. DESIGN_BRIEF §4-8 의 추천 목록.
export const FIELD_SUGGESTIONS: FieldSuggestion[] = [
    { name: "아이디", sensitive: false },
    { name: "비밀번호", sensitive: true },
    { name: "계좌번호", sensitive: true },
    { name: "PIN", sensitive: true },
    { name: "카드번호", sensitive: true },
    { name: "유효기간", sensitive: false },
    { name: "CVC", sensitive: true },
    { name: "OTP 시드", sensitive: true },
    { name: "보안카드", sensitive: true },
    { name: "URL", sensitive: false },
]
