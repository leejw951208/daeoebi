"use client"
// 온보딩/passkey 등록 화면. passkey 생성 → VK·복구코드 생성 → PRF·복구코드로 래핑 → register/verify → 복구코드 발급.
import { useState } from "react"
import { Button } from "@/components/Button"
import { getRegisterOptions, postRegisterVerify } from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import {
    generateRecoveryCode,
    generateVaultKey,
    randomSalt,
    recoveryVerifier,
    toBase64Url,
    wrapVkWithPrf,
    wrapVkWithRecovery,
} from "@/lib/vault-crypto"
import {
    CeremonyCancelledError,
    PrfUnsupportedError,
    registerPasskey,
    supportsWebAuthn,
} from "@/lib/webauthn"
import { DEV_AUTH, devUnlock } from "@/lib/dev-auth"
import { RecoveryCodeDisplay } from "./RecoveryCodeDisplay"

type Phase = "intro" | "registering" | "recovery"

interface Props {
    onUnlocked: (vaultKey: CryptoKey) => void
}

export function OnboardingScreen({ onUnlocked }: Props) {
    const [phase, setPhase] = useState<Phase>("intro")
    const [error, setError] = useState<string | null>(null)
    // 첫 등록 게이트 토큰. 배포 시 설정한 부트스트랩 토큰을 입력받는다.
    const [token, setToken] = useState<string>("")
    // 등록 완료 후 사용자가 복구코드를 확인할 때까지 VK 와 코드를 보관한다.
    const [pending, setPending] = useState<{
        vaultKey: CryptoKey
        recoveryCode: string
    } | null>(null)

    async function handleRegister() {
        // 비운영: 패스키 대신 dev 우회로 즉시 진입(부트스트랩 토큰·복구코드 단계 생략).
        if (DEV_AUTH) {
            setPhase("registering")
            setError(null)
            try {
                onUnlocked(await devUnlock())
            } catch (e) {
                setPhase("intro")
                setError(resolveError(e))
            }
            return
        }
        if (!supportsWebAuthn()) {
            setError("이 브라우저는 passkey(WebAuthn)를 지원하지 않습니다.")
            return
        }
        const trimmedToken = token.trim()
        if (!trimmedToken) {
            setError("부트스트랩 토큰을 입력하세요.")
            return
        }
        setPhase("registering")
        setError(null)
        try {
            // prfSalt 를 먼저 만들어 등록 세레모니의 PRF eval 로 주입한다(출력은 이 salt 에 묶인다).
            const prfSalt = randomSalt()
            const options = await getRegisterOptions()
            const { response, prfOutput } = await registerPasskey(
                options,
                prfSalt,
            )
            if (!prfOutput) throw new PrfUnsupportedError()

            // VK·복구코드 생성 후 PRF·복구코드로 각각 래핑한다.
            const vaultKey = await generateVaultKey()
            const recovery = generateRecoveryCode()
            const rcSalt = randomSalt()
            const wrappedVkPrf = await wrapVkWithPrf(
                vaultKey,
                prfOutput,
                prfSalt,
            )
            const wrappedVkRc = await wrapVkWithRecovery(
                vaultKey,
                recovery.bytes,
                rcSalt,
            )
            // verifier=SHA-256(복구코드 바이트). 서버가 복구 시 상수시간 비교(H-1).
            const verifier = await recoveryVerifier(recovery.bytes)

            await postRegisterVerify({
                response,
                prfSalt: toBase64Url(prfSalt),
                wrappedVkPrf: toBase64Url(wrappedVkPrf),
                recovery: {
                    rcSalt: toBase64Url(rcSalt),
                    wrappedVkRc: toBase64Url(wrappedVkRc),
                    verifier: toBase64Url(verifier),
                },
                bootstrapToken: trimmedToken,
            })

            setPending({ vaultKey, recoveryCode: recovery.display })
            setPhase("recovery")
        } catch (e) {
            setPhase("intro")
            setError(resolveError(e))
        }
    }

    if (phase === "recovery" && pending) {
        return (
            <RecoveryCodeDisplay
                code={pending.recoveryCode}
                onConfirmed={() => onUnlocked(pending.vaultKey)}
            />
        )
    }

    return (
        <section
            style={{
                maxWidth: 440,
                margin: "0 auto",
                padding: "56px 26px 30px",
                background: "linear-gradient(180deg,#fafafa,#fff)",
                display: "flex",
                flexDirection: "column",
                minHeight: "100dvh",
            }}
        >
            <div
                className="stagger"
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                }}
            >
                <span className="vault-emblem pop" style={{ marginBottom: 30 }}>
                    <div
                        style={{
                            width: 20,
                            height: 24,
                            border: "3px solid #fff",
                            borderTop: "none",
                            borderRadius: 7,
                            position: "relative",
                            marginTop: 6,
                        }}
                    >
                        <span
                            style={{
                                position: "absolute",
                                left: "50%",
                                top: -13,
                                transform: "translateX(-50%)",
                                width: 18,
                                height: 18,
                                border: "3px solid #fff",
                                borderBottom: "none",
                                borderRadius: "9px 9px 0 0",
                            }}
                        />
                    </div>
                </span>
                <span className="eyebrow">대외비</span>
                <h1
                    style={{
                        fontSize: 30,
                        marginTop: 10,
                        lineHeight: 1.25,
                        letterSpacing: "-.03em",
                        textWrap: "balance",
                    }}
                >
                    민감한 정보와 자산을 한 곳에 잠가두고, 필요할 때만 엽니다
                </h1>
                <p
                    className="muted"
                    style={{
                        marginTop: 14,
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "#6b6b6b",
                    }}
                >
                    비밀번호·계좌·카드부터 예산·지출과 저축·투자까지. 패스키
                    하나로만 열리고, 암호화 키는 이 기기를 벗어나지 않습니다.
                </p>
            </div>

            <ul
                style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "26px 0 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 11,
                }}
            >
                <li style={onboardCheckRow}>
                    <span style={onboardCheckMark} aria-hidden="true">
                        ✓
                    </span>
                    생체·기기 인증으로 본인 확인
                </li>
                <li style={onboardCheckRow}>
                    <span style={onboardCheckMark} aria-hidden="true">
                        ✓
                    </span>
                    3분간 미사용 시 자동 재잠금
                </li>
            </ul>

            <div className="form-row" style={{ margin: "0 0 14px" }}>
                <label
                    htmlFor="bootstrap-token"
                    style={{
                        color: "#a0a0a0",
                        letterSpacing: "normal",
                        marginBottom: 7,
                    }}
                >
                    부트스트랩 토큰
                </label>
                <input
                    id="bootstrap-token"
                    type="text"
                    className="field-control"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={phase === "registering"}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-describedby="bootstrap-token-hint"
                    style={{
                        height: 56,
                        minHeight: 56,
                        borderRadius: 14,
                        padding: "0 16px",
                        fontFamily: "ui-monospace,monospace",
                        fontSize: 15,
                        fontWeight: 600,
                        letterSpacing: ".02em",
                        color: "#333",
                    }}
                />
                <p
                    id="bootstrap-token-hint"
                    className="muted"
                    style={{
                        margin: "8px 0 0",
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: "#a0a0a0",
                    }}
                >
                    첫 등록에만 필요합니다. 배포 시 설정한 토큰을 입력하세요.
                </p>
            </div>

            <Button
                variant="primary"
                style={{
                    width: "100%",
                    ...(!token.trim() || phase === "registering"
                        ? { background: "#ececec", color: "#b8b8b8" }
                        : {}),
                }}
                onClick={handleRegister}
                loading={phase === "registering"}
                disabled={!token.trim()}
            >
                패스키 만들기
            </Button>

            {error && (
                <div
                    role="alert"
                    className="error-box"
                    style={{ marginTop: 16 }}
                >
                    {error}
                </div>
            )}

            <div
                className="progress-dots"
                style={{ justifyContent: "center", marginTop: 18 }}
                aria-hidden="true"
            >
                <span className="dot active" />
                <span className="dot" />
            </div>
        </section>
    )
}

// 체크 2줄(보조 안내) 공통 스타일.
const onboardCheckRow: React.CSSProperties = {
    display: "flex",
    gap: 11,
    alignItems: "center",
    fontSize: 13.5,
    color: "#444",
}
const onboardCheckMark: React.CSSProperties = {
    flex: "none",
    width: 16,
    color: "#9a9a9a",
    fontSize: 12,
    fontWeight: 800,
}

// 예외를 사용자에게 보여줄 한국어 메시지로 변환한다.
function resolveError(e: unknown): string {
    if (e instanceof CeremonyCancelledError) return e.message
    if (e instanceof PrfUnsupportedError) return e.message
    if (isApiError(e)) return e.message
    return e instanceof Error ? e.message : "등록에 실패했습니다."
}
