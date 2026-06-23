"use client"
// vault 세그먼트 레이아웃. 잠금 상태와 idle 카운트다운을 모든 vault 서브라우트에 공유한다.
import { useCallback, useEffect, useState } from "react"
import {
    getStatus,
    lockVault,
    type VaultStatusView,
} from "@/lib/vault-client"
import { UnlockScreen } from "./UnlockScreen"
import { VaultProvider } from "./vault-context"

export default function VaultLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [view, setView] = useState<VaultStatusView>({ state: "loading" })

    const refresh = useCallback(async () => {
        try {
            const next = await getStatus()
            setView(next)
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

    // unlocked 상태일 때 1초 간격으로 idle 카운트다운을 갱신한다.
    // 첫 tick 까지의 1초 지연은 의도된 것이다. server 의 idleSecondsRemaining 은 fetch 시점 기준이므로
    // mount 직후 1초 동안 같은 값을 표시하는 게 실제 경과 시간과 일치한다.
    useEffect(() => {
        if (view.state !== "unlocked") return
        const id = setInterval(() => {
            setView((prev) => {
                if (
                    prev.state !== "unlocked" ||
                    typeof prev.idleSecondsRemaining !== "number"
                )
                    return prev
                const remaining = prev.idleSecondsRemaining - 1
                if (remaining <= 0) {
                    void refresh()
                    return prev
                }
                return { ...prev, idleSecondsRemaining: remaining }
            })
        }, 1000)
        return () => clearInterval(id)
    }, [view.state, refresh])

    const handleLock = useCallback(async () => {
        try {
            await lockVault()
        } finally {
            await refresh()
        }
    }, [refresh])

    if (view.state === "loading" || view.state === "error") {
        return (
            <section>
                <h1>비밀번호 보관함</h1>
                {view.state === "error" ? (
                    <div className="error-box">{view.message}</div>
                ) : (
                    <p className="muted">상태를 확인하고 있습니다.</p>
                )}
            </section>
        )
    }

    if (view.state === "setup-required" || view.state === "locked") {
        return (
            <UnlockScreen
                mode={view.state === "setup-required" ? "setup" : "unlock"}
                onSuccess={refresh}
            />
        )
    }

    return (
        <VaultProvider
            value={{
                idleSecondsRemaining: view.idleSecondsRemaining,
                onLock: handleLock,
                onStatusRefresh: refresh,
            }}
        >
            {children}
        </VaultProvider>
    )
}
