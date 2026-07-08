"use client"
// 공개 데모 화면(/demo). 인증 없이 누구나 들어와 구조를 둘러볼 수 있다.
// 실제 금고와 완전히 분리된다 — vault-client·실제 인증·실제 데이터를 일절 쓰지 않고
// 메모리상 가짜 데이터(demo-data)로만 목록 → 상세 → 폼 흐름을 재현한다.
import { type CSSProperties, useMemo, useState } from "react"
import { Button } from "@/components/Button"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { CopyField } from "../(vault)/_components/CopyField"
import { DemoAssetScreen } from "./DemoAssetScreen"
import { DemoSecretForm } from "./DemoSecretForm"
import { DEMO_SEED, type DemoField, type DemoSecret } from "./demo-data"

type View =
    | { kind: "list" }
    | { kind: "detail"; id: string }
    | { kind: "new" }
    | { kind: "edit"; id: string }

let newSeq = 0

export default function DemoPage() {
    const [tab, setTab] = useState<"secret" | "asset">("secret")
    const [secrets, setSecrets] = useState<DemoSecret[]>(DEMO_SEED)
    const [view, setView] = useState<View>({ kind: "list" })
    const [query, setQuery] = useState("")
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [fieldToDelete, setFieldToDelete] = useState<number | null>(null)

    const current =
        view.kind === "detail" || view.kind === "edit"
            ? (secrets.find((s) => s.id === view.id) ?? null)
            : null

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return secrets
        return secrets.filter((s) => s.label.toLowerCase().includes(q))
    }, [secrets, query])

    function saveSecret(input: {
        label: string
        fields: DemoField[]
        memo: string
    }) {
        if (view.kind === "edit") {
            const id = view.id
            setSecrets((prev) =>
                prev.map((s) =>
                    s.id === id ? { ...s, ...input, updatedAt: nowIso() } : s,
                ),
            )
            setView({ kind: "detail", id })
            return
        }
        newSeq += 1
        const id = `demo-new-${newSeq}`
        const ts = nowIso()
        setSecrets((prev) => [
            { id, ...input, createdAt: ts, updatedAt: ts },
            ...prev,
        ])
        setView({ kind: "detail", id })
    }

    function deleteSecret(id: string) {
        setConfirmDeleteId(null)
        setSecrets((prev) => prev.filter((s) => s.id !== id))
        setView({ kind: "list" })
    }

    function deleteField(idx: number) {
        if (!current) return
        setFieldToDelete(null)
        const id = current.id
        setSecrets((prev) =>
            prev.map((s) =>
                s.id === id
                    ? {
                          ...s,
                          fields: s.fields.filter((_, i) => i !== idx),
                          updatedAt: nowIso(),
                      }
                    : s,
            ),
        )
    }

    // ── 가계부 탭 ──
    if (tab === "asset") {
        return (
            <section>
                <DemoBanner />
                <DemoTabs tab={tab} onTab={setTab} />
                <DemoAssetScreen />
            </section>
        )
    }

    // ── 폼(신규/수정) ──
    if (view.kind === "new" || view.kind === "edit") {
        return (
            <section>
                <DemoBanner />
                <DemoTabs tab={tab} onTab={setTab} />
                <DemoSecretForm
                    initial={view.kind === "edit" ? current : null}
                    onSave={saveSecret}
                    onCancel={() =>
                        setView(
                            view.kind === "edit"
                                ? { kind: "detail", id: view.id }
                                : { kind: "list" },
                        )
                    }
                />
            </section>
        )
    }

    // ── 상세 ──
    if (view.kind === "detail") {
        if (!current) {
            return (
                <section>
                    <DemoBanner />
                    <DemoTabs tab={tab} onTab={setTab} />
                    <p className="muted">항목을 찾을 수 없습니다.</p>
                    <Button onClick={() => setView({ kind: "list" })}>
                        데모 목록으로
                    </Button>
                </section>
            )
        }
        return (
            <section>
                <DemoBanner />
                <DemoTabs tab={tab} onTab={setTab} />
                <div
                    className="sticky-header"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <button
                        type="button"
                        className="btn-text"
                        onClick={() => setView({ kind: "list" })}
                    >
                        ← 대외비
                    </button>
                    <span className="lock-timer" aria-hidden="true">
                        <span className="dot" />
                        데모
                    </span>
                </div>

                <div className="stagger">
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            marginBottom: 22,
                        }}
                    >
                        <span className="avatar lg" aria-hidden="true">
                            {current.label.trim()[0] ?? "·"}
                        </span>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontSize: 21 }}>{current.label}</h1>
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: 9 }}>
                        {current.fields.length === 0 && (
                            <p className="muted">등록된 필드가 없습니다.</p>
                        )}
                        {current.fields.map((field, idx) => (
                            <CopyField
                                key={`${field.name}-${idx}`}
                                label={field.name}
                                value={field.value}
                                onDelete={() => setFieldToDelete(idx)}
                            />
                        ))}
                        {current.memo && (
                            <div className="secret-plate">
                                <div
                                    className="secret-label"
                                    style={{ marginBottom: 6 }}
                                >
                                    메모
                                </div>
                                <div className="secret-memo">
                                    {current.memo}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                        <Button
                            variant="secondary"
                            style={{ flex: 1, minHeight: 48 }}
                            onClick={() =>
                                setView({ kind: "edit", id: current.id })
                            }
                        >
                            수정
                        </Button>
                        <Button
                            variant="danger"
                            style={{ flex: 1, minHeight: 48 }}
                            onClick={() => setConfirmDeleteId(current.id)}
                        >
                            삭제
                        </Button>
                    </div>
                </div>

                <ConfirmDialog
                    open={confirmDeleteId !== null}
                    title="항목 삭제"
                    message="정말 삭제하시겠습니까?"
                    confirmLabel="삭제"
                    destructive
                    onConfirm={() =>
                        confirmDeleteId && deleteSecret(confirmDeleteId)
                    }
                    onCancel={() => setConfirmDeleteId(null)}
                />
                <ConfirmDialog
                    open={fieldToDelete !== null}
                    title="필드 삭제"
                    message={
                        fieldToDelete !== null && current.fields[fieldToDelete]
                            ? `"${current.fields[fieldToDelete].name}" 필드를 삭제하시겠습니까?`
                            : "이 필드를 삭제하시겠습니까?"
                    }
                    confirmLabel="삭제"
                    destructive
                    onConfirm={() =>
                        fieldToDelete !== null && deleteField(fieldToDelete)
                    }
                    onCancel={() => setFieldToDelete(null)}
                />
            </section>
        )
    }

    // ── 목록 ──
    return (
        <section>
            <DemoBanner />
            <DemoTabs tab={tab} onTab={setTab} />
            <div className="sticky-header">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 12,
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: 21,
                                fontWeight: 800,
                                letterSpacing: "-0.03em",
                            }}
                        >
                            대외비
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--color-text-muted)",
                                fontWeight: 500,
                            }}
                        >
                            {filtered.length}개 항목
                        </div>
                    </div>
                    <span className="lock-timer" aria-hidden="true">
                        <span className="dot" />
                        데모
                    </span>
                </div>

                <div className="search-bar">
                    <span
                        aria-hidden="true"
                        style={{ color: "#aaa", fontSize: 15 }}
                    >
                        ⌕
                    </span>
                    <input
                        type="search"
                        placeholder="제목 검색"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="제목 검색"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 40,
                        textAlign: "center",
                    }}
                >
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: 6,
                        }}
                    >
                        {query.trim()
                            ? "검색 결과가 없어요"
                            : "아직 항목이 없어요"}
                    </div>
                    <p
                        className="muted"
                        style={{
                            fontSize: 13.5,
                            lineHeight: 1.5,
                            maxWidth: 220,
                        }}
                    >
                        {query.trim()
                            ? "다른 검색어로 다시 시도해 보세요."
                            : "우하단 + 로 항목을 추가해 보세요."}
                    </p>
                </div>
            ) : (
                <ul className="entry-list stagger">
                    {filtered.map((secret) => (
                        <li key={secret.id}>
                            <button
                                type="button"
                                className="entry-card"
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    background: "none",
                                    font: "inherit",
                                    cursor: "pointer",
                                }}
                                onClick={() =>
                                    setView({ kind: "detail", id: secret.id })
                                }
                            >
                                <span className="avatar" aria-hidden="true">
                                    {secret.label.trim()[0] ?? "·"}
                                </span>
                                <span className="entry-main">
                                    <span className="entry-label">
                                        {secret.label}
                                    </span>
                                </span>
                                <span className="entry-side">
                                    <span
                                        className="entry-chevron"
                                        aria-hidden="true"
                                    >
                                        ›
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <button
                type="button"
                className="fab"
                aria-label="새 항목 추가"
                onClick={() => setView({ kind: "new" })}
            >
                <span aria-hidden="true">+</span>
            </button>
        </section>
    )
}

// 데모임을 알리는 상단 배너. 실제 금고로 가는 링크는 두지 않는다(데모는 폐쇄적으로 둘러보기만).
function DemoBanner() {
    return (
        <div
            role="note"
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                marginBottom: 14,
                borderRadius: 12,
                background: "var(--soft)",
                fontSize: 12.5,
                lineHeight: 1.5,
                color: "#555",
            }}
        >
            <span>
                <strong style={{ color: "#333" }}>데모 모드</strong> · 아래
                데이터는 모두 예시이며 실제 비밀번호가 아닙니다. 변경 사항은
                저장되지 않습니다.
            </span>
        </div>
    )
}

// 데모 항목 타임스탬프용. 실제 저장이 없으므로 표시 목적으로만 쓴다.
function nowIso(): string {
    return new Date().toISOString()
}

// 비밀번호 ↔ 가계부 탭 토글.
function DemoTabs({
    tab,
    onTab,
}: {
    tab: "secret" | "asset"
    onTab: (t: "secret" | "asset") => void
}) {
    const base: CSSProperties = {
        flex: 1,
        padding: "8px 0",
        fontSize: 13,
        fontWeight: 700,
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
    }
    return (
        <div
            style={{
                display: "flex",
                gap: 6,
                background: "var(--soft)",
                padding: 4,
                borderRadius: 12,
                margin: "12px 0 16px",
            }}
        >
            <button
                type="button"
                onClick={() => onTab("secret")}
                style={{
                    ...base,
                    background: tab === "secret" ? "#fff" : "transparent",
                    color:
                        tab === "secret" ? "#222" : "var(--color-text-muted)",
                }}
            >
                비밀번호
            </button>
            <button
                type="button"
                onClick={() => onTab("asset")}
                style={{
                    ...base,
                    background: tab === "asset" ? "#fff" : "transparent",
                    color: tab === "asset" ? "#222" : "var(--color-text-muted)",
                }}
            >
                가계부
            </button>
        </div>
    )
}
