"use client"
// vault 세그먼트 공통 컨텍스트. 잠금 상태와 idle 카운트다운을 모든 vault 서브라우트에 공유한다.
import { createContext, useContext } from "react"

export interface VaultContextValue {
    idleSecondsRemaining?: number
    onLock: () => void | Promise<void>
    onStatusRefresh: () => Promise<void> | void
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({
    value,
    children,
}: {
    value: VaultContextValue
    children: React.ReactNode
}) {
    return (
        <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
    )
}

export function useVault(): VaultContextValue {
    const ctx = useContext(VaultContext)
    if (!ctx) throw new Error("useVault must be used inside VaultProvider")
    return ctx
}
