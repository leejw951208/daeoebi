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
        <section style={{ maxWidth: 480, margin: "0 auto", paddingTop: 24 }}>
            <div
                className="progress-dots"
                style={{ marginBottom: 26 }}
                aria-hidden="true"
            >
                <span className="dot" />
                <span className="dot active" />
            </div>
            <h1>복구코드를 저장하세요</h1>
            <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
                기기를 잃어버리면 이 코드로만 대외비를 되찾을 수 있습니다. 화면 캡처
                대신 안전한 곳에 따로 보관하세요. 서버에는 저장되지 않습니다.
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

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                    type="button"
                    className="btn secondary"
                    style={{ flex: 1, minHeight: 48 }}
                    onClick={handleCopy}
                >
                    {copied ? "✓ 복사됨" : "복사"}
                </button>
                <button
                    type="button"
                    className="btn secondary"
                    style={{ flex: 1, minHeight: 48 }}
                    onClick={handleDownload}
                >
                    {downloaded ? "✓ 다운로드됨" : "다운로드"}
                </button>
            </div>

            <label
                className="ack-label"
                style={{ marginTop: 20 }}
            >
                <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "#444", fontWeight: 500 }}>
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
