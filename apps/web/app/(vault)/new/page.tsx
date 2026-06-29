"use client"
// 시크릿 신규 추가 라우트. 기본 사이트를 해석한 뒤 SecretForm 을 빈 상태로 mount 한다.
// 단계별 sticky 헤더(취소/제목/다음, ← 수정/저장 전 확인)는 SecretForm 이 직접 그린다.
import { useRouter } from "next/navigation"
import { SecretForm } from "../_components/secret-form/SecretForm"
import { useDefaultSite } from "../_lib/use-default-site"

export default function NewSecretPage() {
    const router = useRouter()
    const { state, retry } = useDefaultSite()

    return (
        <section>
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
        </section>
    )
}
