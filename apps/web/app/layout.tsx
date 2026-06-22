// 전역 레이아웃. 단일 모바일 셸 + 데스크탑 phone-frame + PWA 메타.
import type { Metadata, Viewport } from "next"
import { BottomTabBar } from "@/components/BottomTabBar"
import { UpdateToast } from "@/components/UpdateToast"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"
import "./globals.css"

export const metadata: Metadata = {
    title: "Secrets Manager — 정기 지출 관리",
    description: "로컬 1인용 정기 지출 관리",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Secrets Manager",
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
    themeColor: "#2c5fef",
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ko">
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
