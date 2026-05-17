// vault 메인 페이지. 상태 분기와 unlock/setup/list 화면을 한 컴포넌트가 라우팅한다.
import { InstallBanner } from '@/components/InstallBanner';
import { INSTALL_BANNER_DISMISS_COOKIE } from '@/components/install-banner-visibility';
import { cookies } from 'next/headers';
import { VaultView } from './VaultView';

export const dynamic = 'force-dynamic';

export default async function VaultPage() {
  const cookieStore = await cookies();
  const dismissedAt = Number(cookieStore.get(INSTALL_BANNER_DISMISS_COOKIE)?.value ?? 0);

  return (
    <>
      <InstallBanner dismissedAt={dismissedAt} />
      <VaultView />
    </>
  );
}
