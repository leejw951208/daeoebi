// 대시보드. 이번 달 합계, 다음 7일 예정, 이번 달 미완료 수를 카드로 보여준다.
import Link from 'next/link';
import { getExpenses, getOccurrences } from '@/lib/api-client';
import { formatCurrency, formatDate, todayIso, addDaysIso } from '@/lib/format';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ResponsiveTable';

export const dynamic = 'force-dynamic';

function monthRange(today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const from = `${String(y!).padStart(4, '0')}-${String(m!).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const to = `${String(y!).padStart(4, '0')}-${String(m!).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

type Occurrence = Awaited<ReturnType<typeof getOccurrences>>[number];

const UPCOMING_COLUMNS: ResponsiveColumn<Occurrence>[] = [
  { key: 'date', header: '날짜', render: (o) => formatDate(o.dueDate) },
  { key: 'name', header: '이름', render: (o) => o.expense.name, primary: true },
  { key: 'category', header: '카테고리', render: (o) => o.expense.category },
  {
    key: 'expected',
    header: '예상',
    align: 'right',
    render: (o) => formatCurrency(o.expectedAmount, o.expense.currency)
  },
  { key: 'method', header: '결제수단', render: (o) => o.expense.paymentMethod ?? '-' }
];

export default async function DashboardPage() {
  const today = todayIso();
  const { from: monthFrom, to: monthTo } = monthRange(today);
  const next7 = addDaysIso(today, 7);

  let monthly: Occurrence[] = [];
  let upcoming: Occurrence[] = [];
  let expensesCount = 0;
  let error: string | null = null;

  try {
    [monthly, upcoming, expensesCount] = await Promise.all([
      getOccurrences({ from: monthFrom, to: monthTo }),
      getOccurrences({ from: today, to: next7, status: 'SCHEDULED' }),
      getExpenses().then((rows) => rows.length)
    ]);
  } catch (e) {
    error = (e as Error).message;
  }

  const monthlyTotal = monthly.reduce(
    (sum, o) => sum + (o.actualAmount ?? o.expectedAmount),
    0
  );
  const unpaidCount = monthly.filter((o) => o.status === 'SCHEDULED').length;

  return (
    <section>
      <h1>대시보드</h1>
      {error && <div className="error-box">{error}</div>}

      <div className="grid cards">
        <div className="card">
          <div className="muted">이번 달 예상 합계</div>
          <div className="amount large">{formatCurrency(monthlyTotal)}</div>
          <div className="muted">{monthFrom} ~ {monthTo}</div>
        </div>
        <div className="card">
          <div className="muted">다음 7일 예정</div>
          <div className="amount large">{upcoming.length}건</div>
          <div className="muted">{today} ~ {next7}</div>
        </div>
        <div className="card">
          <div className="muted">이번 달 미완료</div>
          <div className="amount large">{unpaidCount}건</div>
          <div className="muted">SCHEDULED 상태</div>
        </div>
        <div className="card">
          <div className="muted">등록된 정기 지출</div>
          <div className="amount large">{expensesCount}건</div>
          <Link href="/expenses">관리 →</Link>
        </div>
      </div>

      <h2 className="section-title">다음 7일 예정</h2>
      {upcoming.length === 0 ? (
        <div className="empty">
          예정된 결제가 없습니다.
          <div style={{ marginTop: 8 }}>
            <Link className="btn" href="/expenses">정기 지출 추가</Link>
          </div>
        </div>
      ) : (
        <ResponsiveTable
          rows={upcoming}
          columns={UPCOMING_COLUMNS}
          rowKey={(o) => o.id}
        />
      )}
    </section>
  );
}
