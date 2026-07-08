"use client"
// 대외비 목록 화면. 기본 사이트의 시크릿 메타를 나열하고 제목 검색을 제공한다.
// 상세는 /[id], 신규는 /new(우하단 FAB), 백업은 /backup 라우트에서 처리한다. 자동잠금 카운트다운·수동 잠그기 포함.
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { listSecrets, searchSecrets, type SecretMeta } from "@/lib/vault-client"
import { toast } from "@/components/toast"
import { useVault } from "../_lib/vault-context"
import { useDefaultSite } from "../_lib/use-default-site"
import { LockTimer } from "./LockTimer"

type ListState = "idle" | "loading" | "loaded" | "error"

export function EntriesScreen() {
    const { resetIdle } = useVault()
    const { state: siteState, retry: retrySite } = useDefaultSite()

    // 검색은 전적으로 로컬 상태로 구동한다(URL 미사용). input 은 입력 박스가 즉시 반영하고,
    // query 는 디바운스된 검색어다. URL(q)·router.replace 를 쓰면 (1) 매 커밋마다 RSC 왕복으로
    // 느려지고 (2) q→input 되돌림 동기화가 빠른 타이핑·한글 IME 조합과 충돌해 글자가 사라졌다.
    const [input, setInput] = useState("")
    const [query, setQuery] = useState("")
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [secrets, setSecrets] = useState<SecretMeta[]>([])
    const [state, setState] = useState<ListState>("idle")

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    const siteId = siteState.status === "ready" ? siteState.siteId : null

    useEffect(() => {
        if (!siteId) return
        let cancelled = false
        setState("loading")
        const load = query.trim()
            ? searchSecrets(query.trim())
            : listSecrets(siteId)
        load.then((items) => {
            if (cancelled) return
            setSecrets(items)
            setState("loaded")
        }).catch((e) => {
            if (cancelled) return
            setState("error")
            toast(e instanceof Error ? e.message : "알 수 없는 오류")
        })
        return () => {
            cancelled = true
        }
    }, [siteId, query])

    function onSearchChange(value: string) {
        resetIdle()
        setInput(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => setQuery(value.trim()), 250)
    }

    if (siteState.status === "error") {
        return (
            <section>
                <h1>대외비</h1>
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
        <section
            style={{
                minHeight: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
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
                                color: "#9a9a9a",
                                fontWeight: 500,
                            }}
                        >
                            {secrets.length}개 항목
                        </div>
                    </div>
                    <LockTimer />
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
                        value={input}
                        onChange={(e) => onSearchChange(e.target.value)}
                        aria-label="제목 검색"
                    />
                </div>
            </div>

            <nav
                aria-label="대외비 관리"
                className="toolbar"
                style={{ padding: "16px 18px 0", margin: 0 }}
            >
                <Link
                    href="/backup"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        height: 38,
                        padding: "0 15px",
                        border: "1px solid #ececec",
                        borderRadius: 999,
                        background: "#fff",
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "#444",
                    }}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M12 3v12" />
                        <path d="M8 11l4 4 4-4" />
                        <path d="M5 20h14" />
                    </svg>
                    백업·복원
                </Link>
            </nav>

            {state === "loaded" && secrets.length > 0 && (
                <ul
                    className="entry-list stagger"
                    style={{ padding: "14px 16px 96px", flex: 1 }}
                >
                    {secrets.map((secret) => (
                        <li key={secret.id}>
                            <Link href={`/${secret.id}`} className="entry-card">
                                <span className="avatar" aria-hidden="true">
                                    {firstChar(secret.label)}
                                </span>
                                <span className="entry-main">
                                    <span className="entry-label">
                                        {secret.label}
                                    </span>
                                </span>
                                <span className="entry-side">
                                    <svg
                                        className="entry-chevron"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M9 6l6 6-6 6" />
                                    </svg>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            {state === "loaded" && secrets.length === 0 && !query.trim() && (
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 40,
                        textAlign: "center",
                        animation: "fadeUp 0.4s both",
                    }}
                >
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 20,
                            background: "var(--soft)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 26,
                            color: "#bbb",
                            marginBottom: 18,
                        }}
                        aria-hidden="true"
                    >
                        +
                    </div>
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: 6,
                        }}
                    >
                        아직 항목이 없어요
                    </div>
                    <p
                        style={{
                            fontSize: 13.5,
                            color: "#9a9a9a",
                            lineHeight: 1.5,
                            maxWidth: 220,
                        }}
                    >
                        첫 번째 비밀번호를 추가하면 여기에 안전하게 보관됩니다.
                    </p>
                </div>
            )}
            {state === "loaded" && secrets.length === 0 && query.trim() && (
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 40,
                        textAlign: "center",
                        animation: "fadeUp 0.4s both",
                    }}
                >
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 20,
                            background: "var(--soft)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#bbb",
                            marginBottom: 18,
                        }}
                        aria-hidden="true"
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="M20.5 20.5 16 16" />
                        </svg>
                    </div>
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: 6,
                        }}
                    >
                        검색 결과가 없어요
                    </div>
                    <p
                        style={{
                            fontSize: 13.5,
                            color: "#9a9a9a",
                            lineHeight: 1.5,
                            maxWidth: 220,
                        }}
                    >
                        ‘{query.trim()}’와 일치하는 항목을 찾지 못했어요. 다른
                        이름으로 검색해 보세요.
                    </p>
                </div>
            )}

            <Link className="fab" href="/new" aria-label="새 항목 추가">
                <span aria-hidden="true">+</span>
            </Link>
        </section>
    )
}

// 라벨의 첫 글자(아바타 이니셜). 비어 있으면 자물쇠 기호로 대체한다.
function firstChar(label: string): string {
    return label.trim()[0] ?? "·"
}
