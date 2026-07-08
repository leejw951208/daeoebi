// vault entries 목록 라우트. 잠금 상태는 layout 이 처리하므로 본 페이지는 unlocked 경로만 다룬다.
import { EntriesScreen } from "./_components/EntriesScreen"

export const dynamic = "force-dynamic"

export default function VaultPage() {
    // 디자인 mock 파리티: 목록 화면에는 설치 안내 배너가 없다.
    return <EntriesScreen />
}
