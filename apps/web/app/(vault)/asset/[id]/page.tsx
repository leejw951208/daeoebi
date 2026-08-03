"use client"
// 지출 수정 라우트. 지출과 카테고리를 함께 불러와 VK 로 복호화한 뒤 ExpenseForm 에 초기값으로 넘긴다.
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    getExpense,
    getRecurring,
    listAssetCategories,
    listRecurring,
    listSavingsAccounts,
    type AssetCategory,
    type RecurringView,
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
          savingsAccounts: string[]
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
        Promise.all([
            getExpense(id),
            listAssetCategories(),
            listRecurring(),
            listSavingsAccounts(),
        ])
            .then(async ([view, categories, templates, accounts]) => {
                const payload = await openExpense(vaultKey, view)
                // 연결된 템플릿. 고정 해제된 템플릿은 listRecurring() 에 없어 단건으로 더 읽는다 —
                // 종료월 ↔ 개월 수 환산에 startMonth 가 필요한데 그 값은 템플릿에만 있다.
                // 이 조회만 따로 감싼다. 실패를 바깥 .catch 로 흘리면 서버의 일반 문구
                // "고정 지출을 찾을 수 없습니다"가 떠서, 지출을 열려던 사용자에게 원인을
                // 오도한다. template: null 로 조용히 넘기지도 않는다 — 그러면 startMonth 가
                // monthOf(date) 로 대체돼 잘못된 termMonths 가 저장된다.
                let linked: RecurringView | null = null
                if (view.recurringId !== null) {
                    const found = templates.find(
                        (t) => t.id === view.recurringId,
                    )
                    if (found !== undefined) {
                        linked = found
                    } else {
                        try {
                            linked = await getRecurring(view.recurringId)
                        } catch {
                            if (cancelled) return
                            setState({
                                status: "error",
                                message:
                                    "이 지출의 고정 정보를 불러오지 못했습니다. 다시 시도해 주세요.",
                            })
                            return
                        }
                    }
                }
                if (cancelled) return
                setState({
                    status: "ready",
                    categories,
                    savingsAccounts: accounts.map((a) => a.name),
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
                                      active: linked.active,
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
            savingsAccounts={state.savingsAccounts}
            initial={state.initial}
            onSaved={back}
            onCancel={back}
            onDeleted={back}
        />
    )
}
