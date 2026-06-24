// WebAuthn 세레모니 래퍼. @simplewebauthn/browser 로 등록·인증하고 PRF 확장 출력을 추출한다.
import {
    browserSupportsWebAuthn,
    startAuthentication,
    startRegistration,
    type AuthenticationResponseJSON,
    type PublicKeyCredentialCreationOptionsJSON,
    type PublicKeyCredentialRequestOptionsJSON,
    type RegistrationResponseJSON,
} from "@simplewebauthn/browser"
import { fromBase64Url, toBase64Url } from "./vault-crypto"

// simplewebauthn 13 타입에는 prf 출력이 빠져 있어, 런타임에 존재하는 prf 결과를 직접 정의한다.
interface PrfExtensionResults {
    prf?: {
        enabled?: boolean
        results?: {
            first?: ArrayBuffer | Uint8Array
            second?: ArrayBuffer | Uint8Array
        }
    }
}

// PRF eval 입력 타입. simplewebauthn/DOM JSON 타입에 prf 가 없어 직접 정의한다.
// 주의: @simplewebauthn/browser 의 startRegistration/startAuthentication 은 challenge·
// allowCredentials 만 BufferSource 로 변환하고 prf eval 은 변환하지 않는다. 따라서 eval 값은
// 반드시 BufferSource(Uint8Array)로 직접 넣어야 navigator 가 PRF 를 평가한다.
// eval 값은 Uint8Array(런타임상 유효한 BufferSource)로 통일한다. DOM JSON 타입과의 간극은
// 옵션 전체를 단언할 때 흡수한다.
interface PrfEvalInput {
    first: Uint8Array
    second?: Uint8Array
}
interface PrfExtensionInput {
    prf?: {
        eval?: PrfEvalInput
        evalByCredential?: Record<string, PrfEvalInput>
    }
}

// 현재 브라우저가 WebAuthn 을 지원하는지 여부.
export function supportsWebAuthn(): boolean {
    return browserSupportsWebAuthn()
}

// ArrayBuffer/Uint8Array 형태의 PRF 출력을 Uint8Array 로 정규화한다.
function toBytes(value: ArrayBuffer | Uint8Array): Uint8Array {
    return value instanceof Uint8Array ? value : new Uint8Array(value)
}

// 세레모니 응답에서 PRF 출력(first)을 추출한다. 없으면 null.
function extractPrfOutput(
    response: RegistrationResponseJSON | AuthenticationResponseJSON,
): Uint8Array | null {
    const ext = response.clientExtensionResults as PrfExtensionResults
    const first = ext.prf?.results?.first
    return first ? toBytes(first) : null
}

// PRF 가 인증기/브라우저 수준에서 활성화됐는지(enabled) 여부.
function prfEnabled(
    response: RegistrationResponseJSON | AuthenticationResponseJSON,
): boolean {
    const ext = response.clientExtensionResults as PrfExtensionResults
    return ext.prf?.enabled === true
}

// 서버가 base64url 로 보낸 PRF eval 값을 Uint8Array(BufferSource)로 변환한다(라이브러리 미변환 보완).
function decodeEval(value: string | BufferSource): Uint8Array {
    if (typeof value === "string") return fromBase64Url(value)
    if (value instanceof Uint8Array) return value
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
}

export interface RegistrationResult {
    response: RegistrationResponseJSON
    prfOutput: Uint8Array | null
}

export interface AuthenticationResult {
    response: AuthenticationResponseJSON
    prfOutput: Uint8Array | null
}

// PRF 확장 출력이 없을 때 던지는 전용 에러(인증기 PRF 미지원 안내용).
export class PrfUnsupportedError extends Error {
    constructor() {
        super("이 인증기는 PRF 확장을 지원하지 않아 키를 도출할 수 없습니다.")
        this.name = "PrfUnsupportedError"
    }
}

// 사용자가 세레모니를 취소했을 때 던지는 전용 에러.
export class CeremonyCancelledError extends Error {
    constructor() {
        super("인증이 취소되었습니다.")
        this.name = "CeremonyCancelledError"
    }
}

// DOMException name 으로 사용자 취소 여부를 판정한다.
function isCancellation(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.name === "NotAllowedError" || error.name === "AbortError")
    )
}

// 32바이트 무작위 챌린지를 base64url 로 생성한다(로컬 전용 PRF 보강 get 용).
function randomChallenge(): string {
    return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

// passkey 등록 세레모니를 수행하고 응답 + PRF 출력을 반환한다.
// prfSalt 를 eval.first 로 주입해 생성 시점에 PRF 출력을 얻는다. 생성 시점에 출력을 돌려주지
// 않는 인증기(다수의 플랫폼 인증기)는 동일 prfSalt 로 즉시 인증(get)을 한 번 더 수행해 출력을 얻는다.
export async function registerPasskey(
    options: PublicKeyCredentialCreationOptionsJSON,
    prfSalt: Uint8Array,
): Promise<RegistrationResult> {
    const optionsWithPrf = {
        ...options,
        extensions: {
            ...options.extensions,
            prf: { eval: { first: prfSalt } },
        } as PrfExtensionInput,
    } as PublicKeyCredentialCreationOptionsJSON

    let response: RegistrationResponseJSON
    try {
        response = await startRegistration({ optionsJSON: optionsWithPrf })
    } catch (error) {
        if (isCancellation(error)) throw new CeremonyCancelledError()
        throw error
    }

    // 생성 시점에 PRF 출력을 돌려준 경우 그대로 사용한다.
    const atCreate = extractPrfOutput(response)
    if (atCreate) return { response, prfOutput: atCreate }

    // PRF 자체가 활성화되지 않았다면 인증기/브라우저가 PRF 를 지원하지 않는 것이다.
    if (!prfEnabled(response)) {
        throw new PrfUnsupportedError()
    }

    // PRF 는 지원하나 생성 시점엔 출력을 주지 않는 인증기 → 동일 salt 로 즉시 get 보강.
    const prfOutput = await derivePrfViaAuthentication(
        response,
        prfSalt,
        getRpId(options),
    )
    if (!prfOutput) throw new PrfUnsupportedError()
    return { response, prfOutput }
}

// 방금 등록한 credential 로 즉시 인증(get)을 수행해 PRF 출력을 얻는 보강 경로.
// assertion 은 서버로 보내지 않고 로컬에서 PRF 출력만 추출한다.
async function derivePrfViaAuthentication(
    registration: RegistrationResponseJSON,
    prfSalt: Uint8Array,
    rpId: string | undefined,
): Promise<Uint8Array | null> {
    const requestOptions = {
        challenge: randomChallenge(),
        ...(rpId ? { rpId } : {}),
        allowCredentials: [
            {
                id: registration.id,
                type: "public-key",
                transports: registration.response.transports,
            },
        ],
        userVerification: "required",
        extensions: { prf: { eval: { first: prfSalt } } } as PrfExtensionInput,
    } as PublicKeyCredentialRequestOptionsJSON

    let response: AuthenticationResponseJSON
    try {
        response = await startAuthentication({ optionsJSON: requestOptions })
    } catch (error) {
        if (isCancellation(error)) throw new CeremonyCancelledError()
        throw error
    }
    return extractPrfOutput(response)
}

// 등록 옵션에서 rp.id 를 안전하게 꺼낸다.
function getRpId(
    options: PublicKeyCredentialCreationOptionsJSON,
): string | undefined {
    return options.rp?.id
}

// passkey 인증 세레모니를 수행하고 응답 + PRF 출력을 반환한다.
// 서버가 base64url 로 보낸 prf eval(evalByCredential/eval)을 BufferSource 로 변환해 넘긴다.
export async function authenticatePasskey(
    options: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResult> {
    const optionsWithPrf = withDecodedPrfEval(options)
    let response: AuthenticationResponseJSON
    try {
        response = await startAuthentication({ optionsJSON: optionsWithPrf })
    } catch (error) {
        if (isCancellation(error)) throw new CeremonyCancelledError()
        throw error
    }
    return { response, prfOutput: extractPrfOutput(response) }
}

// 인증 옵션의 prf eval 값(base64url 문자열)을 BufferSource 로 변환한 새 옵션을 만든다.
function withDecodedPrfEval(
    options: PublicKeyCredentialRequestOptionsJSON,
): PublicKeyCredentialRequestOptionsJSON {
    const ext = options.extensions as
        | (PrfExtensionInput & { prf?: { eval?: { first?: BufferSource | string; second?: BufferSource | string }; evalByCredential?: Record<string, { first: BufferSource | string; second?: BufferSource | string }> } })
        | undefined
    const prf = ext?.prf
    if (!prf) return options

    const nextPrf: PrfExtensionInput["prf"] = {}
    if (prf.eval?.first !== undefined) {
        nextPrf.eval = {
            first: decodeEval(prf.eval.first),
            ...(prf.eval.second !== undefined
                ? { second: decodeEval(prf.eval.second) }
                : {}),
        }
    }
    if (prf.evalByCredential) {
        const mapped: Record<string, PrfEvalInput> = {}
        for (const [credId, ev] of Object.entries(prf.evalByCredential)) {
            mapped[credId] = {
                first: decodeEval(ev.first),
                ...(ev.second !== undefined
                    ? { second: decodeEval(ev.second) }
                    : {}),
            }
        }
        nextPrf.evalByCredential = mapped
    }

    return {
        ...options,
        extensions: { ...options.extensions, prf: nextPrf } as PrfExtensionInput,
    } as PublicKeyCredentialRequestOptionsJSON
}
