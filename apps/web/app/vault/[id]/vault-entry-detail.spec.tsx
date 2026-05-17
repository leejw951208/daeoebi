// VaultEntryDetailPage view↔edit 토글 회귀 테스트. 수정 클릭 → 저장 → view 복귀 흐름을 보호한다.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { VaultEntry } from '@/lib/vault-client';
import { VaultProvider } from '../vault-context';
import VaultEntryDetailPage from './page';

const refresh = jest.fn();
const push = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'entry-1' }),
  useRouter: () => ({ push, refresh, replace: jest.fn(), back: jest.fn(), forward: jest.fn(), prefetch: jest.fn() })
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  )
}));

const getEntryMock = jest.fn();
const deleteEntryMock = jest.fn();
const updateEntryMock = jest.fn();
const createEntryMock = jest.fn();

jest.mock('@/lib/vault-client', () => ({
  getEntry: (...args: unknown[]) => getEntryMock(...args),
  deleteEntry: (...args: unknown[]) => deleteEntryMock(...args),
  updateEntry: (...args: unknown[]) => updateEntryMock(...args),
  createEntry: (...args: unknown[]) => createEntryMock(...args)
}));

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    id: 'entry-1',
    category: 'BANK',
    label: '주거래은행',
    payload: { accountNumber: '110-1234-5678', bankName: '국민은행' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function renderPage() {
  return render(
    <VaultProvider value={{ onLock: jest.fn(), onStatusRefresh: jest.fn() }}>
      <VaultEntryDetailPage />
    </VaultProvider>
  );
}

describe('VaultEntryDetailPage view↔edit 토글', () => {
  beforeEach(() => {
    refresh.mockClear();
    push.mockClear();
    getEntryMock.mockReset();
    deleteEntryMock.mockReset();
    updateEntryMock.mockReset();
    createEntryMock.mockReset();
  });

  it('수정 버튼을 누르면 폼이 열리고, 저장하면 view 로 복귀하며 새 값이 반영된다', async () => {
    getEntryMock
      .mockResolvedValueOnce(makeEntry())
      .mockResolvedValueOnce(makeEntry({ label: '주거래은행 (수정)' }));
    updateEntryMock.mockResolvedValue(makeEntry({ label: '주거래은행 (수정)' }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('주거래은행');
    });

    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeNull();

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '저장' }).closest('form')!);
    });

    expect(updateEntryMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('주거래은행 (수정)');
  });

  it('수정 모드에서 취소를 누르면 폼이 닫히고 view 로 복귀한다', async () => {
    getEntryMock.mockResolvedValue(makeEntry());

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '수정' })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeNull();
    expect(updateEntryMock).not.toHaveBeenCalled();
  });
});
