"use client"
// 데모용 카테고리 관리(로컬 상태). 실제 CategoryManager 의 축약본 — 서버·암호화 없음.
import { useState } from "react"
import type { AssetCategory } from "@/lib/vault-client"
import { Button } from "@/components/Button"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { CategoryColorInput } from "../(vault)/asset/_components/CategoryColorInput"
import { isValidHexColor } from "../(vault)/asset/_lib/asset-categories"

interface DemoCategoryManagerProps {
    categories: AssetCategory[]
    onChange: (next: AssetCategory[]) => void
    onClose: () => void
}

let demoCatSeq = 0

export function DemoCategoryManager({
    categories,
    onChange,
    onClose,
}: DemoCategoryManagerProps) {
    const [name, setName] = useState("")
    const [color, setColor] = useState("#f2994a")
    const [editId, setEditId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editColor, setEditColor] = useState("#f2994a")
    const [pendingDelete, setPendingDelete] = useState<AssetCategory | null>(
        null,
    )

    function add() {
        if (!name.trim() || !isValidHexColor(color)) return
        demoCatSeq += 1
        const ts = "2026-06-30T00:00:00.000Z"
        onChange([
            ...categories,
            {
                id: `demo-cat-${demoCatSeq}`,
                name: name.trim(),
                color,
                createdAt: ts,
                updatedAt: ts,
            },
        ])
        setName("")
        setColor("#f2994a")
    }

    function startEdit(c: AssetCategory) {
        setEditId(c.id)
        setEditName(c.name)
        setEditColor(c.color)
    }

    function saveEdit() {
        if (editId === null || !isValidHexColor(editColor)) return
        onChange(
            categories.map((c) =>
                c.id === editId
                    ? {
                          ...c,
                          name: editName.trim() || c.name,
                          color: editColor,
                      }
                    : c,
            ),
        )
        setEditId(null)
    }

    function confirmDelete() {
        if (!pendingDelete) return
        onChange(categories.filter((c) => c.id !== pendingDelete.id))
        setPendingDelete(null)
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
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 16,
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                        카테고리 관리
                    </div>
                    <button
                        type="button"
                        className="btn-text"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>

                {/* 추가 폼 */}
                <div style={{ marginBottom: 20 }}>
                    <div className="field-label" style={{ marginBottom: 8 }}>
                        이름
                    </div>
                    <input
                        type="text"
                        className="field-control"
                        placeholder="예: 식비"
                        value={name}
                        maxLength={20}
                        aria-label="카테고리 이름"
                        onChange={(e) => setName(e.target.value)}
                        style={{ marginBottom: 12 }}
                    />
                    <CategoryColorInput value={color} onChange={setColor} />
                    <Button
                        type="button"
                        variant="primary"
                        onClick={add}
                        disabled={!name.trim() || !isValidHexColor(color)}
                        style={{ width: "100%", marginTop: 12 }}
                    >
                        + 추가
                    </Button>
                </div>

                {/* 목록 */}
                {categories.map((c) =>
                    editId === c.id ? (
                        <div
                            key={c.id}
                            style={{
                                padding: "12px 0",
                                borderBottom: "1px solid var(--color-border)",
                            }}
                        >
                            <input
                                type="text"
                                className="input"
                                value={editName}
                                maxLength={20}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{ marginBottom: 10 }}
                            />
                            <CategoryColorInput
                                value={editColor}
                                onChange={setEditColor}
                            />
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 12,
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={() => setEditId(null)}
                                    style={{ flex: 1 }}
                                >
                                    취소
                                </button>
                                <Button
                                    variant="primary"
                                    onClick={saveEdit}
                                    disabled={!isValidHexColor(editColor)}
                                    style={{ flex: 1 }}
                                >
                                    저장
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div
                            key={c.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 0",
                                borderBottom: "1px solid var(--color-border)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: "50%",
                                        background: c.color,
                                        flexShrink: 0,
                                    }}
                                />
                                <span style={{ fontSize: 14, fontWeight: 600 }}>
                                    {c.name}
                                </span>
                            </div>
                            <div style={{ display: "flex", gap: 12 }}>
                                <button
                                    type="button"
                                    className="btn-text"
                                    onClick={() => startEdit(c)}
                                >
                                    수정
                                </button>
                                <button
                                    type="button"
                                    className="btn-text"
                                    style={{
                                        color: "var(--color-danger, #ef4444)",
                                    }}
                                    onClick={() => setPendingDelete(c)}
                                >
                                    삭제
                                </button>
                            </div>
                        </div>
                    ),
                )}
            </div>

            <ConfirmDialog
                open={pendingDelete !== null}
                title="카테고리 삭제"
                message="이 카테고리의 지출은 미분류가 됩니다."
                confirmLabel="삭제"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </div>
    )
}
