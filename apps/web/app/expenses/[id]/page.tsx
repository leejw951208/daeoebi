// 정기 지출 상세 라우트. 서버에서 단건을 fetch 한 뒤 client detail view 에 전달한다.
import { notFound } from 'next/navigation';
import { getExpense } from '@/lib/api-client';
import { ExpenseDetailView } from './ExpenseDetailView';

export const dynamic = 'force-dynamic';

export default async function ExpenseDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const expense = await getExpense(id);
    return <ExpenseDetailView initial={expense} />;
  } catch {
    notFound();
  }
}
