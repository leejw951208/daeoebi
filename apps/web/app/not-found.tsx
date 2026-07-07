"use client"
// 글로벌 404. 잘못된 라우트 진입 시 한국어 안내와 대외비 복귀 링크를 제공한다(Ink 테마).
// 디자인 mock 처럼 풀스크린 챙(하단 탭바 없이)으로 노출한다 — VaultGate 밖 라우트라
// data-auth-screen 을 직접 건다.
import { useEffect } from "react"
import Link from "next/link"

export default function NotFound() {
    useEffect(() => {
        const root = document.documentElement
        root.setAttribute("data-auth-screen", "")
        return () => root.removeAttribute("data-auth-screen")
    }, [])

    return (
        <section
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                minHeight: "100dvh",
                background: "var(--tint)",
                padding: 40,
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
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                항목을 찾을 수 없어요
            </h1>
            <p
                className="muted"
                style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "#8a8a8a",
                    maxWidth: 240,
                    marginBottom: 28,
                }}
            >
                삭제되었거나 주소가 잘못되었을 수 있어요. 대외비로 돌아가 다시
                찾아보세요.
            </p>
            <Link
                className="btn"
                href="/"
                style={{
                    borderRadius: 14,
                    boxShadow: "none",
                    height: 50,
                    minHeight: 50,
                    fontSize: 15,
                    padding: "0 28px",
                }}
            >
                보관함으로 돌아가기
            </Link>
        </section>
    )
}
