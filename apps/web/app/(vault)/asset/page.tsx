// 자산 라우트 자리표시. 하단 탭바의 "자산" 탭 목적지로, 본 기능 구현 전까지 준비 중 안내만 보인다.
// (vault) route group 하위라 인증·잠금 상태와 하단 탭바를 layout 과 공유한다.
export default function AssetPage() {
    return (
        <section>
            <div className="sticky-header">
                <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.03em" }}>
                    자산
                </div>
            </div>

            <div
                style={{
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
                    ₩
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                    자산 관리 준비 중
                </div>
                <p
                    className="muted"
                    style={{ fontSize: 13.5, lineHeight: 1.5, maxWidth: 240 }}
                >
                    수입과 지출을 기록하고 한눈에 보는 기능을 곧 추가할 예정입니다.
                </p>
            </div>
        </section>
    )
}
