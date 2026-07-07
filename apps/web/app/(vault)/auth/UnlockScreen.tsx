"use client"
// 잠금해제 화면. passkey 로그인으로 PRF→VK 언랩하거나, 복구코드로 VK 확보 후 새 passkey 를 재등록한다.
import { useState } from "react"
import { Button } from "@/components/Button"
import {
    getLoginOptions,
    getRegisterOptions,
    postLoginVerify,
    postRecoveryVerify,
    postRegisterVerify,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import {
    fromBase64Url,
    isValidRecoveryLength,
    parseRecoveryCode,
    randomSalt,
    toBase64Url,
    unwrapVkWithPrf,
    unwrapVkWithRecovery,
    wrapVkWithPrf,
} from "@/lib/vault-crypto"
import {
    CeremonyCancelledError,
    PrfUnsupportedError,
    authenticatePasskey,
    registerPasskey,
    supportsWebAuthn,
} from "@/lib/webauthn"
import { DEV_AUTH, devUnlock } from "@/lib/dev-auth"

type Mode = "passkey" | "recovery"
type Busy = "idle" | "unlocking" | "recovering"

interface Props {
    onUnlocked: (vaultKey: CryptoKey) => void
    onReregistered: (vaultKey: CryptoKey) => void
}

export function UnlockScreen({ onUnlocked, onReregistered }: Props) {
    const [mode, setMode] = useState<Mode>("passkey")
    const [busy, setBusy] = useState<Busy>("idle")
    const [error, setError] = useState<string | null>(null)
    const [retryAfter, setRetryAfter] = useState<number | null>(null)
    // 복구코드를 2열 6칸 세그먼트로 입력받는다. 제출 시 하나로 합쳐 파싱한다.
    const [recoverySegments, setRecoverySegments] = useState<string[]>(() =>
        Array(6).fill(""),
    )

    // passkey 로그인 → PRF 출력으로 wrappedVkPrf 언랩 → VK 확보.
    async function handlePasskeyUnlock() {
        // 비운영: 패스키 대신 dev 우회로 즉시 진입.
        if (DEV_AUTH) {
            setBusy("unlocking")
            setError(null)
            setRetryAfter(null)
            try {
                onUnlocked(await devUnlock())
            } catch (e) {
                handleFailure(e)
                setBusy("idle")
            }
            return
        }
        if (!supportsWebAuthn()) {
            setError("이 브라우저는 passkey(WebAuthn)를 지원하지 않습니다.")
            return
        }
        setBusy("unlocking")
        setError(null)
        setRetryAfter(null)
        try {
            const options = await getLoginOptions()
            const { response, prfOutput } = await authenticatePasskey(options)
            if (!prfOutput) throw new PrfUnsupportedError()

            const { wrappedVkPrf, prfSalt } = await postLoginVerify(response)
            const vaultKey = await unwrapVkWithPrf(
                fromBase64Url(wrappedVkPrf),
                prfOutput,
                fromBase64Url(prfSalt),
            )
            onUnlocked(vaultKey)
        } catch (e) {
            handleFailure(e)
            setBusy("idle")
        }
    }

    // 복구코드 제출(recovery/verify) → wrap 수신 + 복구 세션 → 로컬 언랩 → VK 확보 → 새 passkey 재등록.
    async function handleRecover() {
        // 6칸 세그먼트를 합쳐 전체 복구코드로 복원한다(파서가 구분자·공백을 무시).
        const combinedCode = recoverySegments.join("")
        const recoveryBytes = parseRecoveryCode(combinedCode)
        // L-2. 정확히 160bit(20B)인지 조기 검증해 잘못된 입력을 서버 전송 전에 거른다.
        if (!isValidRecoveryLength(recoveryBytes)) {
            setError(
                "복구코드 형식이 올바르지 않습니다. 32자 코드를 확인하세요.",
            )
            return
        }
        if (!supportsWebAuthn()) {
            setError("이 브라우저는 passkey(WebAuthn)를 지원하지 않습니다.")
            return
        }
        setBusy("recovering")
        setError(null)
        setRetryAfter(null)
        try {
            // 와이어 포맷(interop 확정): 복구코드 문자열을 디코드한 20바이트를 base64url 로 보낸다.
            // 서버는 Base32 를 모르고 base64url 디코드 후 SHA-256→verifier 상수시간 비교(백오프).
            const wrap = await postRecoveryVerify(toBase64Url(recoveryBytes))
            // 받은 wrap 을 로컬에서 복구코드로 언랩(GCM 인증). 여기서 실패하면 데이터 손상이다.
            const vaultKey = await unwrapVkWithRecovery(
                fromBase64Url(wrap.wrappedVkRc),
                recoveryBytes,
                fromBase64Url(wrap.rcSalt),
            )

            // 복구 세션을 가진 상태로 새 passkey 를 등록한다(recovery 재발급 생략).
            // prfSalt 를 먼저 만들어 등록 세레모니의 PRF eval 로 주입한다.
            const prfSalt = randomSalt()
            const options = await getRegisterOptions()
            const { response, prfOutput } = await registerPasskey(
                options,
                prfSalt,
            )
            if (!prfOutput) throw new PrfUnsupportedError()

            const wrappedVkPrf = await wrapVkWithPrf(
                vaultKey,
                prfOutput,
                prfSalt,
            )
            await postRegisterVerify({
                response,
                prfSalt: toBase64Url(prfSalt),
                wrappedVkPrf: toBase64Url(wrappedVkPrf),
            })

            onReregistered(vaultKey)
        } catch (e) {
            handleFailure(e)
            setBusy("idle")
        }
    }

    function handleFailure(e: unknown) {
        if (isApiError(e) && e.code === "RATE_LIMITED") {
            setRetryAfter(e.retryAfterSeconds ?? 60)
            setError(e.message)
            return
        }
        // 복구 모드에서 401=verifier 비교 실패(복구코드 불일치), 404=복구 정보 없음.
        if (mode === "recovery" && isApiError(e)) {
            if (e.status === 401) {
                setError("복구코드가 일치하지 않습니다.")
                return
            }
            if (e.status === 404) {
                setError("등록된 복구 정보가 없습니다.")
                return
            }
        }
        if (e instanceof CeremonyCancelledError) {
            setError(e.message)
            return
        }
        if (e instanceof PrfUnsupportedError) {
            setError(e.message)
            return
        }
        if (isApiError(e)) {
            setError(e.message)
            return
        }
        // 로컬 언랩(GCM) 실패 = 코드는 길이 맞지만 내용 불일치/데이터 손상.
        if (e instanceof Error && e.name === "OperationError") {
            setError("복구코드가 일치하지 않습니다.")
            return
        }
        setError(e instanceof Error ? e.message : "잠금해제에 실패했습니다.")
    }

    // ── passkey 모드: 중앙 링 + 상태별 문구 ──
    if (mode === "passkey") {
        const failed = error !== null
        const ringState =
            busy === "unlocking" ? "authing" : failed ? "fail" : "idle"
        const title =
            busy === "unlocking"
                ? "인증 중…"
                : failed
                  ? "인증에 실패했어요"
                  : "잠겨 있어요"
        const sub =
            busy === "unlocking"
                ? "기기에서 생체 인증을 완료해 주세요."
                : failed
                  ? "다시 시도하거나 복구코드로 접근할 수 있어요."
                  : "패스키로 본인을 확인하고 대외비를 엽니다."

        return (
            <section
                style={{
                    minHeight: "100dvh",
                    padding: "40px 28px",
                    background: "linear-gradient(180deg,#fff,#fafafa)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    }}
                >
                    <div
                        className={`unlock-ring ${ringState}`}
                        role="img"
                        aria-label={title}
                    >
                        {ringState !== "authing" && (
                            <div
                                className={`unlock-dot${failed ? " fail" : ""}`}
                            >
                                {failed ? (
                                    <span
                                        style={{ fontSize: 30, lineHeight: 1 }}
                                    >
                                        !
                                    </span>
                                ) : (
                                    <div
                                        aria-hidden="true"
                                        style={{
                                            width: 22,
                                            height: 26,
                                            border: "3px solid #fff",
                                            borderTop: "none",
                                            borderRadius: 7,
                                            position: "relative",
                                            marginTop: 5,
                                        }}
                                    >
                                        <span
                                            style={{
                                                position: "absolute",
                                                left: "50%",
                                                top: -14,
                                                transform: "translateX(-50%)",
                                                width: 20,
                                                height: 20,
                                                border: "3px solid #fff",
                                                borderBottom: "none",
                                                borderRadius: "10px 10px 0 0",
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <h1 style={{ marginTop: 30 }}>{title}</h1>
                    <p
                        className="muted"
                        style={{
                            marginTop: 8,
                            fontSize: 14,
                            lineHeight: 1.6,
                            maxWidth: 260,
                            color: "#6b6b6b",
                        }}
                    >
                        {sub}
                    </p>
                </div>

                <div style={{ flex: 1 }} aria-hidden="true" />

                {error && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ width: "100%" }}
                    >
                        {error}
                        {retryAfter !== null && (
                            <> {retryAfter}초 후 다시 시도할 수 있습니다.</>
                        )}
                    </div>
                )}

                <Button
                    variant="primary"
                    style={{ width: "100%" }}
                    onClick={handlePasskeyUnlock}
                    loading={busy === "unlocking"}
                    disabled={retryAfter !== null}
                >
                    {failed ? "다시 시도" : "패스키로 잠금해제"}
                </Button>
                <Button
                    variant="text"
                    style={{
                        width: "100%",
                        height: 48,
                        marginTop: 6,
                        justifyContent: "center",
                        color: "#888",
                    }}
                    onClick={() => {
                        setMode("recovery")
                        setError(null)
                        setRetryAfter(null)
                    }}
                    disabled={busy !== "idle"}
                >
                    복구코드로 접근
                </Button>
            </section>
        )
    }

    // ── recovery 모드: 복구코드 입력 ──
    return (
        <section style={{ maxWidth: 440, margin: "0 auto", paddingTop: 24 }}>
            <button
                type="button"
                className="btn-text"
                style={{ marginBottom: 16, marginLeft: -8, color: "#888" }}
                onClick={() => {
                    setMode("passkey")
                    setError(null)
                    setRetryAfter(null)
                }}
                disabled={busy !== "idle"}
            >
                ← 잠금해제로
            </button>
            <h1 style={{ fontSize: 24 }}>복구코드로 접근</h1>
            <p
                className="muted"
                style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}
            >
                발급받은 복구코드를 입력하면 접근을 복구하고 새 패스키를
                등록합니다.
            </p>

            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    if (busy === "idle") void handleRecover()
                }}
                style={{ marginTop: 24 }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        marginBottom: 16,
                    }}
                >
                    {recoverySegments.map((segment, i) => (
                        <input
                            key={i}
                            type="text"
                            aria-label={`복구코드 ${i + 1}번째 칸`}
                            autoComplete="off"
                            autoCapitalize="characters"
                            autoCorrect="off"
                            spellCheck={false}
                            value={segment}
                            onChange={(e) => {
                                const next = [...recoverySegments]
                                next[i] = e.target.value
                                setRecoverySegments(next)
                                setError(null)
                            }}
                            disabled={busy !== "idle"}
                            style={{
                                height: 50,
                                border: "1.5px solid #e3e3e6",
                                borderRadius: 12,
                                background: "#fafafa",
                                textAlign: "center",
                                fontFamily: "ui-monospace,monospace",
                                fontSize: 15,
                                fontWeight: 600,
                                letterSpacing: ".08em",
                                color: "#222",
                                outline: "none",
                            }}
                        />
                    ))}
                </div>
                <p
                    className="muted"
                    style={{ fontSize: 12.5, marginTop: -4, color: "#a0a0a0" }}
                >
                    대소문자 구분 없이 입력하세요. 5회 실패 시 잠시 후 다시
                    시도할 수 있습니다.
                </p>

                {error && (
                    <div role="alert" className="error-box">
                        {error}
                        {retryAfter !== null && (
                            <> {retryAfter}초 후 다시 시도할 수 있습니다.</>
                        )}
                    </div>
                )}

                <Button
                    type="submit"
                    variant="primary"
                    style={{ width: "100%", marginTop: 22 }}
                    loading={busy === "recovering"}
                >
                    검증하고 복구
                </Button>
            </form>
        </section>
    )
}
