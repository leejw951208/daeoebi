"use client"
// 보관함 목록 화면. 기본 사이트의 시크릿 메타를 나열하고 카테고리 태그 필터 + 제목 검색을 제공한다.
// 상세는 /[id], 신규는 /new, 백업은 /backup 라우트에서 처리한다. 자동잠금 카운트다운·수동 잠그기 포함.
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
    listCategories,
    listSecrets,
    searchSecrets,
    type Category,
    type SecretMeta,
} from "@/lib/vault-client"
import { SkeletonCard } from "@/components/Skeleton"
import { useVault } from "./vault-context"
import { useDefaultSite } from "./use-default-site"

type ListState = "idle" | "loading" | "loaded" | "error"

export function EntriesScreen() {
    const router = useRouter()
    const search = useSearchParams()
    const { idleSecondsRemaining, onLock, resetIdle } = useVault()
    const { state: siteState, retry: retrySite } = useDefaultSite()

    const categoryFilter = search.get("cat") ?? "ALL"
    const query = search.get("q") ?? ""

    const [secrets, setSecrets] = useState<SecretMeta[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [state, setState] = useState<ListState>("idle")
    const [error, setError] = useState<string | null>(null)

    const siteId = siteState.status === "ready" ? siteState.siteId : null

    const reload = useCallback(async () => {
        if (!siteId) return
        setState("loading")
        try {
            const [cats, items] = await Promise.all([
                listCategories(siteId),
                query.trim()
                    ? searchSecrets(query.trim())
                    : listSecrets(
                          siteId,
                          categoryFilter !== "ALL"
                              ? categoryFilter
                              : undefined,
                      ),
            ])
            setCategories(cats)
            // 검색 결과에는 카테고리 필터를 클라이언트에서 한 번 더 적용한다.
            const filtered =
                query.trim() && categoryFilter !== "ALL"
                    ? items.filter((s) => s.categoryId === categoryFilter)
                    : items
            setSecrets(filtered)
            setState("loaded")
            setError(null)
        } catch (e) {
            setState("error")
            setError(e instanceof Error ? e.message : "알 수 없는 오류")
        }
    }, [siteId, query, categoryFilter])

    useEffect(() => {
        void reload()
    }, [reload])

    function updateFilter(next: { cat?: string; q?: string }) {
        resetIdle()
        const params = new URLSearchParams(search.toString())
        if (next.cat !== undefined) {
            if (next.cat === "ALL") params.delete("cat")
            else params.set("cat", next.cat)
        }
        if (next.q !== undefined) {
            if (!next.q) params.delete("q")
            else params.set("q", next.q)
        }
        const qs = params.toString()
        router.replace(qs ? `/?${qs}` : "/", { scroll: false })
    }

    const categoryLabel = useCallback(
        (id: string | null) =>
            id ? (categories.find((c) => c.id === id)?.label ?? null) : null,
        [categories],
    )

    const idleWarning = useMemo(() => {
        if (idleSecondsRemaining > 60) return null
        return `${idleSecondsRemaining}초 후 자동 잠금됩니다.`
    }, [idleSecondsRemaining])

    if (siteState.status === "error") {
        return (
            <section>
                <h1>비밀번호 보관함</h1>
                <div role="alert" className="error-box">
                    {siteState.message}
                </div>
                <button
                    type="button"
                    className="btn secondary"
                    style={{ marginTop: 12 }}
                    onClick={retrySite}
                >
                    다시 시도
                </button>
            </section>
        )
    }

    return (
        <section>
            <header className="page-header" style={{ alignItems: "center" }}>
                <div style={{ display: "grid", gap: 4 }}>
                    <span className="eyebrow">Secrets · Vault</span>
                    <h1>비밀번호 보관함</h1>
                </div>
                <div className="entry-side">
                    <span
                        className={`lock-timer${idleSecondsRemaining <= 60 ? " urgent" : ""}`}
                        aria-live="polite"
                        aria-label={`자동 잠금까지 ${Math.max(0, idleSecondsRemaining)}초`}
                    >
                        <span className="dot" aria-hidden="true" />
                        {formatMmSs(Math.max(0, idleSecondsRemaining))}
                    </span>
                    <button
                        type="button"
                        className="btn secondary"
                        onClick={onLock}
                    >
                        잠그기
                    </button>
                </div>
            </header>

            {idleWarning && (
                <div role="alert" className="error-box">
                    {idleWarning}
                </div>
            )}

            <nav
                aria-label="보관함 관리"
                className="toolbar"
                style={{ marginTop: 20 }}
            >
                <Link className="btn secondary" href="/backup">
                    백업·복원
                </Link>
                <Link className="btn push-end" href="/new">
                    + 항목 추가
                </Link>
            </nav>

            <div
                style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 8,
                }}
            >
                <select
                    className="field-control"
                    value={categoryFilter}
                    onChange={(e) => updateFilter({ cat: e.target.value })}
                    aria-label="카테고리 필터"
                    style={{ width: "auto" }}
                >
                    <option value="ALL">전체</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.label}
                        </option>
                    ))}
                </select>
                <input
                    className="field-control"
                    type="search"
                    placeholder="제목 검색"
                    value={query}
                    onChange={(e) => updateFilter({ q: e.target.value })}
                    style={{ flex: 1, minWidth: 200 }}
                    aria-label="제목 검색"
                />
            </div>

            {error && (
                <div
                    role="alert"
                    className="error-box"
                    style={{ marginTop: 12 }}
                >
                    {error}
                </div>
            )}

            <div style={{ marginTop: 16 }}>
                {(state === "loading" || siteState.status === "loading") && (
                    <SkeletonCard lines={3} />
                )}
                {state === "loaded" && secrets.length === 0 && (
                    <div className="empty">
                        {query.trim()
                            ? "검색 결과가 없습니다."
                            : "아직 보관된 항목이 없습니다. 첫 항목을 추가하세요."}
                    </div>
                )}
                {state === "loaded" && secrets.length > 0 && (
                    <ul className="entry-list">
                        {secrets.map((secret) => {
                            const cat = categoryLabel(secret.categoryId)
                            return (
                                <li key={secret.id}>
                                    <Link
                                        href={`/${secret.id}`}
                                        className="entry-card"
                                    >
                                        <span className="entry-main">
                                            <span className="entry-label">
                                                {secret.label}
                                            </span>
                                        </span>
                                        <span className="entry-side">
                                            {cat && (
                                                <span className="cat-badge">
                                                    {cat}
                                                </span>
                                            )}
                                            <span
                                                className="entry-chevron"
                                                aria-hidden="true"
                                            >
                                                ›
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </section>
    )
}

// 초 → m:ss. 자동 잠금 타이머 표시용.
function formatMmSs(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${String(s).padStart(2, "0")}`
}
