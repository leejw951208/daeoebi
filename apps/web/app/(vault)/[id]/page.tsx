"use client"
// 시크릿 상세 라우트. 블롭을 받아 VK 로 복호화해 제목·필드·메모를 보여준다. view ↔ edit 토글.
import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { deleteSecret, getSecret } from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { SkeletonCard } from "@/components/Skeleton"
import { CopyField } from "../_components/CopyField"
import {
    SecretForm,
    type SecretFormInitial,
} from "../_components/secret-form/SecretForm"
import { useVault, type SecretField } from "../_lib/vault-context"
import { openPayload } from "../_lib/secret-payload"
import { isSensitiveFieldName } from "../_lib/field-suggestions"
import { LockTimer } from "../_components/LockTimer"

type LoadState = "idle" | "loading" | "loaded" | "missing" | "error"

interface Loaded {
    id: string
    siteId: string
    categoryId: string | null
    label: string
    fields: SecretField[]
    memo: string
    createdAt: string
    updatedAt: string
}

export default function SecretDetailPage() {
    const params = useParams<{ id: string }>()
    const id = params?.id
    const router = useRouter()
    const { vaultKey, resetIdle } = useVault()
    const [data, setData] = useState<Loaded | null>(null)
    const [state, setState] = useState<LoadState>("idle")
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<"view" | "edit">("view")
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const [, startTransition] = useTransition()

    const reload = useCallback(async () => {
        if (!id) return
        setState("loading")
        try {
            const detail = await getSecret(id)
            // 블롭을 VK 로 복호화해 필드·메모를 복원한다.
            const payload = await openPayload(vaultKey, {
                iv: detail.iv,
                ciphertext: detail.ciphertext,
                authTag: detail.authTag,
            })
            setData({
                id: detail.id,
                siteId: detail.siteId,
                categoryId: detail.categoryId,
                label: detail.label,
                fields: payload.fields,
                memo: payload.memo,
                createdAt: detail.createdAt,
                updatedAt: detail.updatedAt,
            })
            setState("loaded")
            setError(null)
        } catch (e) {
            if (isApiError(e) && e.status === 404) {
                setState("missing")
                return
            }
            setState("error")
            // 복호화 실패(DOMException)는 키 불일치/손상 안내로 바꾼다.
            setError(
                isApiError(e)
                    ? e.message
                    : e instanceof Error && e.name === "OperationError"
                      ? "복호화에 실패했습니다. 대외비 키가 일치하지 않습니다."
                      : e instanceof Error
                        ? e.message
                        : "알 수 없는 오류",
            )
        }
    }, [id, vaultKey])

    useEffect(() => {
        void reload()
    }, [reload])

    async function handleDelete() {
        if (!data) return
        setDeleteBusy(true)
        setError(null)
        try {
            await deleteSecret(data.id)
            router.push("/")
            startTransition(() => router.refresh())
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setDeleteBusy(false)
            setConfirmDelete(false)
        }
    }

    if (state === "loading" || state === "idle") {
        return (
            <section>
                <h1>항목 상세</h1>
                <SkeletonCard lines={3} />
            </section>
        )
    }

    if (state === "missing") {
        return (
            <section
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    minHeight: "70vh",
                }}
            >
                <div
                    className="pop"
                    style={{
                        fontSize: 72,
                        fontWeight: 800,
                        letterSpacing: "-0.04em",
                        color: "var(--ac)",
                        lineHeight: 1,
                        marginBottom: 8,
                    }}
                    aria-hidden="true"
                >
                    404
                </div>
                <h1 style={{ fontSize: 18, marginBottom: 8 }}>
                    항목을 찾을 수 없어요
                </h1>
                <p
                    className="muted"
                    style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        maxWidth: 240,
                        marginBottom: 28,
                    }}
                >
                    삭제되었거나 주소가 잘못되었을 수 있어요. 대외비로 돌아가
                    다시 찾아보세요.
                </p>
                <Link className="btn" href="/">
                    대외비로 돌아가기
                </Link>
            </section>
        )
    }

    if (state === "error" || !data) {
        return (
            <section>
                <header className="page-header">
                    <h1>오류</h1>
                    <Link className="btn secondary" href="/">
                        ← 목록
                    </Link>
                </header>
                <div role="alert" className="error-box">
                    {error}
                </div>
            </section>
        )
    }

    if (mode === "edit") {
        const initial: SecretFormInitial = {
            id: data.id,
            label: data.label,
            categoryId: data.categoryId,
            fields: data.fields,
            memo: data.memo,
        }
        return (
            <section>
                <SecretForm
                    siteId={data.siteId}
                    initial={initial}
                    onSuccess={async () => {
                        setMode("view")
                        await reload()
                    }}
                    onCancel={() => setMode("view")}
                />
            </section>
        )
    }

    return (
        <section>
            <div
                className="sticky-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Link className="btn-text" href="/">
                    ← 보관함
                </Link>
                <LockTimer compact bare />
            </div>

            {error && (
                <div role="alert" className="error-box">
                    {error}
                </div>
            )}

            <div className="stagger">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginBottom: 22,
                    }}
                >
                    <span className="avatar" aria-hidden="true">
                        {data.label.trim()[0] ?? "·"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{ fontSize: 21 }}>{data.label}</h1>
                        {data.createdAt && (
                            <div
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    marginTop: 6,
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    background: "var(--soft)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#8a8a8a",
                                }}
                            >
                                {`수정 ${formatDateChip(data.updatedAt || data.createdAt)} · 생성 ${formatDateChip(data.createdAt)}`}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: "grid", gap: 9 }}>
                    {data.fields.length === 0 && (
                        <p className="muted">등록된 필드가 없습니다.</p>
                    )}
                    {data.fields.map((field, idx) => (
                        <CopyField
                            key={`${field.name}-${idx}`}
                            label={field.name}
                            value={field.value}
                            sensitive={
                                field.sensitive ??
                                isSensitiveFieldName(field.name)
                            }
                            onActivity={resetIdle}
                        />
                    ))}
                    {data.memo && (
                        <div className="secret-plate">
                            <div
                                className="secret-label"
                                style={{ marginBottom: 6, color: "#a0a0a0" }}
                            >
                                메모
                            </div>
                            <div className="secret-memo">{data.memo}</div>
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button
                        type="button"
                        className="btn secondary"
                        style={{ flex: 1, minHeight: 48, fontSize: 14 }}
                        onClick={() => setMode("edit")}
                    >
                        수정
                    </button>
                    <button
                        type="button"
                        className="btn danger"
                        style={{ flex: 1, minHeight: 48, fontSize: 14 }}
                        onClick={() => setConfirmDelete(true)}
                    >
                        삭제
                    </button>
                </div>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                title="항목 삭제"
                message="정말 삭제하시겠습니까?"
                confirmLabel="삭제"
                destructive
                confirmLoading={deleteBusy}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete(false)}
            />
        </section>
    )
}

// 상세 제목 아래 칩에 쓰는 날짜 포맷(YYYY.MM.DD).
function formatDateChip(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}.${m}.${day}`
}
