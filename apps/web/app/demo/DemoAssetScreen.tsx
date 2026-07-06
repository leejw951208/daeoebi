"use client"
// 데모용 가계부 화면. 실제 AssetDashboard 를 가짜 데이터로 재사용 + 데모 상호작용.
import { useMemo, useState } from "react"
import type { AssetCategory } from "@/lib/vault-client"
import {
    AssetDashboard,
    type AssetTab,
    type Loaded,
    type SavingsView,
} from "../(vault)/asset/_components/dashboard/AssetDashboard"
import {
    byDay,
    type ComputedExpense,
} from "../(vault)/asset/_lib/asset-compute"
import {
    DEMO_ASSET_CATEGORIES,
    DEMO_BUDGET_AMOUNT,
    DEMO_BUDGET_ROWS,
    DEMO_EXPENSES,
    DEMO_MONTH,
} from "./demo-asset-data"
import { DemoCategoryManager } from "./DemoCategoryManager"
import { DemoExpenseForm } from "./DemoExpenseForm"

type Overlay = "none" | "expense" | "categories"

export function DemoAssetScreen() {
    const [categories, setCategories] = useState<AssetCategory[]>(
        DEMO_ASSET_CATEGORIES,
    )
    const [expenses, setExpenses] = useState<ComputedExpense[]>(DEMO_EXPENSES)
    const [selectedDay, setSelectedDay] = useState<string | null>(
        `${DEMO_MONTH}-08`,
    )
    const [overlay, setOverlay] = useState<Overlay>("none")
    const [assetTab, setAssetTab] = useState<AssetTab>("budget")

    const dayTotals = useMemo(() => byDay(expenses), [expenses])

    // 데모엔 저축/투자 카테고리·목표 데이터가 없다. 세그먼트 전환은 보여주되 내용은 빈 상태로 표시한다.
    const demoSavings: SavingsView = {
        status: "ready",
        summary: { savedTotal: 0, investTotal: 0, netWorth: 0 },
        savedMonth: 0,
        investMonth: 0,
        goalName: null,
        goalAmount: 0,
        contributions: [],
        onEditGoal: () => {
            /* 데모: 저축 목표 편집 미지원 */
        },
    }

    const data: Loaded = {
        budgetAmount: DEMO_BUDGET_AMOUNT,
        budgetRows: DEMO_BUDGET_ROWS,
        expenses,
        categories,
    }

    if (overlay === "expense") {
        return (
            <DemoExpenseForm
                categories={categories}
                onSave={(e) => {
                    setExpenses((prev) => [...prev, e])
                    setOverlay("none")
                }}
                onCancel={() => setOverlay("none")}
            />
        )
    }

    return (
        <section style={{ minHeight: "100%", position: "relative" }}>
            <div
                className="sticky-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ fontSize: 21, fontWeight: 800 }}>자산</div>
                <button
                    type="button"
                    className="btn-text"
                    style={{ fontSize: 12 }}
                    onClick={() => setOverlay("categories")}
                >
                    카테고리 관리
                </button>
            </div>

            <AssetDashboard
                month={DEMO_MONTH}
                data={data}
                dayTotals={dayTotals}
                selectedDay={selectedDay}
                onSelectDay={(d) => setSelectedDay(d)}
                onOpenBudget={() => {
                    /* 데모: 예산은 표시만 */
                }}
                assetTab={assetTab}
                onTab={setAssetTab}
                savings={demoSavings}
            />

            <button
                type="button"
                className="fab"
                aria-label="새 지출 추가"
                onClick={() => setOverlay("expense")}
            >
                <span aria-hidden="true">+</span>
            </button>

            {overlay === "categories" && (
                <DemoCategoryManager
                    categories={categories}
                    onChange={(next) => {
                        // 삭제된 카테고리를 참조하던 지출은 미분류(null)로.
                        const ids = new Set(next.map((c) => c.id))
                        setExpenses((prev) =>
                            prev.map((e) =>
                                e.categoryId && !ids.has(e.categoryId)
                                    ? { ...e, categoryId: null }
                                    : e,
                            ),
                        )
                        setCategories(next)
                    }}
                    onClose={() => setOverlay("none")}
                />
            )}
        </section>
    )
}
