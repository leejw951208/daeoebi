"use client"
// 지출 수정 라우트. 지출과 카테고리를 함께 불러와 VK 로 복호화한 뒤 ExpenseForm 에 초기값으로 넘긴다.
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    getExpense,
    listAssetCategories,
    listRecurring,
    type AssetCategory,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { useVault } from "../../_lib/vault-context"
import { openExpense } from "../_lib/asset-payload"
import {
    ExpenseForm,
    type ExpenseFormInitial,
} from "../_components/ExpenseForm"

type State =
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
          status: "ready"
          initial: ExpenseFormInitial
          categories: AssetCategory[]
      }

export default function EditExpensePage() {
    const router = useRouter()
    const params = useParams<{ id: string }>()
    const { vaultKey } = useVault()
    const [state, setState] = useState<State>({ status: "loading" })

    const back = () => {
        router.push("/asset")
        router.refresh()
    }

    useEffect(() => {
        let cancelled = false
        const id = params.id
        Promise.all([getExpense(id), listAssetCategories(), listRecurring()])
            .then(async ([view, categories, templates]) => {
                const payload = await openExpense(vaultKey, view)
                if (cancelled) return
                // 연결된 활성 템플릿(개월 수 표시·앞으로만 반영에 필요). 해제됐으면 목록에 없다.
                const linked =
                    templates.find((t) => t.id === view.recurringId) ?? null
                setState({
                    status: "ready",
                    categories,
                    initial: {
                        id: view.id,
                        date: view.date,
                        recurringId: view.recurringId,
                        period: view.period,
                        template:
                            linked === null
                                ? null
                                : {
                                      id: linked.id,
                                      startMonth: linked.startMonth,
                                      termMonths: linked.termMonths,
                                  },
                        categoryId: view.categoryId,
                        payload,
                    },
                })
            })
            .catch((e) => {
                if (cancelled) return
                setState({
                    status: "error",
                    message: isApiError(e) ? e.message : "불러오지 못했습니다.",
                })
            })
        return () => {
            cancelled = true
        }
    }, [params.id, vaultKey])

    if (state.status === "loading") {
        return (
            <section>
                <p className="muted" style={{ padding: 24 }}>
                    불러오는 중입니다.
                </p>
            </section>
        )
    }

    if (state.status === "error") {
        return (
            <section style={{ padding: 24 }}>
                <div role="alert" className="error-box">
                    {state.message}
                </div>
                <button
                    type="button"
                    className="btn secondary"
                    style={{ marginTop: 12 }}
                    onClick={back}
                >
                    자산으로
                </button>
            </section>
        )
    }

    return (
        <ExpenseForm
            categories={state.categories}
            initial={state.initial}
            onSaved={back}
            onCancel={back}
            onDeleted={back}
        />
    )
}
