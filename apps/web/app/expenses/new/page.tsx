// 정기 지출 신규 추가 라우트. 빈 폼을 mount 하고 저장 후 /expenses 로 복귀한다.
import { NewExpenseView } from './NewExpenseView';

export const dynamic = 'force-dynamic';

export default function NewExpensePage() {
  return <NewExpenseView />;
}
