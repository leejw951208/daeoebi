"use client"
// vault 세그먼트 공통 컨텍스트. 메모리에만 보관하는 VK·잠그기 같은 "안정값"과,
// 매초 변하는 자동잠금 카운트다운을 분리한다. 카운트다운만 별도 컨텍스트로 두어,
// 매초 갱신이 안정값 소비자(폼·목록·대시보드)를 리렌더하지 않게 한다(LockTimer·IdleWarning 만 갱신).
import { createContext, useContext } from "react"

// 시크릿 본문의 평문 구조. label(제목)만 평문이고 이 구조 전체가 암호화된다.
export interface SecretField {
    name: string
    value: string
    // 상세 화면에서 값을 마스킹할지 여부. 미지정(구버전 데이터)이면 이름 휴리스틱으로 폴백한다.
    sensitive?: boolean
}

export interface SecretPayload {
    fields: SecretField[]
    memo: string
}

export interface VaultContextValue {
    // 메모리 상주 VK. 잠금해제 상태에서만 존재한다.
    vaultKey: CryptoKey
    // 사용자 활동 시 자동잠금 타이머를 초기화한다.
    resetIdle: () => void
    // 수동 잠그기. VK 폐기 + 서버 세션 종료.
    onLock: () => void | Promise<void>
}

// 안정값(매 렌더 동일 참조로 제공). 매초 갱신과 무관해 소비자가 불필요하게 리렌더되지 않는다.
const VaultContext = createContext<VaultContextValue | null>(null)
// 자동잠금까지 남은 초. 매초 변한다 — 잠금 타이머·경고만 구독한다.
const IdleSecondsContext = createContext<number | null>(null)

export function VaultProvider({
    value,
    idleSeconds,
    children,
}: {
    value: VaultContextValue
    idleSeconds: number
    children: React.ReactNode
}) {
    return (
        <VaultContext.Provider value={value}>
            <IdleSecondsContext.Provider value={idleSeconds}>
                {children}
            </IdleSecondsContext.Provider>
        </VaultContext.Provider>
    )
}

export function useVault(): VaultContextValue {
    const ctx = useContext(VaultContext)
    if (!ctx) throw new Error("useVault must be used inside VaultProvider")
    return ctx
}

export function useIdleSeconds(): number {
    const v = useContext(IdleSecondsContext)
    if (v === null)
        throw new Error("useIdleSeconds must be used inside VaultProvider")
    return v
}
