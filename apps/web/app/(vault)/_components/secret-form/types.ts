// secret-form 내부 공유 타입·상수. 컨테이너와 단계 컴포넌트가 함께 참조한다.
import type { SecretField } from "../../_lib/vault-context"

// 한 시크릿에 담을 수 있는 최대 필드 수.
export const MAX_FIELDS = 20

export interface FieldRow extends SecretField {
    // 재정렬·삭제 시 안정적 key 용 로컬 식별자.
    key: string
}
