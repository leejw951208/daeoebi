// vault 전용 API 클라이언트. 모든 쓰기 요청에 X-Vault-Request 헤더를 자동 부착한다.
import axios, { AxiosError, AxiosInstance } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000';

export const vaultClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  withCredentials: true,
  headers: {
    'X-Vault-Request': '1'
  }
});

vaultClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string | string[]; code?: string; retryAfterSeconds?: number }>) => {
    const payload = error.response?.data;
    const status = error.response?.status;
    let message = '요청 처리에 실패했습니다.';
    if (payload?.message) {
      message = Array.isArray(payload.message) ? payload.message.join(' / ') : payload.message;
    } else if (error.message) {
      message = `백엔드 통신 실패. ${error.message}`;
    }
    const enriched = new Error(message) as Error & { code?: string; status?: number; retryAfterSeconds?: number };
    enriched.code = payload?.code;
    enriched.status = status;
    enriched.retryAfterSeconds = payload?.retryAfterSeconds;
    return Promise.reject(enriched);
  }
);

export type VaultCategory = 'BANK' | 'CARD' | 'SECURITIES' | 'SHOPPING' | 'OTHER';

export type VaultStatus =
  | { state: 'setup-required' }
  | { state: 'locked' }
  | { state: 'unlocked'; idleSecondsRemaining?: number };

export interface VaultEntry {
  id: string;
  category: VaultCategory;
  label: string;
  createdAt: string;
  updatedAt: string;
  payload?: Record<string, unknown>;
}

export interface CreateEntryInput extends Record<string, unknown> {
  category: VaultCategory;
  label: string;
}

export async function getStatus(): Promise<VaultStatus> {
  const { data } = await vaultClient.get<VaultStatus>('/vault/status');
  return data;
}

export async function setupMaster(master: string): Promise<void> {
  await vaultClient.post('/vault/setup', { master });
}

export async function unlockMaster(master: string): Promise<void> {
  await vaultClient.post('/vault/unlock', { master });
}

export async function lockVault(): Promise<void> {
  await vaultClient.post('/vault/lock');
}

export async function listEntries(params: { category?: VaultCategory; q?: string } = {}): Promise<VaultEntry[]> {
  const { data } = await vaultClient.get<VaultEntry[]>('/vault/entries', { params });
  return data;
}

export async function getEntry(id: string): Promise<VaultEntry> {
  const { data } = await vaultClient.get<VaultEntry>(`/vault/entries/${id}`);
  return data;
}

export async function createEntry(input: CreateEntryInput): Promise<VaultEntry> {
  const { data } = await vaultClient.post<VaultEntry>('/vault/entries', input);
  return data;
}

export async function updateEntry(id: string, input: CreateEntryInput): Promise<VaultEntry> {
  const { data } = await vaultClient.patch<VaultEntry>(`/vault/entries/${id}`, input);
  return data;
}

export async function deleteEntry(id: string): Promise<void> {
  await vaultClient.delete(`/vault/entries/${id}`);
}

export async function exportVault(): Promise<Blob> {
  const { data } = await vaultClient.post<Blob>('/vault/export', undefined, { responseType: 'blob' });
  return data;
}

export async function importVault(
  containerBase64: string,
  master: string,
  mode: 'reject' | 'skip' | 'replace' = 'reject'
): Promise<{ imported: number; skipped: number; replaced: number }> {
  const { data } = await vaultClient.post('/vault/import', { container: containerBase64, master }, { params: { mode } });
  return data;
}

export async function rekeyVault(
  currentMaster: string,
  newMaster?: string,
  newKdfVersion?: number
): Promise<{ rotated: number; kdfVersion: number }> {
  const { data } = await vaultClient.post('/vault/rekey', {
    currentMaster,
    ...(newMaster !== undefined ? { newMaster } : {}),
    ...(newKdfVersion !== undefined ? { newKdfVersion } : {})
  });
  return data;
}
