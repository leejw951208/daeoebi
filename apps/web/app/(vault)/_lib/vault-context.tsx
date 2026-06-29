"use client"
// vault 세그먼트 공통 컨텍스트. 메모리에만 보관하는 VK 와 자동잠금 카운트다운을 서브라우트에 공유한다.
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
    // 자동잠금까지 남은 초.
    idleSecondsRemaining: number
    // 사용자 활동 시 자동잠금 타이머를 초기화한다.
    resetIdle: () => void
    // 수동 잠그기. VK 폐기 + 서버 세션 종료.
    onLock: () => void | Promise<void>
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
