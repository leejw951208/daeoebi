"use client"
// 모바일 하단 탭바. 대외비 라우트로 thumb 영역 네비게이션 제공.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { KeyRound } from "lucide-react"
import { Icon } from "./Icon"

const TABS = [{ href: "/", label: "대외비", icon: KeyRound }] as const

export function BottomTabBar() {
    const pathname = usePathname()
    // 데모 모드에서는 실제 대외비로 가는 탭을 노출하지 않는다(폐쇄적 둘러보기).
    if (pathname.startsWith("/demo")) return null
    return (
        <nav className="bottom-tab-bar" aria-label="모바일 네비게이션">
            {TABS.map((tab) => {
                const isActive = pathname.startsWith(tab.href)
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={tab.label}
                    >
                        <Icon icon={tab.icon} size={22} />
                    </Link>
                )
            })}
        </nav>
    )
}
