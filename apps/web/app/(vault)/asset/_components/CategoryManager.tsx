"use client"
// 카테고리 관리 바텀시트. LIST(목록) · FORM(추가/수정) 2모드.
// LIST: 색상 점 + 이름/코드 + 수정·삭제, 하단 "+ 카테고리 추가".
// FORM: 이름 + 코드 + 색상 스와치 + 저장, 수정 중엔 "카테고리 삭제" 도 노출.
// 모든 쓰기 후 목록 재조회 및 onChanged 콜백 호출.
import { useState, useEffect } from "react"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useVault } from "../../_lib/vault-context"
import {
    listAssetCategories,
    createAssetCategory,
    updateAssetCategory,
    deleteAssetCategory,
    type AssetCategory,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { CategoryAddSection } from "./CategoryAddSection"
import { CategoryRow } from "./CategoryRow"

interface Props {
    onClose: () => void
    onChanged?: () => void
}

type CategoryFormData = { name: string; color: string; code: string }

type Mode = "list" | "form"

export function CategoryManager({ onClose, onChanged }: Props) {
    const { resetIdle } = useVault()
    const [categories, setCategories] = useState<AssetCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<Mode>("list")
    const [editingCategory, setEditingCategory] =
        useState<AssetCategory | null>(null)
    const [pendingDelete, setPendingDelete] = useState<AssetCategory | null>(
        null,
    )
    const [deleting, setDeleting] = useState(false)
    // 시트가 열려 있는 동안 쓰기가 1회 이상 발생했는지 추적한다.
    // 닫힐 때만 onChanged 를 호출해 부모 리로드를 1회로 합친다.
    const [dirty, setDirty] = useState(false)

    async function loadCategories() {
        setLoading(true)
        setError(null)
        try {
            const data = await listAssetCategories()
            setCategories(data)
        } catch (e) {
            setError(isApiError(e) ? e.message : "불러오지 못했습니다.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadCategories()
    }, [])

    // 닫힘 시 변경이 있었을 때만 부모 리로드를 1회 호출한다.
    function handleClose() {
        if (dirty) {
            onChanged?.()
        }
        onClose()
    }

    function openAddForm() {
        resetIdle()
        setError(null)
        setEditingCategory(null)
        setMode("form")
    }

    function openEditForm(category: AssetCategory) {
        resetIdle()
        setError(null)
        setEditingCategory(category)
        setMode("form")
    }

    function backToList() {
        resetIdle()
        setError(null)
        setMode("list")
        setEditingCategory(null)
    }

    async function handleSave(data: CategoryFormData) {
        setError(null)
        try {
            if (editingCategory) {
                await updateAssetCategory(editingCategory.id, data)
            } else {
                await createAssetCategory(data.name, data.color, data.code)
            }
            await loadCategories()
            setDirty(true)
            setMode("list")
            setEditingCategory(null)
        } catch (e) {
            setError(
                isApiError(e)
                    ? e.message
                    : editingCategory
                      ? "수정에 실패했습니다."
                      : "추가에 실패했습니다.",
            )
            throw e
        }
    }

    async function confirmDelete() {
        if (!pendingDelete) return
        const target = pendingDelete
        setDeleting(true)
        setError(null)
        try {
            await deleteAssetCategory(target.id)
            await loadCategories()
            setDirty(true)
            setMode("list")
            setEditingCategory(null)
        } catch (e) {
            setError(isApiError(e) ? e.message : "삭제에 실패했습니다.")
        } finally {
            setDeleting(false)
            setPendingDelete(null)
        }
    }

    const title =
        mode === "form"
            ? editingCategory
                ? "카테고리 수정"
                : "카테고리 추가"
            : "카테고리 관리"

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="카테고리 관리"
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose()
            }}
        >
            <div
                className="sheet"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: 0,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        flex: "none",
                        padding: "10px 22px 12px",
                        borderBottom: "1px solid #f2f2f2",
                    }}
                >
                    <div
                        aria-hidden="true"
                        style={{
                            width: 38,
                            height: 5,
                            borderRadius: 3,
                            background: "#e3e3e6",
                            margin: "0 auto 14px",
                        }}
                    />
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        {mode === "form" ? (
                            <button
                                type="button"
                                onClick={backToList}
                                style={{
                                    border: "none",
                                    background: "none",
                                    font: "inherit",
                                    fontSize: 14,
                                    color: "#888",
                                    cursor: "pointer",
                                    padding: 0,
                                }}
                            >
                                ← 목록
                            </button>
                        ) : (
                            <span style={{ width: 34 }} aria-hidden="true" />
                        )}
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 800,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {title}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                resetIdle()
                                handleClose()
                            }}
                            style={{
                                border: "none",
                                background: "none",
                                font: "inherit",
                                fontSize: 14,
                                color: "#888",
                                cursor: "pointer",
                                padding: 0,
                            }}
                        >
                            닫기
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "16px 22px 26px",
                    }}
                >
                    {error && (
                        <div
                            role="alert"
                            className="error-box"
                            style={{ marginBottom: 12 }}
                        >
                            {error}
                        </div>
                    )}

                    {mode === "list" ? (
                        <>
                            {loading ? (
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "22px 0",
                                        fontSize: 13,
                                        color: "var(--color-text-muted)",
                                        fontWeight: 600,
                                    }}
                                >
                                    불러오는 중…
                                </div>
                            ) : categories.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "22px 0",
                                        fontSize: 13,
                                        color: "var(--color-text-muted)",
                                        fontWeight: 600,
                                    }}
                                >
                                    아직 카테고리가 없어요.
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                        marginBottom: 14,
                                    }}
                                >
                                    {categories.map((cat) => (
                                        <CategoryRow
                                            key={cat.id}
                                            category={cat}
                                            onEdit={openEditForm}
                                            onDelete={(c) => {
                                                resetIdle()
                                                setPendingDelete(c)
                                            }}
                                            onActivity={resetIdle}
                                        />
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={openAddForm}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    width: "100%",
                                    height: 50,
                                    border: "1.5px dashed #d8d8d8",
                                    borderRadius: 14,
                                    background: "none",
                                    font: "inherit",
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: "var(--color-accent, #171717)",
                                    cursor: "pointer",
                                }}
                            >
                                + 카테고리 추가
                            </button>
                        </>
                    ) : (
                        <CategoryAddSection
                            key={editingCategory?.id ?? "new"}
                            initial={editingCategory}
                            onSave={handleSave}
                            onDelete={
                                editingCategory
                                    ? () => {
                                          resetIdle()
                                          setPendingDelete(editingCategory)
                                      }
                                    : undefined
                            }
                            onActivity={resetIdle}
                        />
                    )}
                </div>
            </div>

            {pendingDelete && (
                <ConfirmDialog
                    open
                    title="카테고리 삭제"
                    message="이 카테고리의 지출은 미분류가 됩니다."
                    confirmLabel="삭제"
                    destructive
                    confirmLoading={deleting}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        resetIdle()
                        setPendingDelete(null)
                    }}
                />
            )}
        </div>
    )
}
