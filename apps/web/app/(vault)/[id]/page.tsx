"use client"
// 시크릿 상세 라우트. 블롭을 받아 VK 로 복호화해 제목·필드·메모를 보여준다. view ↔ edit 토글.
import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
    deleteSecret,
    getSecret,
    listCategories,
    type Category,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { SkeletonCard } from "@/components/Skeleton"
import { CopyField } from "../CopyField"
import { SecretForm, type SecretFormInitial } from "../SecretForm"
import { useVault, type SecretField } from "../vault-context"
import { openPayload } from "../secret-payload"
import { isSensitiveFieldName } from "../field-suggestions"

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
    const { vaultKey, resetIdle, idleSecondsRemaining, onLock } = useVault()
    const [data, setData] = useState<Loaded | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [state, setState] = useState<LoadState>("idle")
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<"view" | "edit">("view")
    const [confirmDelete, setConfirmDelete] = useState(false)
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
            void listCategories(detail.siteId)
                .then(setCategories)
                .catch(() => undefined)
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
                      ? "복호화에 실패했습니다. 보관함 키가 일치하지 않습니다."
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
        setConfirmDelete(false)
        setError(null)
        try {
            await deleteSecret(data.id)
            router.push("/")
            startTransition(() => router.refresh())
        } catch (e) {
            setError((e as Error).message)
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
                    style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 240, marginBottom: 28 }}
                >
                    삭제되었거나 주소가 잘못되었을 수 있어요. 보관함으로 돌아가 다시
                    찾아보세요.
                </p>
                <Link className="btn" href="/">
                    보관함으로 돌아가기
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

    const categoryLabel = data.categoryId
        ? (categories.find((c) => c.id === data.categoryId)?.label ?? null)
        : null

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
                        onClick={() => setMode("view")}
                    >
                        취소
                    </button>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>항목 수정</div>
                    <span style={{ width: 36 }} />
                </div>
                <div>
                    <SecretForm
                        siteId={data.siteId}
                        initial={initial}
                        onSuccess={async () => {
                            setMode("view")
                            await reload()
                        }}
                        onCancel={() => setMode("view")}
                    />
                </div>
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
                <button
                    type="button"
                    className={`lock-timer${idleSecondsRemaining <= 60 ? " urgent" : ""}`}
                    onClick={onLock}
                    aria-label={`자동 잠금까지 ${Math.max(0, idleSecondsRemaining)}초. 지금 잠그기`}
                >
                    <span className="dot" aria-hidden="true" />
                    {formatMmSs(Math.max(0, idleSecondsRemaining))}
                </button>
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
                    <span className="avatar lg" aria-hidden="true">
                        {data.label.trim()[0] ?? "·"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{ fontSize: 21 }}>{data.label}</h1>
                        {categoryLabel && (
                            <span className="entry-sub">{categoryLabel}</span>
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
                            sensitive={isSensitiveFieldName(field.name)}
                            onActivity={resetIdle}
                        />
                    ))}
                    {data.memo && (
                        <div className="secret-plate">
                            <div className="secret-label" style={{ marginBottom: 6 }}>
                                메모
                            </div>
                            <div className="secret-memo">{data.memo}</div>
                        </div>
                    )}
                </div>

                <dl
                    className="secret-plate"
                    style={{ marginTop: 9, display: "grid", gap: 8 }}
                >
                    <DetailRow
                        label="생성"
                        value={new Date(data.createdAt).toLocaleString("ko-KR")}
                    />
                    <DetailRow
                        label="수정"
                        value={new Date(data.updatedAt).toLocaleString("ko-KR")}
                    />
                </dl>

                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button
                        type="button"
                        className="btn secondary"
                        style={{ flex: 1, minHeight: 48 }}
                        onClick={() => setMode("edit")}
                    >
                        수정
                    </button>
                    <button
                        type="button"
                        className="btn danger"
                        style={{ flex: 1, minHeight: 48 }}
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
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete(false)}
            />
        </section>
    )
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="detail-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
        </div>
    )
}

// 초 → m:ss. 자동 잠금 타이머 표시용.
function formatMmSs(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${String(s).padStart(2, "0")}`
}
