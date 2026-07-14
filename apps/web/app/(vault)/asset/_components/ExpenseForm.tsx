"use client"
// 지출 추가/수정 폼(디자인 화면 12). 금액·항목·카테고리·결제방법을 VK 로 봉인해 저장한다.
// 신규에서 고정 ON 이면 템플릿(RecurringExpense)을 만들고 당월 인스턴스를 함께 생성한다(이후 달 자동 생성).
import { useState, useEffect, useRef } from "react"
import { useVault } from "../../_lib/vault-context"
import { isApiError } from "@/lib/api-error"
import {
    createExpense,
    createRecurring,
    deleteExpense,
    deleteRecurring,
    updateExpense,
    updateRecurring,
    type AssetCategory,
} from "@/lib/vault-client"
import { Button } from "@/components/Button"
import { toast } from "@/components/toast"
import { formatAmount } from "../_lib/asset-categories"
import { sealExpense, type ExpensePayload } from "../_lib/asset-payload"
import {
    parseTermMonths,
    propagateRecurringUpdate,
    removeRecurringFuture,
} from "../_lib/asset-recurring"
import { currentMonth, monthOf, todayISO } from "../_lib/asset-dates"

export interface ExpenseFormInitial {
    id: string
    date: string
    recurringId: string | null
    // 이 지출이 속한 달("YYYY-MM"). 고정 인스턴스의 멱등 키라 날짜를 다른 달로 옮길 수 없다.
    period: string | null
    // 이 지출에 연결된 활성 템플릿. 단건이거나 고정 해제된 지출이면 null.
    template: {
        id: string
        startMonth: string
        termMonths: number | null
    } | null
    payload: ExpensePayload
    categoryId: string | null
}

interface Props {
    categories: AssetCategory[]
    initial: ExpenseFormInitial | null
    onSaved: () => void
    onCancel: () => void
    onDeleted: () => void
}

export function ExpenseForm({
    categories,
    initial,
    onSaved,
    onCancel,
    onDeleted,
}: Props) {
    const { vaultKey, resetIdle } = useVault()
    const isEdit = initial !== null
    // 이 지출이 현재 고정(활성 템플릿 연결)인지. 토글 초기값·전환 판단에 쓴다.
    const template = initial?.template ?? null
    const wasRecurring = template !== null

    const [amount, setAmount] = useState(
        initial ? String(initial.payload.amount) : "",
    )
    const [item, setItem] = useState(initial?.payload.item ?? "")
    const [categoryId, setCategoryId] = useState<string | null>(
        initial?.categoryId ?? categories[0]?.id ?? null,
    )
    const [date, setDate] = useState(initial?.date ?? todayISO())
    const [recurring, setRecurring] = useState(wasRecurring)
    const [termMonths, setTermMonths] = useState(
        template?.termMonths != null ? String(template.termMonths) : "",
    )
    const [busy, setBusy] = useState(false)
    const [deleteMenu, setDeleteMenu] = useState(false)
    // 저장이 중간에 실패해도 만들어진 템플릿은 서버에 남는다. 재시도 때 또 만들면 고정 지출이
    // 매달 두 건씩 생기므로, 한 번 만든 템플릿 id 를 붙들고 재사용한다.
    const createdTemplateId = useRef<string | null>(null)

    // 신규 폼에서 카테고리 목록이 비동기로 도착했을 때 첫 항목을 자동 선택한다.
    // categoryId 가 이미 설정된 경우(수정 모드 또는 사용자가 직접 선택)에는 동작하지 않는다.
    useEffect(() => {
        if (initial === null && categoryId === null && categories.length > 0) {
            setCategoryId(categories[0].id)
        }
    }, [categories, categoryId, initial])

    const amountNum = Number(amount || "0")

    function onAmountInput(v: string) {
        resetIdle()
        setAmount(v.replace(/[^\d]/g, "").slice(0, 12))
    }

    // 템플릿 생성은 한 번만. 저장이 뒤에서 실패해 사용자가 재시도해도 같은 템플릿을 재사용한다.
    async function ensureTemplate(
        input: Parameters<typeof createRecurring>[0],
    ): Promise<string> {
        if (createdTemplateId.current !== null) return createdTemplateId.current
        const tmpl = await createRecurring(input)
        createdTemplateId.current = tmpl.id
        return tmpl.id
    }

    async function handleSave() {
        if (amountNum <= 0) {
            toast("금액을 입력하세요.")
            return
        }
        if (categoryId === null) {
            // 카테고리 목록이 아직 안 왔는데 저장하면 영구 "미분류"로 박힌다.
            toast("카테고리를 선택하세요.")
            return
        }
        // 고정 인스턴스는 (recurringId, period) 가 멱등 키다. 날짜만 다른 달로 옮기면 period 와
        // 어긋나 원래 달에서 사라지고 옮긴 달엔 중복이 생긴다. 달을 넘는 이동 자체를 막는다.
        if (
            isEdit &&
            initial.period !== null &&
            monthOf(date) !== initial.period
        ) {
            toast("고정 지출의 날짜는 같은 달 안에서만 바꿀 수 있습니다.")
            return
        }
        setBusy(true)
        try {
            const payload: ExpensePayload = {
                item: item.trim(),
                amount: amountNum,
            }
            const term = parseTermMonths(termMonths)
            const dayOfMonth = Number(date.slice(8, 10))
            const nowMonth = currentMonth()
            if (isEdit) {
                const blob = await sealExpense(vaultKey, payload)
                if (!wasRecurring && recurring) {
                    // 단건 → 고정 전환: 템플릿을 만들고 이 지출을 연결한다.
                    const tmplBlob = await sealExpense(vaultKey, payload)
                    const templateId = await ensureTemplate({
                        dayOfMonth,
                        startMonth: monthOf(date),
                        categoryId,
                        ...(term !== null ? { termMonths: term } : {}),
                        ...tmplBlob,
                    })
                    await updateExpense(initial.id, {
                        date,
                        categoryId,
                        recurringId: templateId,
                        period: monthOf(date),
                        ...blob,
                    })
                } else {
                    await updateExpense(initial.id, {
                        date,
                        categoryId,
                        ...blob,
                    })
                    if (template !== null && !recurring) {
                        // 고정 해제: 이후 자동 생성을 중단하고, 미리 열어봐서 이미 만들어진
                        // 미래 달 인스턴스도 함께 지운다(과거·이번 달 기록은 실제 지출이라 유지).
                        await updateRecurring(template.id, { active: false })
                        await removeRecurringFuture(template.id, nowMonth)
                    } else if (template !== null) {
                        // 고정 수정: 템플릿을 갱신해 아직 안 만들어진 달이 새 내용으로 생성되게 하고,
                        // 미리 열어봐서 이미 만들어져 있는 이후 달 인스턴스는 재봉인해 함께 밀어준다.
                        // 지난 달 인스턴스는 그대로 둔다(앞으로만 반영).
                        const tmplBlob = await sealExpense(vaultKey, payload)
                        await updateRecurring(template.id, {
                            dayOfMonth,
                            categoryId,
                            termMonths: term,
                            ...tmplBlob,
                        })
                        await propagateRecurringUpdate(
                            vaultKey,
                            {
                                id: template.id,
                                dayOfMonth,
                                categoryId,
                                startMonth: template.startMonth,
                                termMonths: term,
                            },
                            monthOf(initial.date),
                            payload,
                            nowMonth,
                        )
                    }
                }
            } else if (recurring) {
                const tmplBlob = await sealExpense(vaultKey, payload)
                const templateId = await ensureTemplate({
                    dayOfMonth,
                    startMonth: monthOf(date),
                    categoryId,
                    // 1 이상 정수면 기간 제한, 비었거나 0 이면 무기한(미전송).
                    ...(term !== null ? { termMonths: term } : {}),
                    ...tmplBlob,
                })
                const instBlob = await sealExpense(vaultKey, payload)
                await createExpense({
                    date,
                    recurringId: templateId,
                    period: monthOf(date),
                    categoryId,
                    ...instBlob,
                })
            } else {
                const blob = await sealExpense(vaultKey, payload)
                await createExpense({
                    date,
                    categoryId,
                    ...blob,
                })
            }
            onSaved()
        } catch (e) {
            setBusy(false)
            toast(
                isApiError(e)
                    ? e.message
                    : "저장에 실패했습니다. 다시 시도하세요.",
            )
        }
    }

    // 활성 템플릿일 때만 부른다. 고정 해제된 지출에 이걸 걸면 이미 남남인 옛 템플릿을 지우면서
    // Cascade 로 과거 모든 달의 실제 지출 기록까지 날아간다.
    async function handleDeleteAll() {
        if (template === null) return
        setBusy(true)
        try {
            await deleteRecurring(template.id) // FK Cascade 로 인스턴스까지 삭제
            onDeleted()
        } catch (e) {
            setBusy(false)
            toast(isApiError(e) ? e.message : "삭제에 실패했습니다.")
        }
    }

    async function handleDeleteThisMonth() {
        if (!initial) return
        setBusy(true)
        try {
            if (initial.recurringId) {
                await updateExpense(initial.id, { removed: true }) // 소프트 삭제(재생성 차단)
            } else {
                await deleteExpense(initial.id) // 일반 지출은 하드 삭제
            }
            onDeleted()
        } catch (e) {
            setBusy(false)
            toast(isApiError(e) ? e.message : "삭제에 실패했습니다.")
        }
    }

    return (
        <section className="screen-white">
            <div
                className="sticky-header tight"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <button
                    type="button"
                    className="btn-text"
                    onClick={onCancel}
                    style={{ color: "#888" }}
                >
                    취소
                </button>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {isEdit ? "지출 수정" : "지출 추가"}
                </div>
                <Button
                    variant="text"
                    onClick={handleSave}
                    loading={busy}
                    style={{ color: "var(--ac)", fontWeight: 700 }}
                >
                    저장
                </Button>
            </div>

            <div
                className="stagger"
                // 좌우 18px 는 .screen-white 가 제공(목업 stagger 18px 인셋).
                style={{
                    padding: "14px 0 50px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                }}
            >
                {/* 금액 */}
                <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
                    <div
                        className="field-label"
                        style={{ marginBottom: 10, color: "#a0a0a0" }}
                    >
                        금액
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 30,
                                fontWeight: 800,
                                color: "#cfcfcf",
                            }}
                            aria-hidden="true"
                        >
                            ₩
                        </span>
                        <input
                            inputMode="numeric"
                            size={6}
                            value={amount ? formatAmount(amountNum) : ""}
                            onChange={(e) => onAmountInput(e.target.value)}
                            placeholder="0"
                            aria-label="금액"
                            style={{
                                width: "auto",
                                minWidth: 60,
                                maxWidth: 230,
                                border: "none",
                                background: "none",
                                fontSize: 40,
                                fontWeight: 800,
                                letterSpacing: "-0.03em",
                                textAlign: "center",
                                outline: "none",
                                color: "#171717",
                            }}
                        />
                    </div>
                </div>

                {/* 항목 */}
                <div>
                    <div className="field-label" style={{ color: "#a0a0a0" }}>
                        항목
                    </div>
                    <input
                        value={item}
                        onChange={(e) => {
                            resetIdle()
                            setItem(e.target.value)
                        }}
                        placeholder="예: 점심 김밥천국"
                        aria-label="항목"
                        className="field-control"
                        style={{ fontWeight: 600 }}
                    />
                </div>

                {/* 카테고리 */}
                <div>
                    <div
                        className="field-label"
                        style={{ marginBottom: 10, color: "#a0a0a0" }}
                    >
                        카테고리
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {categories.map((c) => {
                            const active = c.id === categoryId
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        resetIdle()
                                        setCategoryId(c.id)
                                    }}
                                    aria-pressed={active}
                                    className="chip"
                                    style={
                                        active
                                            ? {
                                                  border: `1.5px solid ${c.color}`,
                                                  color: c.color,
                                                  background: `${c.color}14`,
                                              }
                                            : {
                                                  border: "1.5px solid #ececec",
                                                  color: "#777",
                                              }
                                    }
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: c.color,
                                            display: "inline-block",
                                            marginRight: 7,
                                        }}
                                    />
                                    {c.name}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 날짜 */}
                <div>
                    <div className="field-label" style={{ color: "#a0a0a0" }}>
                        날짜
                    </div>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                            resetIdle()
                            setDate(e.target.value)
                        }}
                        aria-label="날짜"
                        className="field-control"
                        style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#333",
                        }}
                    />
                </div>

                {/* 고정 지출 토글(신규·수정 공용) */}
                {
                    <div className="asset-toggle-row">
                        <span>
                            <span
                                style={{
                                    fontSize: 14.5,
                                    fontWeight: 700,
                                    color: "#222",
                                }}
                            >
                                고정 지출
                            </span>
                            <span
                                style={{
                                    display: "block",
                                    fontSize: 12,
                                    color: "#9a9a9a",
                                    marginTop: 2,
                                }}
                            >
                                매월 반복되는 지출
                            </span>
                        </span>
                        <button
                            type="button"
                            className="press-96"
                            role="switch"
                            aria-checked={recurring}
                            aria-label="고정 지출"
                            onClick={() => {
                                resetIdle()
                                setRecurring(!recurring)
                            }}
                            style={{
                                flexShrink: 0,
                                position: "relative",
                                width: 50,
                                height: 30,
                                border: "none",
                                borderRadius: 999,
                                padding: 0,
                                background: recurring ? "var(--ac)" : "#dcdcdc",
                                cursor: "pointer",
                                transition: "background .2s, transform .12s",
                            }}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    position: "absolute",
                                    top: 3,
                                    left: 3,
                                    width: 24,
                                    height: 24,
                                    borderRadius: "50%",
                                    background: "#fff",
                                    boxShadow: "0 2px 5px rgba(0,0,0,.2)",
                                    transform: recurring
                                        ? "translateX(20px)"
                                        : "translateX(0)",
                                    transition: "transform .2s",
                                }}
                            />
                        </button>
                    </div>
                }

                {/* 개월 수(고정 ON 이면 표시, 선택) */}
                {recurring && (
                    <div
                        className="form-row"
                        style={{ margin: 0, marginTop: -12, gap: 0 }}
                    >
                        <label
                            htmlFor="term-months"
                            style={{ color: "#a0a0a0", marginBottom: 7 }}
                        >
                            개월 수{" "}
                            <span
                                style={{
                                    color: "#cbcbcb",
                                    fontWeight: 600,
                                }}
                            >
                                · 선택
                            </span>
                        </label>
                        <input
                            id="term-months"
                            inputMode="numeric"
                            className="field-control"
                            placeholder="비우면 무기한"
                            style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: "#333",
                            }}
                            value={termMonths}
                            onChange={(e) => {
                                resetIdle()
                                setTermMonths(
                                    e.target.value
                                        .replace(/[^\d]/g, "")
                                        .slice(0, 3),
                                )
                            }}
                            aria-label="개월 수"
                        />
                        <div
                            style={{
                                fontSize: 12,
                                color: "#9a9a9a",
                                marginTop: 7,
                            }}
                        >
                            설정한 개월 수만큼 매월 자동 반영돼요. 비워두면
                            무기한 반복됩니다.
                        </div>
                    </div>
                )}

                {/* 액션(수정만): 고정 해제 · 삭제 */}
                {isEdit && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 9,
                            marginTop: 4,
                        }}
                    >
                        {recurring && (
                            <button
                                type="button"
                                className="press-98"
                                onClick={() => {
                                    resetIdle()
                                    setRecurring(false)
                                }}
                                disabled={busy}
                                style={{
                                    height: 50,
                                    border: "1px solid #ececec",
                                    borderRadius: 14,
                                    background: "#fff",
                                    font: "inherit",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: "#555",
                                    cursor: "pointer",
                                }}
                            >
                                고정 해제
                            </button>
                        )}
                        <button
                            type="button"
                            className="press-98"
                            onClick={
                                // 활성 고정만 "전체/이번 달" 선택지를 준다. 해제된 지출은 이미 단건이다.
                                template !== null
                                    ? () => setDeleteMenu(true)
                                    : handleDeleteThisMonth
                            }
                            disabled={busy}
                            style={{
                                height: 50,
                                border: "1px solid #f3dcdc",
                                borderRadius: 14,
                                background: "#fff",
                                font: "inherit",
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#e5484d",
                                cursor: "pointer",
                            }}
                        >
                            이 지출 삭제
                        </button>
                    </div>
                )}
            </div>

            {deleteMenu && (
                <div
                    className="dialog-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-label="고정 지출 삭제"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setDeleteMenu(false)
                    }}
                >
                    <div className="sheet">
                        <div className="sheet-grip" aria-hidden="true" />
                        <div
                            style={{
                                fontSize: 18,
                                fontWeight: 800,
                                letterSpacing: "-0.02em",
                                marginBottom: 4,
                            }}
                        >
                            고정 지출 삭제
                        </div>
                        <p
                            style={{
                                fontSize: 13,
                                lineHeight: 1.5,
                                color: "#9a9a9a",
                                marginBottom: 18,
                            }}
                        >
                            매월 반복되는 지출이에요. 어떻게 삭제할까요?
                        </p>
                        <button
                            type="button"
                            className="press-98"
                            onClick={() => {
                                setDeleteMenu(false)
                                void handleDeleteAll()
                            }}
                            disabled={busy}
                            style={{
                                width: "100%",
                                height: 54,
                                border: "none",
                                borderRadius: 16,
                                background: "#e5484d",
                                font: "inherit",
                                fontSize: 15,
                                fontWeight: 700,
                                color: "#fff",
                                cursor: "pointer",
                                marginBottom: 9,
                            }}
                        >
                            고정 전체 삭제
                        </button>
                        <button
                            type="button"
                            className="press-98"
                            onClick={() => {
                                setDeleteMenu(false)
                                void handleDeleteThisMonth()
                            }}
                            disabled={busy}
                            style={{
                                width: "100%",
                                height: 54,
                                border: "1.5px solid #ececec",
                                borderRadius: 16,
                                background: "#fff",
                                font: "inherit",
                                fontSize: 15,
                                fontWeight: 700,
                                color: "#222",
                                cursor: "pointer",
                                marginBottom: 9,
                            }}
                        >
                            이번 달만 삭제
                        </button>
                        <button
                            type="button"
                            className="press-dim6"
                            onClick={() => setDeleteMenu(false)}
                            disabled={busy}
                            style={{
                                width: "100%",
                                height: 50,
                                border: "none",
                                background: "none",
                                font: "inherit",
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#888",
                                cursor: "pointer",
                            }}
                        >
                            취소
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}
