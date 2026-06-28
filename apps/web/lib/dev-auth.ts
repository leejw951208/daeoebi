// 비운영(로컬 등) 전용 패스키 우회. 운영에선 DEV_AUTH 가 false 로 인라인돼 dead-code 제거된다.
// 서버 dev 세션 + 결정적 dev VK 로 패스키 없이 보관함에 진입한다(로컬 UI 확인용).
import { importVaultKeyRaw } from "./vault-crypto"
import { postDevLogin } from "./vault-client"

// Next 가 빌드 시 process.env.NODE_ENV 를 상수로 인라인한다(ServiceWorkerRegister 와 동일 패턴).
// 운영 번들에선 false 로 굳어 아래 호출부의 dev 분기가 제거된다.
export const DEV_AUTH = process.env.NODE_ENV !== "production"

// 고정 시드에서 결정적 256-bit VK 를 도출한다. 매 세션 같은 키라 dev 에서 만든 데이터가
// 새로고침 후에도 복호화된다(생성·재열람 테스트 가능). 운영 패스키 VK 와는 무관하다.
const DEV_VK_SEED = "daeoebi-dev-vault-key-v1"

async function deriveDevVaultKey(): Promise<CryptoKey> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(DEV_VK_SEED),
    )
    return importVaultKeyRaw(new Uint8Array(digest))
}

// dev 세션 발급 + dev VK 도출. 비운영에서만 호출된다.
export async function devUnlock(): Promise<CryptoKey> {
    await postDevLogin()
    return deriveDevVaultKey()
}
