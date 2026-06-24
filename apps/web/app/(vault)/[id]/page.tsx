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
    const { vaultKey, resetIdle } = useVault()
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
            <section>
                <header className="page-header">
                    <h1>항목을 찾을 수 없습니다</h1>
                    <Link className="btn secondary" href="/">
                        ← 목록
                    </Link>
                </header>
                <div className="empty">
                    요청한 항목이 존재하지 않거나 삭제되었습니다.
                </div>
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
                <header className="page-header">
                    <h1>항목 수정</h1>
                    <button
                        type="button"
                        className="btn secondary"
                        onClick={() => setMode("view")}
                    >
                        ← 취소
                    </button>
                </header>
                <div style={{ marginTop: 16 }}>
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
            <header className="page-header">
                <h1>{data.label}</h1>
                <Link className="btn secondary" href="/">
                    ← 목록
                </Link>
            </header>

            {error && (
                <div role="alert" className="error-box">
                    {error}
                </div>
            )}

            <section className="card" style={{ marginTop: 16 }}>
                <h2 className="section-title" style={{ marginTop: 0 }}>
                    제목·메타
                </h2>
                <dl style={{ display: "grid", gap: 8, margin: 0 }}>
                    <DetailRow label="제목" value={data.label} />
                    {categoryLabel && (
                        <DetailRow label="카테고리" value={categoryLabel} />
                    )}
                    <DetailRow
                        label="생성"
                        value={new Date(data.createdAt).toLocaleString("ko-KR")}
                    />
                    <DetailRow
                        label="수정"
                        value={new Date(data.updatedAt).toLocaleString("ko-KR")}
                    />
                </dl>
            </section>

            <section className="card" style={{ marginTop: 16 }}>
                <h2 className="section-title" style={{ marginTop: 0 }}>
                    필드
                </h2>
                <div style={{ display: "grid", gap: 8 }}>
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
                        <div
                            className="secret-plate"
                            style={{ display: "block" }}
                        >
                            <div className="secret-label">메모</div>
                            <div className="secret-memo">{data.memo}</div>
                        </div>
                    )}
                </div>
            </section>

            <section className="card" style={{ marginTop: 16 }}>
                <h2 className="section-title" style={{ marginTop: 0 }}>
                    액션
                </h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                        type="button"
                        className="btn"
                        onClick={() => setMode("edit")}
                    >
                        수정
                    </button>
                    <button
                        type="button"
                        className="btn danger"
                        onClick={() => setConfirmDelete(true)}
                    >
                        삭제
                    </button>
                </div>
            </section>

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
