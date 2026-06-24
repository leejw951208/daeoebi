// 글로벌 404. 잘못된 라우트 진입 시 한국어 안내와 보관함 복귀 링크를 제공한다(Ink 테마).
import Link from "next/link"

export default function NotFound() {
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
                페이지를 찾을 수 없어요
            </h1>
            <p
                className="muted"
                style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 240, marginBottom: 28 }}
            >
                요청하신 페이지가 존재하지 않거나 이동되었을 수 있어요. 보관함으로
                돌아가 다시 찾아보세요.
            </p>
            <Link className="btn" href="/">
                보관함으로 돌아가기
            </Link>
        </section>
    )
}
