// 설치 안내 배너의 dismiss 기간 판정을 회귀 방지한다.
import { shouldShowInstallBanner } from '../../components/install-banner-visibility';

describe('shouldShowInstallBanner', () => {
  const now = 1_000_000;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  it('dismiss 기록이 없으면 표시한다', () => {
    expect(shouldShowInstallBanner({ dismissedAt: 0, now })).toBe(true);
  });

  it('7일 이내에 dismiss 했으면 숨긴다', () => {
    expect(shouldShowInstallBanner({ dismissedAt: now - sevenDaysMs + 1, now })).toBe(false);
  });

  it('7일이 지났으면 다시 표시한다', () => {
    expect(shouldShowInstallBanner({ dismissedAt: now - sevenDaysMs, now })).toBe(true);
  });

  it('standalone 모드이면 표시하지 않는다', () => {
    expect(shouldShowInstallBanner({ dismissedAt: 0, now, standalone: true })).toBe(false);
  });
});
