// vault entries 목록 라우트. 잠금 상태는 layout 이 처리하므로 본 페이지는 unlocked 경로만 다룬다.
import { cookies } from "next/headers"
import { InstallBanner } from "@/components/InstallBanner"
import { INSTALL_BANNER_DISMISS_COOKIE } from "@/components/install-banner-visibility"
import { EntriesScreen } from "./_components/EntriesScreen"

export const dynamic = "force-dynamic"

export default async function VaultPage() {
    const cookieStore = await cookies()
    const dismissedAt = Number(
        cookieStore.get(INSTALL_BANNER_DISMISS_COOKIE)?.value ?? 0,
    )

    return (
        <>
            <InstallBanner dismissedAt={dismissedAt} />
            <EntriesScreen />
        </>
    )
}
