// vault 세그먼트 레이아웃. 서버 컴포넌트로 두고, 인증·잠금 상태 머신은
// 클라이언트 게이트(VaultGate)에 위임해 클라이언트 경계를 잎으로 좁힌다.
import { VaultGate } from "./_components/VaultGate"

export default function VaultLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <VaultGate>{children}</VaultGate>
}
