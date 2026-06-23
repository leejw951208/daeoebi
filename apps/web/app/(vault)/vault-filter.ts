// vault entries 목록의 URL 기반 필터 파싱 helper. UI 와 분리해 단위 테스트에서 직접 호출한다.
import { type VaultCategory } from "@/lib/vault-client"
import { CATEGORY_LABELS } from "./category-schema"

const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS) as VaultCategory[]

export function parseCategoryFilter(raw: string | null): VaultCategory | "ALL" {
    if (!raw) return "ALL"
    return (CATEGORY_VALUES as string[]).includes(raw)
        ? (raw as VaultCategory)
        : "ALL"
}
