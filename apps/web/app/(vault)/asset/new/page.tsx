"use client"
// 지출 신규 추가 라우트. ExpenseForm 을 빈 상태로 mount 한다.
// 적금 계좌 목록도 함께 불러온다 — 저축 카테고리 지출은 항목이 곧 계좌명이라 골라야 한다.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    listAssetCategories,
    listSavingsAccounts,
    type AssetCategory,
} from "@/lib/vault-client"
import { ExpenseForm } from "../_components/ExpenseForm"

export default function NewExpensePage() {
    const router = useRouter()
    const [categories, setCategories] = useState<AssetCategory[]>([])
    const [savingsAccounts, setSavingsAccounts] = useState<string[]>([])
    const [categoryError, setCategoryError] = useState<string | null>(null)

    useEffect(() => {
        Promise.all([listAssetCategories(), listSavingsAccounts()])
            .then(([cats, accounts]) => {
                setCategories(cats)
                // 계좌명은 서버 평문 메타라 복호화 없이 바로 쓴다.
                setSavingsAccounts(accounts.map((a) => a.name))
            })
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
            savingsAccounts={savingsAccounts}
            initial={null}
            onSaved={back}
            onCancel={back}
            onDeleted={back}
        />
    )
}
