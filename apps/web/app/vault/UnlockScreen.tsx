"use client"
// 마스터 설정·잠금해제 화면. mode 에 따라 setup/unlock 동작을 분기한다.
import { FormEvent, useState } from "react"
import { setupMaster, unlockMaster } from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"

type ScreenState = "idle" | "typing" | "verifying" | "failed" | "rate-limited"

interface Props {
    mode: "setup" | "unlock"
    onSuccess: () => void | Promise<void>
}

export function UnlockScreen({ mode, onSuccess }: Props) {
    const [master, setMaster] = useState("")
    const [confirm, setConfirm] = useState("")
    const [state, setState] = useState<ScreenState>("idle")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [retryAfter, setRetryAfter] = useState<number | null>(null)

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (state === "verifying" || state === "rate-limited") return

        if (mode === "setup") {
            if (master.length < 8) {
                setState("failed")
                setErrorMessage("마스터는 최소 8자 이상이어야 합니다.")
                return
            }
            if (master !== confirm) {
                setState("failed")
                setErrorMessage("두 입력이 일치하지 않습니다.")
                return
            }
        }

        setState("verifying")
        setErrorMessage(null)
        try {
            if (mode === "setup") {
                await setupMaster(master)
            } else {
                await unlockMaster(master)
            }
            setMaster("")
            setConfirm("")
            setState("idle")
            await onSuccess()
        } catch (e) {
            if (isApiError(e) && e.code === "RATE_LIMITED") {
                setState("rate-limited")
                setRetryAfter(e.retryAfterSeconds ?? 60)
            } else {
                setState("failed")
            }
            setErrorMessage(
                e instanceof Error ? e.message : "알 수 없는 오류",
            )
        }
    }

    return (
        <section style={{ maxWidth: 480, margin: "0 auto" }}>
            <h1>
                {mode === "setup"
                    ? "마스터 패스워드 설정"
                    : "비밀번호 보관함 잠금해제"}
            </h1>
            <p className="muted">
                {mode === "setup"
                    ? "보관함 전체를 보호할 마스터 패스워드를 설정합니다. 최소 8자."
                    : "마스터 패스워드를 입력해 보관함을 잠금해제합니다."}
            </p>

            <form onSubmit={handleSubmit} aria-busy={state === "verifying"}>
                <label htmlFor="master">마스터 패스워드</label>
                <input
                    id="master"
                    type="password"
                    className="field-control"
                    autoComplete="current-password"
                    value={master}
                    onChange={(e) => {
                        setMaster(e.target.value)
                        setState("typing")
                        setErrorMessage(null)
                    }}
                    minLength={8}
                    maxLength={256}
                    required
                    disabled={state === "verifying" || state === "rate-limited"}
                    aria-invalid={state === "failed"}
                    aria-describedby={errorMessage ? "master-error" : undefined}
                />

                {mode === "setup" && (
                    <>
                        <label htmlFor="confirm">마스터 패스워드 확인</label>
                        <input
                            id="confirm"
                            type="password"
                            className="field-control"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => {
                                setConfirm(e.target.value)
                                setState("typing")
                            }}
                            required
                            disabled={state === "verifying"}
                        />
                    </>
                )}

                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                    <button
                        type="submit"
                        className="btn"
                        disabled={
                            state === "verifying" || state === "rate-limited"
                        }
                    >
                        {state === "verifying"
                            ? "확인 중..."
                            : mode === "setup"
                              ? "설정"
                              : "잠금해제"}
                    </button>
                </div>

                {errorMessage && (
                    <div
                        id="master-error"
                        role="alert"
                        className="error-box"
                        style={{ marginTop: 12 }}
                    >
                        {errorMessage}
                        {state === "rate-limited" && retryAfter !== null && (
                            <> {retryAfter}초 후 다시 시도할 수 있습니다.</>
                        )}
                    </div>
                )}
            </form>

            {mode === "setup" && (
                <p className="muted" style={{ marginTop: 16 }}>
                    마스터 패스워드는 분실 시 복구할 수 없습니다. 안전한 위치에
                    백업하세요.
                </p>
            )}
        </section>
    )
}
