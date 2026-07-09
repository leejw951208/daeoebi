// 클라이언트 E2E 암호화 모듈. VK 생성·HKDF·AES-256-GCM seal/open·packed blob·복구코드를 WebCrypto로 수행한다.

// HKDF info 문자열은 계약서 §1 고정값이다. 양측이 동일하게 사용한다.
export const PRF_INFO = "sm-vk-prf-v1"
export const RC_INFO = "sm-vk-rc-v1"

const IV_BYTES = 12
const TAG_BYTES = 16
const VK_BITS = 256
const SALT_BYTES = 32
const RECOVERY_BITS = 160

// WebCrypto 입력은 ArrayBuffer 백킹 BufferSource 를 요구한다. SharedArrayBuffer 백킹을 배제해 새 뷰로 정규화한다.
function buf(bytes: Uint8Array): ArrayBuffer {
    const copy = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(copy).set(bytes)
    return copy
}

// base64url(패딩 없음) 인코딩. API JSON 으로 바이트를 주고받을 때 사용한다.
export function toBase64Url(bytes: Uint8Array): string {
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

// base64url(패딩 없음) 디코딩.
export function fromBase64Url(value: string): Uint8Array {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        "=",
    )
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

// AES-GCM 산출물을 단일 바이트열 iv(12)||ciphertext||authTag(16) 로 이어붙인다.
function pack(iv: Uint8Array, ciphertextWithTag: Uint8Array): Uint8Array {
    const out = new Uint8Array(iv.byteLength + ciphertextWithTag.byteLength)
    out.set(iv, 0)
    out.set(ciphertextWithTag, iv.byteLength)
    return out
}

// packed blob 에서 iv 와 (ciphertext||authTag) 를 분리한다.
function unpack(blob: Uint8Array): { iv: Uint8Array; body: Uint8Array } {
    if (blob.byteLength < IV_BYTES + TAG_BYTES) {
        throw new Error("packed blob 길이가 너무 짧습니다.")
    }
    return {
        iv: blob.slice(0, IV_BYTES),
        body: blob.slice(IV_BYTES),
    }
}

// 256-bit AES-GCM VK 를 새로 생성한다. extractable=true 여야 래핑이 가능하다.
export async function generateVaultKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: "AES-GCM", length: VK_BITS },
        true,
        ["encrypt", "decrypt"],
    )
}

// VK 의 원시 32바이트를 추출한다(래핑 입력용).
async function exportVaultKeyRaw(vk: CryptoKey): Promise<Uint8Array> {
    const raw = await crypto.subtle.exportKey("raw", vk)
    return new Uint8Array(raw)
}

// 원시 32바이트로부터 VK 를 복원한다(언랩 결과용).
export async function importVaultKeyRaw(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        buf(raw),
        { name: "AES-GCM", length: VK_BITS },
        true,
        ["encrypt", "decrypt"],
    )
}

// 32바이트 무작위 salt 를 생성한다(PRF/복구 래핑용).
export function randomSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(SALT_BYTES))
}

// HKDF-SHA256 으로 입력 키 재료에서 32바이트 래핑 키(AES-GCM)를 도출한다.
async function deriveWrappingKey(
    ikm: Uint8Array,
    salt: Uint8Array,
    info: string,
): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        buf(ikm),
        "HKDF",
        false,
        ["deriveKey"],
    )
    return crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: buf(salt),
            info: buf(new TextEncoder().encode(info)),
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    )
}

// 래핑 키로 VK 원시 바이트를 AES-256-GCM 암호화하고 packed blob 으로 반환한다.
async function wrapKeyRaw(
    wrappingKey: CryptoKey,
    vkRaw: Uint8Array,
): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const ciphertextWithTag = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: buf(iv), tagLength: TAG_BYTES * 8 },
            wrappingKey,
            buf(vkRaw),
        ),
    )
    return pack(iv, ciphertextWithTag)
}

// packed blob 을 래핑 키로 언랩해 VK 원시 바이트를 반환한다(GCM 인증 실패 시 throw).
async function unwrapKeyRaw(
    wrappingKey: CryptoKey,
    blob: Uint8Array,
): Promise<Uint8Array> {
    const { iv, body } = unpack(blob)
    const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: buf(iv), tagLength: TAG_BYTES * 8 },
        wrappingKey,
        buf(body),
    )
    return new Uint8Array(plain)
}

// PRF 출력으로 VK 를 래핑한다. WK_prf = HKDF(prfOutput, prfSalt, "sm-vk-prf-v1").
export async function wrapVkWithPrf(
    vk: CryptoKey,
    prfOutput: Uint8Array,
    prfSalt: Uint8Array,
): Promise<Uint8Array> {
    const wrappingKey = await deriveWrappingKey(prfOutput, prfSalt, PRF_INFO)
    return wrapKeyRaw(wrappingKey, await exportVaultKeyRaw(vk))
}

// PRF 출력으로 wrappedVkPrf 를 언랩해 VK 를 복원한다.
export async function unwrapVkWithPrf(
    wrappedVkPrf: Uint8Array,
    prfOutput: Uint8Array,
    prfSalt: Uint8Array,
): Promise<CryptoKey> {
    const wrappingKey = await deriveWrappingKey(prfOutput, prfSalt, PRF_INFO)
    return importVaultKeyRaw(await unwrapKeyRaw(wrappingKey, wrappedVkPrf))
}

// 복구코드 바이트로 VK 를 래핑한다. WK_rc = HKDF(recoveryBytes, rcSalt, "sm-vk-rc-v1").
export async function wrapVkWithRecovery(
    vk: CryptoKey,
    recoveryBytes: Uint8Array,
    rcSalt: Uint8Array,
): Promise<Uint8Array> {
    const wrappingKey = await deriveWrappingKey(recoveryBytes, rcSalt, RC_INFO)
    return wrapKeyRaw(wrappingKey, await exportVaultKeyRaw(vk))
}

// 복구코드 바이트로 wrappedVkRc 를 언랩해 VK 를 복원한다(인증 실패 = 잘못된 코드).
export async function unwrapVkWithRecovery(
    wrappedVkRc: Uint8Array,
    recoveryBytes: Uint8Array,
    rcSalt: Uint8Array,
): Promise<CryptoKey> {
    const wrappingKey = await deriveWrappingKey(recoveryBytes, rcSalt, RC_INFO)
    return importVaultKeyRaw(await unwrapKeyRaw(wrappingKey, wrappedVkRc))
}

// VK 로 평문 문자열을 AES-256-GCM 암호화한다. iv/ciphertext/authTag 분리 형태(secret 본문용).
export interface SealedBlob {
    iv: string
    ciphertext: string
    authTag: string
}

export async function seal(
    vk: CryptoKey,
    plaintext: string,
): Promise<SealedBlob> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const data = new TextEncoder().encode(plaintext)
    const combined = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: buf(iv), tagLength: TAG_BYTES * 8 },
            vk,
            buf(data),
        ),
    )
    const tagStart = combined.byteLength - TAG_BYTES
    return {
        iv: toBase64Url(iv),
        ciphertext: toBase64Url(combined.slice(0, tagStart)),
        authTag: toBase64Url(combined.slice(tagStart)),
    }
}

// VK 로 iv/ciphertext/authTag 를 복호화해 평문 문자열을 반환한다.
export async function open(vk: CryptoKey, blob: SealedBlob): Promise<string> {
    const iv = fromBase64Url(blob.iv)
    const ciphertext = fromBase64Url(blob.ciphertext)
    const authTag = fromBase64Url(blob.authTag)
    const body = new Uint8Array(ciphertext.byteLength + authTag.byteLength)
    body.set(ciphertext, 0)
    body.set(authTag, ciphertext.byteLength)
    const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: buf(iv), tagLength: TAG_BYTES * 8 },
        vk,
        buf(body),
    )
    return new TextDecoder().decode(plain)
}

// Crockford Base32 알파벳(혼동 문자 I,L,O,U 제외).
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// 바이트열을 Crockford Base32(패딩 없음)로 인코딩한다.
function base32Encode(bytes: Uint8Array): string {
    let bits = 0
    let value = 0
    let output = ""
    for (let i = 0; i < bytes.byteLength; i += 1) {
        value = (value << 8) | bytes[i]
        bits += 8
        while (bits >= 5) {
            output += CROCKFORD[(value >>> (bits - 5)) & 31]
            bits -= 5
        }
    }
    if (bits > 0) {
        output += CROCKFORD[(value << (5 - bits)) & 31]
    }
    return output
}

// Crockford Base32 문자열을 바이트열로 디코딩한다(혼동 문자 정규화 포함).
function base32Decode(text: string): Uint8Array {
    const cleaned = text
        .toUpperCase()
        .replace(/[ILO]/g, (c) => (c === "I" || c === "L" ? "1" : "0"))
        .replace(/U/g, "V")
        .replace(/[^0-9A-Z]/g, "")
    let bits = 0
    let value = 0
    const out: number[] = []
    for (const ch of cleaned) {
        const idx = CROCKFORD.indexOf(ch)
        if (idx === -1) continue
        value = (value << 5) | idx
        bits += 5
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff)
            bits -= 8
        }
    }
    return new Uint8Array(out)
}

// 4글자 단위로 하이픈 그룹 표기한다. 160bit → 32자 → 8그룹.
function groupCode(raw: string): string {
    return raw.match(/.{1,4}/g)?.join("-") ?? raw
}

export interface RecoveryCode {
    // 사용자에게 표시·검증할 그룹 표기 문자열.
    display: string
    // 래핑 입력으로 쓰는 원시 엔트로피 바이트(160bit).
    bytes: Uint8Array
}

// 160bit 고엔트로피 복구코드를 생성한다(표시 문자열 + 원시 바이트).
export function generateRecoveryCode(): RecoveryCode {
    const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_BITS / 8))
    return { display: groupCode(base32Encode(bytes)), bytes }
}

// 사용자가 입력한 복구코드를 파싱해 원시 바이트를 복원한다(하이픈·공백·혼동 문자 허용).
export function parseRecoveryCode(input: string): Uint8Array {
    return base32Decode(input)
}

// 복구코드 원시 바이트 길이(160bit = 20B). 입력 검증 기준(L-2).
export const RECOVERY_CODE_BYTES = RECOVERY_BITS / 8

// 파싱된 복구코드가 정확히 160bit(20B)인지 검증한다.
export function isValidRecoveryLength(bytes: Uint8Array): boolean {
    return bytes.byteLength === RECOVERY_CODE_BYTES
}

// 복구코드 바이트의 SHA-256 verifier 를 계산한다. 서버 verifier(=SHA-256(code bytes))와 비교용.
export async function recoveryVerifier(
    recoveryBytes: Uint8Array,
): Promise<Uint8Array> {
    const digest = await crypto.subtle.digest("SHA-256", buf(recoveryBytes))
    return new Uint8Array(digest)
}
