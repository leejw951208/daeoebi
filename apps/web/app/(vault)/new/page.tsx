"use client"
// vault entry 신규 추가 라우트. CategoryForm 을 빈 상태로 mount 한다.
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CategoryForm } from "../CategoryForm"

export default function NewVaultEntryPage() {
    const router = useRouter()

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
                <CategoryForm
                    entry={null}
                    onSuccess={() => {
                        router.push("/")
                        router.refresh()
                    }}
                    onCancel={() => router.push("/")}
                />
            </div>
        </section>
    )
}
