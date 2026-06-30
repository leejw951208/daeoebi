"use client"
// 시크릿 상세 라우트. 블롭을 받아 VK 로 복호화해 제목·필드·메모를 보여준다. view ↔ edit 토글.
import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { deleteSecret, getSecret, updateSecret } from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { SkeletonCard } from "@/components/Skeleton"
import { CopyField } from "../_components/CopyField"
import {
    SecretForm,
    type SecretFormInitial,
} from "../_components/secret-form/SecretForm"
import { useVault, type SecretField } from "../_lib/vault-context"
import { openPayload, sealPayload } from "../_lib/secret-payload"
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
    // 삭제 확인 중인 필드 인덱스(null 이면 다이얼로그 닫힘). 필드 단위 삭제용.
    const [fieldToDelete, setFieldToDelete] = useState<number | null>(null)
    const [fieldBusy, setFieldBusy] = useState(false)
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

    // 단일 필드 삭제. 나머지 필드·메모만 다시 암호화해 저장한 뒤 재조회한다.
    async function handleDeleteField(idx: number) {
        if (!data) return
        setFieldBusy(true)
        setError(null)
        try {
            const nextFields = data.fields.filter((_, i) => i !== idx)
            const blob = await sealPayload(vaultKey, {
                fields: nextFields,
                memo: data.memo,
            })
            await updateSecret(data.id, {
                label: data.label,
                categoryId: data.categoryId,
                iv: blob.iv,
                ciphertext: blob.ciphertext,
                authTag: blob.authTag,
            })
            await reload()
        } catch (e) {
            setError(isApiError(e) ? e.message : (e as Error).message)
        } finally {
            setFieldBusy(false)
            setFieldToDelete(null)
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
                    ← 대외비
                </Link>
                <LockTimer compact />
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
                            onDelete={
                                fieldBusy
                                    ? undefined
                                    : () => {
                                          resetIdle()
                                          setFieldToDelete(idx)
                                      }
                            }
                        />
                    ))}
                    {data.memo && (
                        <div className="secret-plate">
                            <div
                                className="secret-label"
                                style={{ marginBottom: 6 }}
                            >
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
                confirmLoading={deleteBusy}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete(false)}
            />

            <ConfirmDialog
                open={fieldToDelete !== null}
                title="필드 삭제"
                message={
                    fieldToDelete !== null && data.fields[fieldToDelete]
                        ? `"${data.fields[fieldToDelete].name}" 필드를 삭제하시겠습니까?`
                        : "이 필드를 삭제하시겠습니까?"
                }
                confirmLabel="삭제"
                destructive
                confirmLoading={fieldBusy}
                onConfirm={() => {
                    if (fieldToDelete !== null)
                        void handleDeleteField(fieldToDelete)
                }}
                onCancel={() => setFieldToDelete(null)}
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
