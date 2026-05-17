'use client';
// 정기 지출 신규 폼 화면. 저장 성공 시 router.push + refresh 로 목록을 갱신한다.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createExpense } from '@/lib/api-client';
import { ExpenseForm } from '../ExpenseForm';

export function NewExpenseView() {
  const router = useRouter();

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1>새 정기 지출</h1>
        <Link className="btn secondary" href="/expenses">
          ← 목록
        </Link>
      </header>

      <ExpenseForm
        submitLabel="추가"
        onSubmit={async (payload) => {
          await createExpense(payload);
          router.push('/expenses');
          router.refresh();
        }}
        onCancel={() => router.push('/expenses')}
      />
    </section>
  );
}
