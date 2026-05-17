// 결제 예정 인스턴스 캘린더 뷰. 단일 모바일 레이아웃이므로 AgendaView 만 사용.
import Link from 'next/link';
import { getOccurrences } from '@/lib/api-client';
import { formatDate, todayIso } from '@/lib/format';
import { AgendaView } from './AgendaView';

export const dynamic = 'force-dynamic';

function monthBounds(today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const from = formatDate(new Date(Date.UTC(y!, m! - 1, 1)));
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const to = formatDate(new Date(Date.UTC(y!, m! - 1, lastDay)));
  return { from, to };
}

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const today = todayIso();
  const monthKey = params.month ?? today.slice(0, 7);
  const [yStr, mStr] = monthKey.split('-');
  const anchor = `${yStr}-${mStr}-15`;
  const { from, to } = monthBounds(anchor);

  let occurrences: Awaited<ReturnType<typeof getOccurrences>> = [];
  let error: string | null = null;
  try {
    occurrences = await getOccurrences({ from, to });
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <section>
      <header className="page-header">
        <h1>캘린더</h1>
        <Link className="btn secondary" href="/occurrences">
          리스트
        </Link>
      </header>
      {error && <div className="error-box">{error}</div>}
      <AgendaView occurrences={occurrences} />
    </section>
  );
}
