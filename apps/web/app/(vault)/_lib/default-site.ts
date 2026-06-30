// 기본 사이트 선택(순수 함수). 단일 사용자 평면 대외비에서 "기본 사이트"는 결정적이어야 한다.
// 과거 중복 생성 등으로 같은 라벨의 사이트가 둘 이상이어도 항상 같은 사이트를 고른다.
// 정렬 기준: createdAt 오름차순(가장 오래된=원본 우선), 동시각이면 id 로 안정 정렬.
//
// 배경: 이전 구현은 listSites() 결과의 sites[0] 를 썼는데, 서버 list 는 label 정렬이라
// 라벨이 같은 중복 사이트끼리는 순서가 비결정적이었다. 인덱스 변경 등으로 순서가 뒤집히면
// 데이터가 적은 중복 사이트가 기본으로 잡혀 사용자의 비밀번호가 가려지는 문제가 있었다.

export interface DefaultSiteCandidate {
    id: string
    createdAt: string
}

// 가장 오래된 사이트의 id 를 반환한다. 후보가 없으면 null.
export function pickDefaultSiteId(
    sites: readonly DefaultSiteCandidate[],
): string | null {
    if (sites.length === 0) return null
    const sorted = [...sites].sort((a, b) => {
        if (a.createdAt !== b.createdAt) {
            return a.createdAt < b.createdAt ? -1 : 1
        }
        // 동시각 tie-break: id 사전순으로 안정적 결정.
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    return sorted[0].id
}
