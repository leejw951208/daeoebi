// 시크릿 본문 평문 구조의 직렬화 헬퍼. label(제목)만 평문이고 fields·memo 는 이 구조로 묶여 암호화된다.
import { open, seal, type SealedBlob } from "@/lib/vault-crypto"
import type { SecretPayload } from "./vault-context"

// 본문 평문 구조 버전. 포맷 변경 시 마이그레이션 분기에 사용한다.
const PAYLOAD_VERSION = 1

interface VersionedPayload {
    v: number
    fields: { name: string; value: string; sensitive?: boolean }[]
    memo: string
}

// 평문 payload 를 VK 로 암호화해 분리 블롭(iv/ciphertext/authTag)으로 반환한다.
export async function sealPayload(
    vaultKey: CryptoKey,
    payload: SecretPayload,
): Promise<SealedBlob> {
    const versioned: VersionedPayload = {
        v: PAYLOAD_VERSION,
        fields: payload.fields,
        memo: payload.memo,
    }
    return seal(vaultKey, JSON.stringify(versioned))
}

// 분리 블롭을 VK 로 복호화해 평문 payload 로 복원한다.
export async function openPayload(
    vaultKey: CryptoKey,
    blob: SealedBlob,
): Promise<SecretPayload> {
    const json = await open(vaultKey, blob)
    const parsed = JSON.parse(json) as Partial<VersionedPayload>
    return {
        fields: Array.isArray(parsed.fields)
            ? parsed.fields.map((f) => ({
                  name: String(f.name ?? ""),
                  value: String(f.value ?? ""),
                  // 구버전 데이터엔 sensitive 가 없다. 그대로 undefined 로 두어 상세에서 이름 휴리스틱으로 폴백시킨다.
                  sensitive:
                      typeof f.sensitive === "boolean"
                          ? f.sensitive
                          : undefined,
              }))
            : [],
        memo: typeof parsed.memo === "string" ? parsed.memo : "",
    }
}
