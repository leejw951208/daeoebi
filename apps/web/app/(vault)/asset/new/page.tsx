"use client"
// 지출 신규 추가 라우트. ExpenseForm 을 빈 상태로 mount 한다.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { listAssetCategories, type AssetCategory } from "@/lib/vault-client"
import { ExpenseForm } from "../_components/ExpenseForm"

export default function NewExpensePage() {
    const router = useRouter()
    const [categories, setCategories] = useState<AssetCategory[]>([])
    const [categoryError, setCategoryError] = useState<string | null>(null)

    useEffect(() => {
        listAssetCategories()
            .then(setCategories)
            .catch(() => {
                setCategoryError("카테고리를 불러오지 못했습니다.")
            })
    }, [])

    const back = () => {
        router.push("/asset")
        router.refresh()
    }

    if (categoryError) {
        return (
            <section style={{ padding: 24 }}>
                <div role="alert" className="error-box">
                    {categoryError}
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
            categories={categories}
            initial={null}
            onSaved={back}
            onCancel={back}
            onDeleted={back}
        />
    )
}
