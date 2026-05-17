// 결제 인스턴스 리스트 페이지. 기본 30일 범위와 URL 필터로 조회한다.
import Link from 'next/link';
import { addDaysIso, todayIso } from '@/lib/format';
import { getOccurrences, type ListOccurrencesParams } from '@/lib/api-client';
import { OccurrencesView } from './OccurrencesView';

export const dynamic = 'force-dynamic';

type SearchParams = {
  from?: string;
  to?: string;
  status?: string;
  category?: string;
  paymentMethod?: string;
};

const STATUS_VALUES = new Set(['SCHEDULED', 'PAID', 'SKIPPED']);

function normalizeParams(search: SearchParams): Required<Pick<ListOccurrencesParams, 'from' | 'to'>> & ListOccurrencesParams {
  const today = todayIso();
  const params: ListOccurrencesParams = {
    from: search.from || today,
    to: search.to || addDaysIso(today, 30)
  };

  if (search.status && STATUS_VALUES.has(search.status)) params.status = search.status;
  if (search.category) params.category = search.category;
  if (search.paymentMethod) params.paymentMethod = search.paymentMethod;

  return params as Required<Pick<ListOccurrencesParams, 'from' | 'to'>> & ListOccurrencesParams;
}

export default async function OccurrencesPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = normalizeParams(await searchParams);
  const optionParams = { from: params.from, to: params.to };

  let occurrences: Awaited<ReturnType<typeof getOccurrences>> = [];
  let optionOccurrences: Awaited<ReturnType<typeof getOccurrences>> = [];
  let error: string | null = null;

  try {
    [occurrences, optionOccurrences] = await Promise.all([
      getOccurrences(params),
      getOccurrences(optionParams)
    ]);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <section>
      <header className="page-header">
        <h1>결제 리스트</h1>
        <Link className="btn secondary" href="/calendar">
          캘린더
        </Link>
      </header>
      {error && <div className="error-box">{error}</div>}
      <OccurrencesView
        occurrences={occurrences}
        optionOccurrences={optionOccurrences}
        filters={params}
      />
    </section>
  );
}
