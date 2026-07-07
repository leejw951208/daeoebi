"use client"
// 모바일 하단 탭바. 보관함·자산 두 영역을 thumb 네비게이션으로 전환한다.
import Link from "next/link"
import { usePathname } from "next/navigation"

// 디자인 프로토타입의 인라인 SVG 아이콘(돋보기+열쇠형 / 카드)을 그대로 사용한다.
function VaultIcon() {
    return (
        <svg
            width={23}
            height={23}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="8" cy="8" r="5.5" />
            <path d="M11.8 11.8 19 19" />
            <path d="M16.5 19l2-2" />
            <path d="M14 16.5l2-2" />
        </svg>
    )
}

function AssetIcon() {
    return (
        <svg
            width={23}
            height={23}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
            <circle cx="12" cy="12" r="2.6" />
        </svg>
    )
}

const TABS = [
    {
        href: "/",
        label: "보관함",
        Icon: VaultIcon,
        // 자산 영역이 아니면 보관함이 활성(목록·상세·신규·백업 등 모두 보관함 소속).
        isActive: (pathname: string) => !pathname.startsWith("/asset"),
    },
    {
        href: "/asset",
        label: "자산",
        Icon: AssetIcon,
        isActive: (pathname: string) => pathname.startsWith("/asset"),
    },
] as const

export function BottomTabBar() {
    const pathname = usePathname()
    // 디자인상 하단 탭바는 목록(보관함)·자산 대시보드에만 노출한다. 상세·폼·백업·지출 등
    // 서브 화면은 자체 헤더(취소/저장·← 뒤로)를 가진 풀스크린이라 탭바를 감춘다.
    const showTabBar = pathname === "/" || pathname === "/asset"
    if (!showTabBar) return null
    return (
        <nav className="bottom-tab-bar" aria-label="모바일 네비게이션">
            {TABS.map((tab) => {
                const active = tab.isActive(pathname)
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                        aria-label={tab.label}
                    >
                        <tab.Icon />
                        <span>{tab.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}
