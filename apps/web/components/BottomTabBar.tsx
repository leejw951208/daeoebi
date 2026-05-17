'use client';
// 모바일 하단 탭바. 5개 라우트로 thumb 영역 네비게이션 제공.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, Calendar, BarChart3, KeyRound } from 'lucide-react';
import { Icon } from './Icon';

const TABS = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/expenses', label: '정기 지출', icon: Receipt },
  { href: '/calendar', label: '캘린더', icon: Calendar },
  { href: '/summary', label: '합계', icon: BarChart3 },
  { href: '/vault', label: '보관함', icon: KeyRound }
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav className="bottom-tab-bar" aria-label="모바일 네비게이션">
      {TABS.map((tab) => {
        const isActive =
          tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon icon={tab.icon} size={22} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
