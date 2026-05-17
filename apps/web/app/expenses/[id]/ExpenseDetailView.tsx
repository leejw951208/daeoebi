'use client';
// 정기 지출 상세 화면. 기본/스케줄/결제/액션 4섹션 카드. view ↔ edit 같은 라우트 안 토글.
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteExpense, updateExpense } from '@/lib/api-client';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/format';
import type { RecurringExpense } from '@/lib/types';
import { DOW_LABELS, RECURRENCE_LABELS, expenseToForm } from '../expense-form-state';
import { ExpenseForm } from '../ExpenseForm';

function dayLabel(it: RecurringExpense): string {
  if (it.recurrence === 'WEEKLY') return DOW_LABELS[it.dayOfWeek ?? 0] ?? '';
  if (it.recurrence === 'YEARLY') return `${it.monthOfYear}월 ${it.dayOfMonth}일`;
  return `${it.dayOfMonth}일`;
}

export function ExpenseDetailView({ initial }: { initial: RecurringExpense }) {
  const router = useRouter();
  const [item, setItem] = useState<RecurringExpense>(initial);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    setConfirmDelete(false);
    setError(null);
    try {
      await deleteExpense(item.id);
      router.push('/expenses');
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1>{item.name}</h1>
        <Link className="btn secondary" href="/expenses">
          ← 목록
        </Link>
      </header>

      {error && <div role="alert" className="error-box">{error}</div>}

      {mode === 'view' ? (
        <>
          <section className="card" style={{ marginTop: 16 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>기본 정보</h2>
            <dl style={{ display: 'grid', gap: 8, margin: 0 }}>
              <DetailRow label="이름" value={item.name} />
              <DetailRow label="카테고리" value={item.category} />
              <DetailRow label="예상 금액" value={formatCurrency(item.amount, item.currency)} />
              <DetailRow label="통화" value={item.currency} />
            </dl>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>스케줄</h2>
            <dl style={{ display: 'grid', gap: 8, margin: 0 }}>
              <DetailRow label="주기" value={RECURRENCE_LABELS[item.recurrence] ?? item.recurrence} />
              <DetailRow label="결제일" value={dayLabel(item)} />
              <DetailRow label="시작일" value={formatDate(item.startDate)} />
              <DetailRow label="종료일" value={item.endDate ? formatDate(item.endDate) : '-'} />
            </dl>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>결제</h2>
            <dl style={{ display: 'grid', gap: 8, margin: 0 }}>
              <DetailRow label="결제 수단" value={item.paymentMethod ?? '-'} />
              <DetailRow label="메모" value={item.memo ?? '-'} />
            </dl>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>액션</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => setMode('edit')}>
                수정
              </button>
              <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
                삭제
              </button>
            </div>
          </section>
        </>
      ) : (
        <div style={{ marginTop: 16 }}>
          <ExpenseForm
            initial={expenseToForm(item)}
            submitLabel="저장"
            onSubmit={async (payload) => {
              const updated = await updateExpense(item.id, payload);
              setItem(updated);
              setMode('view');
              startTransition(() => router.refresh());
            }}
            onCancel={() => setMode('view')}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="정기 지출 삭제"
        message="이 정기 지출을 삭제할까요? 미래 SCHEDULED 인스턴스가 제거됩니다."
        confirmLabel="삭제"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
      <dt className="muted" style={{ minWidth: 96 }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: 500, wordBreak: 'break-word' }}>{value}</dd>
    </div>
  );
}
