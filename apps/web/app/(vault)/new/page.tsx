"use client"
// 시크릿 신규 추가 라우트. 기본 사이트를 해석한 뒤 SecretForm 을 빈 상태로 mount 한다.
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SecretForm } from "../SecretForm"
import { useDefaultSite } from "../use-default-site"

export default function NewSecretPage() {
    const router = useRouter()
    const { state, retry } = useDefaultSite()

    return (
        <section>
            <header
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                }}
            >
                <div style={{ display: "grid", gap: 4 }}>
                    <span className="eyebrow">New Entry</span>
                    <h1>새 항목 추가</h1>
                </div>
                <Link className="btn secondary" href="/">
                    ← 목록
                </Link>
            </header>

            <div style={{ marginTop: 16 }}>
                {state.status === "loading" && (
                    <p className="muted">준비 중입니다.</p>
                )}
                {state.status === "error" && (
                    <>
                        <div role="alert" className="error-box">
                            {state.message}
                        </div>
                        <button
                            type="button"
                            className="btn secondary"
                            style={{ marginTop: 12 }}
                            onClick={retry}
                        >
                            다시 시도
                        </button>
                    </>
                )}
                {state.status === "ready" && (
                    <SecretForm
                        siteId={state.siteId}
                        initial={null}
                        onSuccess={() => {
                            router.push("/")
                            router.refresh()
                        }}
                        onCancel={() => router.push("/")}
                    />
                )}
            </div>
        </section>
    )
}
