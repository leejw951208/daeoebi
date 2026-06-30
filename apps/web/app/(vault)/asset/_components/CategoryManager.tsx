"use client"
// 카테고리 관리 바텀시트. 목록 표시·추가·인라인 수정·삭제를 지원한다.
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

export function CategoryManager({ onClose, onChanged }: Props) {
    const { resetIdle } = useVault()
    const [categories, setCategories] = useState<AssetCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<AssetCategory | null>(
        null,
    )

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

    async function handleAdd(name: string, color: string) {
        setError(null)
        try {
            await createAssetCategory(name, color)
            await loadCategories()
            onChanged?.()
        } catch (e) {
            setError(isApiError(e) ? e.message : "추가에 실패했습니다.")
            throw e
        }
    }

    async function handleEdit(
        id: string,
        patch: { name?: string; color?: string },
    ) {
        setError(null)
        try {
            await updateAssetCategory(id, patch)
            await loadCategories()
            onChanged?.()
        } catch (e) {
            setError(isApiError(e) ? e.message : "수정에 실패했습니다.")
            throw e
        }
    }

    async function confirmDelete() {
        if (!pendingDelete) return
        const target = pendingDelete
        setPendingDelete(null)
        setError(null)
        try {
            await deleteAssetCategory(target.id)
            await loadCategories()
            onChanged?.()
        } catch (e) {
            setError(isApiError(e) ? e.message : "삭제에 실패했습니다.")
        }
    }

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="카테고리 관리"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginBottom: 16,
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                        카테고리 관리
                    </div>
                    <button
                        type="button"
                        className="btn-text"
                        aria-label="닫기"
                        onClick={() => {
                            resetIdle()
                            onClose()
                        }}
                    >
                        ✕
                    </button>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ marginBottom: 12 }}
                    >
                        {error}
                    </div>
                )}

                <CategoryAddSection onAdd={handleAdd} onActivity={resetIdle} />

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
                    <div>
                        {categories.map((cat) => (
                            <CategoryRow
                                key={cat.id}
                                category={cat}
                                onEdit={handleEdit}
                                onDelete={(c) => {
                                    resetIdle()
                                    setPendingDelete(c)
                                }}
                                onActivity={resetIdle}
                            />
                        ))}
                    </div>
                )}
            </div>

            {pendingDelete && (
                <ConfirmDialog
                    open
                    title="카테고리 삭제"
                    message="이 카테고리의 지출은 미분류가 됩니다."
                    confirmLabel="삭제"
                    destructive
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
