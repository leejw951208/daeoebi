"use client"
// 복구코드 발급 화면. 표시·복사·다운로드 후 "저장했습니다" 확인을 받아야 완료된다.
import { useState } from "react"

interface Props {
    code: string
    onConfirmed: () => void
}

export function RecoveryCodeDisplay({ code, onConfirmed }: Props) {
    const [copied, setCopied] = useState(false)
    const [downloaded, setDownloaded] = useState(false)
    const [acknowledged, setAcknowledged] = useState(false)
    const [status, setStatus] = useState("")

    async function handleCopy() {
        try {
            if (typeof navigator === "undefined" || !navigator.clipboard) {
                setStatus("이 환경에선 클립보드를 사용할 수 없습니다.")
                return
            }
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setStatus("복구코드를 클립보드에 복사했습니다.")
        } catch {
            setStatus("복사에 실패했습니다. 직접 받아 적어 주세요.")
        }
    }

    function handleDownload() {
        const blob = new Blob(
            [
                "대외비 복구코드\n",
                "분실 시 이 코드로만 대외비를 복구할 수 있습니다. 안전한 곳에 보관하세요.\n\n",
                code,
                "\n",
            ],
            { type: "text/plain" },
        )
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `daeoebi-recovery-${new Date().toISOString().slice(0, 10)}.txt`
        a.click()
        URL.revokeObjectURL(url)
        setDownloaded(true)
        setStatus("복구코드 파일을 다운로드했습니다.")
    }

    const saved = copied || downloaded
    // 그룹 표기(4글자-…)를 2열 그리드 셀로 분해한다.
    const parts = code.split("-")

    return (
        <section
            style={{
                maxWidth: 480,
                margin: "0 auto",
                padding: "54px 24px 28px",
                background: "#fff",
                display: "flex",
                flexDirection: "column",
                minHeight: "100dvh",
            }}
        >
            <div
                style={{ display: "flex", gap: 6, marginBottom: 26 }}
                aria-hidden="true"
            >
                <span
                    style={{
                        width: 18,
                        height: 5,
                        borderRadius: 3,
                        background: "#dcdcdc",
                    }}
                />
                <span
                    style={{
                        width: 18,
                        height: 5,
                        borderRadius: 3,
                        background: "#171717",
                    }}
                />
            </div>
            <h1 style={{ fontSize: 24 }}>복구코드를 저장하세요</h1>
            <p
                className="muted"
                style={{
                    marginTop: 8,
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "#6b6b6b",
                }}
            >
                기기를 잃어버리면 이 코드로만 대외비를 되찾을 수 있습니다. 화면
                캡처 대신 안전한 곳에 따로 보관하세요.
            </p>

            <div className="recovery-box" style={{ marginTop: 22 }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#999",
                        letterSpacing: "0.08em",
                        marginBottom: 14,
                    }}
                >
                    RECOVERY CODE
                </div>
                <div
                    className="recovery-grid"
                    role="text"
                    aria-label={`복구코드 ${code}`}
                >
                    {parts.map((p, i) => (
                        <div key={i}>{p}</div>
                    ))}
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 8,
                    marginBottom: "auto",
                }}
            >
                <button
                    type="button"
                    className="btn secondary"
                    style={{
                        flex: 1,
                        minHeight: 48,
                        fontSize: 14,
                        borderRadius: 14,
                        color: "#222",
                    }}
                    onClick={handleCopy}
                >
                    {copied ? "✓ 복사됨" : "복사"}
                </button>
                <button
                    type="button"
                    className="btn secondary"
                    style={{
                        flex: 1,
                        minHeight: 48,
                        fontSize: 14,
                        borderRadius: 14,
                        color: "#222",
                    }}
                    onClick={handleDownload}
                >
                    {downloaded ? "✓ 다운로드됨" : "다운로드"}
                </button>
            </div>

            <label className="ack-label" style={{ marginTop: 20 }}>
                <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        padding: 0,
                        margin: -1,
                        overflow: "hidden",
                        clip: "rect(0,0,0,0)",
                        whiteSpace: "nowrap",
                        border: 0,
                    }}
                />
                <span
                    aria-hidden="true"
                    style={{
                        flex: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        border: `2px solid ${acknowledged ? "#171717" : "#d2d2d2"}`,
                        background: acknowledged ? "#171717" : "#fff",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 800,
                        lineHeight: 1,
                    }}
                >
                    {acknowledged ? "✓" : ""}
                </span>
                <span
                    style={{
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        color: "#444",
                        fontWeight: 500,
                    }}
                >
                    복구코드를 안전한 곳에 보관했습니다.
                </span>
            </label>

            <button
                type="button"
                className="btn"
                style={{ width: "100%", marginTop: 12 }}
                disabled={!saved || !acknowledged}
                onClick={onConfirmed}
            >
                완료하고 대외비 열기
            </button>

            <span
                role="status"
                aria-live="polite"
                style={{ position: "absolute", left: -9999 }}
            >
                {status}
            </span>
        </section>
    )
}
