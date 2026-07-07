"use client"
// vault 세그먼트의 인증·잠금 상태 머신. status → 온보딩/잠금해제/잠금해제됨을 분기한다.
// VK 는 이 컴포넌트의 메모리 state 로만 보관하며 새로고침·탭종료 시 자동 폐기된다.
// 레이아웃(layout.tsx)은 서버 컴포넌트로 두고, 클라이언트 경계는 이 게이트로 좁힌다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getAuthStatus, postLogout, type AuthStatus } from "@/lib/vault-client"
import { OnboardingScreen } from "../auth/OnboardingScreen"
import { UnlockScreen } from "../auth/UnlockScreen"
import { VaultProvider, type VaultContextValue } from "../_lib/vault-context"

type View =
    | { state: "loading" }
    | { state: "error"; message: string }
    | { state: "onboarding" }
    | { state: "locked" }
    | { state: "unlocked"; vaultKey: CryptoKey }

// 자동잠금까지의 idle 시간(초). 프로토타입 autoLockSeconds 기본값과 동일한 3분.
const IDLE_LIMIT_SECONDS = 3 * 60

export function VaultGate({ children }: { children: React.ReactNode }) {
    const [view, setView] = useState<View>({ state: "loading" })
    const [idleRemaining, setIdleRemaining] = useState(IDLE_LIMIT_SECONDS)
    // 잠금 콜백이 최신 상태를 참조하도록 ref 로 보관한다.
    const lockRef = useRef<() => Promise<void>>(async () => undefined)

    const refresh = useCallback(async () => {
        try {
            const status: AuthStatus = await getAuthStatus()
            // VK 가 메모리에 없으면 등록 여부에 따라 온보딩/잠금해제로 보낸다.
            setView((prev) => {
                if (prev.state === "unlocked") return prev
                return status.registered
                    ? { state: "locked" }
                    : { state: "onboarding" }
            })
        } catch (e) {
            setView({
                state: "error",
                message: e instanceof Error ? e.message : "알 수 없는 오류",
            })
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    // 인증 전 화면(로딩·에러·온보딩·잠금)은 풀스크린 챙으로 노출한다 — 하단 탭바는
    // 잠긴 화면으로만 이어져 노출할 이유가 없고, 디자인에도 없다. root 의 data-auth-screen
    // 을 CSS 훅으로 써서 탭바·컨테이너 패딩을 걷어낸다. unlocked 에서만 앱 챙을 복원한다.
    useEffect(() => {
        const root = document.documentElement
        if (view.state !== "unlocked") root.setAttribute("data-auth-screen", "")
        else root.removeAttribute("data-auth-screen")
        return () => root.removeAttribute("data-auth-screen")
    }, [view.state])

    // VK 확보 시 잠금해제 상태로 전환하고 idle 타이머를 초기화한다.
    const handleUnlocked = useCallback((vaultKey: CryptoKey) => {
        setView({ state: "unlocked", vaultKey })
        setIdleRemaining(IDLE_LIMIT_SECONDS)
    }, [])

    // 잠그기: VK 폐기 + 서버 세션 종료 후 잠금해제 화면으로.
    const handleLock = useCallback(async () => {
        try {
            await postLogout()
        } catch {
            // 세션 종료 실패해도 클라이언트 VK 는 폐기한다.
        } finally {
            setView({ state: "locked" })
            setIdleRemaining(IDLE_LIMIT_SECONDS)
        }
    }, [])

    lockRef.current = handleLock

    const resetIdle = useCallback(() => {
        setIdleRemaining(IDLE_LIMIT_SECONDS)
    }, [])

    // unlocked 동안 1초 간격으로 idle 카운트다운. 0 도달 시 자동잠금.
    useEffect(() => {
        if (view.state !== "unlocked") return
        const id = setInterval(() => {
            setIdleRemaining((prev) => {
                if (prev <= 1) {
                    void lockRef.current()
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(id)
    }, [view.state])

    // 안정값은 메모이즈해 매초 idle 갱신 시에도 동일 참조를 유지한다 —
    // useVault() 소비자(폼·목록·대시보드)가 카운트다운 때문에 리렌더되지 않게 한다.
    const vaultKey = view.state === "unlocked" ? view.vaultKey : null
    const vaultValue = useMemo<VaultContextValue | null>(
        () => (vaultKey ? { vaultKey, resetIdle, onLock: handleLock } : null),
        [vaultKey, resetIdle, handleLock],
    )

    if (view.state === "loading" || view.state === "error") {
        return (
            <section
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    minHeight: "70vh",
                    gap: 12,
                }}
            >
                <span className="vault-emblem" aria-hidden="true" />
                <h1>대외비</h1>
                {view.state === "error" ? (
                    <div role="alert" className="error-box">
                        {view.message}
                    </div>
                ) : (
                    <p className="muted">상태를 확인하고 있습니다.</p>
                )}
            </section>
        )
    }

    if (view.state === "onboarding") {
        return <OnboardingScreen onUnlocked={handleUnlocked} />
    }

    if (view.state === "locked") {
        return (
            <UnlockScreen
                onUnlocked={handleUnlocked}
                onReregistered={handleUnlocked}
            />
        )
    }

    // unlocked 분기에서는 항상 non-null 이다(타입 좁히기용 가드).
    if (!vaultValue) return null

    return (
        <VaultProvider value={vaultValue} idleSeconds={idleRemaining}>
            {children}
        </VaultProvider>
    )
}
