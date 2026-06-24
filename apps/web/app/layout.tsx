// 전역 레이아웃. 단일 모바일 셸 + 데스크탑 phone-frame + PWA 메타 + Pretendard(Ink 테마) 타입.
import type { Metadata, Viewport } from "next"
import { BottomTabBar } from "@/components/BottomTabBar"
import { UpdateToast } from "@/components/UpdateToast"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"
import "./globals.css"

export const metadata: Metadata = {
    title: "대외비",
    description: "패스키로 잠그는 나만의 대외비",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "대외비",
    },
    icons: {
        icon: "/icons/icon-192.png",
        apple: "/icons/icon-192.png",
    },
}

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#ffffff",
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ko">
            <head>
                {/* Pretendard — 본문 한글·영문 페이스. 폴백 system-ui. */}
                <link rel="preconnect" href="https://cdn.jsdelivr.net" />
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
                />
            </head>
            <body>
                <div className="phone-frame">
                    <main className="container">{children}</main>
                    <BottomTabBar />
                    <UpdateToast />
                </div>
                <ServiceWorkerRegister />
            </body>
        </html>
    )
}
