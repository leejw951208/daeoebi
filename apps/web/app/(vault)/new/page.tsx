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
            <div
                className="sticky-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Link className="btn-text" href="/">
                    취소
                </Link>
                <div style={{ fontSize: 15, fontWeight: 700 }}>새 항목</div>
                <span style={{ width: 36 }} />
            </div>

            <div>
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
