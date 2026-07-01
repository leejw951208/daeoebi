"use client"
// 데모용 가계부 화면. 실제 AssetDashboard 를 가짜 데이터로 재사용 + 데모 상호작용.
import { useMemo, useState } from "react"
import type { AssetCategory } from "@/lib/vault-client"
import {
    AssetDashboard,
    type Loaded,
} from "../(vault)/asset/_components/dashboard/AssetDashboard"
import {
    byDay,
    type ComputedExpense,
} from "../(vault)/asset/_lib/asset-compute"
import {
    DEMO_ASSET_CATEGORIES,
    DEMO_EXPENSES,
    DEMO_INCOMES,
    DEMO_INCOME_AMOUNT,
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

    const dayTotals = useMemo(() => byDay(expenses), [expenses])

    const data: Loaded = {
        incomeAmount: DEMO_INCOME_AMOUNT,
        incomes: DEMO_INCOMES,
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
                onOpenIncome={() => {
                    /* 데모: 수입은 표시만 */
                }}
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
