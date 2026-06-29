"use client"
// 지출 신규 추가 라우트. ExpenseForm 을 빈 상태로 mount 한다.
import { useRouter } from "next/navigation"
import { ExpenseForm } from "../_components/ExpenseForm"

export default function NewExpensePage() {
    const router = useRouter()
    const back = () => {
        router.push("/asset")
        router.refresh()
    }
    return (
        <ExpenseForm
            initial={null}
            onSaved={back}
            onCancel={back}
            onDeleted={back}
        />
    )
}
