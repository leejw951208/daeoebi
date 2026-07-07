"use client"
// 백업/복원 패널. E2E 암호문 패스스루이므로 별도 마스터 입력이 없다. export 다운로드 + import 업로드 + 충돌 모드 선택.
import { ChangeEvent, useRef, useState } from "react"
import { exportStore, importStore, type ImportMode } from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { Button } from "@/components/Button"

interface Props {
    onImported: () => Promise<void> | void
}

export function BackupPanel({ onImported }: Props) {
    const [status, setStatus] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [mode, setMode] = useState<ImportMode>("reject")
    const [pendingName, setPendingName] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)

    async function handleExport() {
        setBusy(true)
        setStatus(null)
        setError(null)
        try {
            const blob = await exportStore()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `daeoebi-backup-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
            setStatus("백업 파일을 다운로드했습니다.")
        } catch (e) {
            setError(isApiError(e) ? e.message : (e as Error).message)
        } finally {
            setBusy(false)
        }
    }

    function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
        setError(null)
        setStatus(null)
        const file = e.target.files?.[0]
        if (!file) {
            setPendingName(null)
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            try {
                // E2E 백업은 암호문 블롭이 담긴 JSON 이다. 파싱만 하고 복호화하지 않는다.
                const parsed = JSON.parse(reader.result as string)
                setPendingName(file.name)
                void runImport(parsed)
            } catch {
                setError("백업 파일이 올바른 JSON 형식이 아닙니다.")
                setPendingName(null)
            }
        }
        reader.onerror = () => {
            setError("파일을 읽지 못했습니다.")
            setPendingName(null)
        }
        reader.readAsText(file)
    }

    async function runImport(payload: unknown) {
        setBusy(true)
        setStatus(null)
        setError(null)
        try {
            const result = await importStore(payload, mode)
            const line = (label: string, c: typeof result.secrets) =>
                `${label} 추가 ${c.created} / 건너뜀 ${c.skipped} / 덮어쓰기 ${c.replaced}`
            setStatus(
                `복원 완료. ${line("비밀번호", result.secrets)}, ${line("카테고리", result.categories)}, ${line("사이트", result.sites)}.`,
            )
            setPendingName(null)
            if (inputRef.current) inputRef.current.value = ""
            await onImported()
        } catch (e) {
            setError(isApiError(e) ? e.message : (e as Error).message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div
            className="stagger"
            style={{ display: "grid", gap: 14 }}
            aria-label="백업과 복원"
        >
            {/* 내보내기 카드 */}
            <section
                className="card"
                style={{ background: "var(--tint)", padding: 20 }}
            >
                <h2
                    style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}
                >
                    암호화 백업 내보내기
                </h2>
                <p
                    style={{
                        fontSize: 13.5,
                        lineHeight: 1.55,
                        color: "#777",
                        margin: "0 0 16px",
                    }}
                >
                    모든 항목을 암호화된 파일로 내보냅니다. 파일을 열려면
                    복구코드가 필요합니다.
                </p>
                <Button
                    variant="primary"
                    style={{
                        width: "100%",
                        height: 50,
                        minHeight: 50,
                        borderRadius: 14,
                        fontSize: 15,
                        boxShadow: "none",
                    }}
                    onClick={handleExport}
                    loading={busy}
                >
                    백업 파일 다운로드
                </Button>
            </section>

            {/* 가져오기 카드 */}
            <section className="card" style={{ padding: 20 }}>
                <h2
                    style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}
                >
                    복원 가져오기
                </h2>
                <p
                    style={{
                        fontSize: 13.5,
                        lineHeight: 1.55,
                        color: "#777",
                        margin: "0 0 14px",
                    }}
                >
                    백업 파일을 선택하고 충돌 처리 방식을 고르세요.
                </p>

                {/* dashed 드롭존 (파일 선택) */}
                <label
                    htmlFor="import-file"
                    style={{
                        display: "block",
                        border: "1.5px dashed #d8d8d8",
                        borderRadius: 14,
                        padding: 22,
                        textAlign: "center",
                        background: "var(--tint)",
                        marginBottom: 16,
                        cursor: busy ? "not-allowed" : "pointer",
                    }}
                >
                    <div
                        aria-hidden="true"
                        style={{ fontSize: 24, color: "#ccc", marginBottom: 6 }}
                    >
                        ⤓
                    </div>
                    <div
                        style={{
                            fontSize: 13.5,
                            color: "#999",
                            fontWeight: 500,
                        }}
                    >
                        {pendingName ?? "파일을 끌어다 놓거나 탭하세요"}
                    </div>
                    <input
                        id="import-file"
                        ref={inputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileChosen}
                        disabled={busy}
                        style={{ position: "absolute", left: -9999 }}
                    />
                </label>

                <div
                    style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#a0a0a0",
                        marginBottom: 9,
                    }}
                >
                    충돌 처리
                </div>
                <fieldset
                    style={{
                        border: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                    }}
                >
                    <legend style={{ position: "absolute", left: -9999 }}>
                        충돌 처리 방식
                    </legend>
                    {CONFLICT_MODES.map((m) => {
                        const on = mode === m.value
                        return (
                            <label
                                key={m.value}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    width: "100%",
                                    padding: "13px 15px",
                                    border: `1.5px solid ${on ? "var(--ac)" : "#ececec"}`,
                                    borderRadius: 13,
                                    background: on ? "var(--tint)" : "#fff",
                                    cursor: busy ? "not-allowed" : "pointer",
                                    transition: "all 0.16s",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="import-mode"
                                    value={m.value}
                                    checked={on}
                                    onChange={() => setMode(m.value)}
                                    disabled={busy}
                                    style={{
                                        position: "absolute",
                                        left: -9999,
                                    }}
                                />
                                <span
                                    aria-hidden="true"
                                    style={{
                                        flexShrink: 0,
                                        width: 19,
                                        height: 19,
                                        borderRadius: "50%",
                                        border: `5px solid ${on ? "var(--ac)" : "#dcdcdc"}`,
                                        transition: "all 0.16s",
                                    }}
                                />
                                <span style={{ flex: 1, textAlign: "left" }}>
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: "#222",
                                        }}
                                    >
                                        {m.label}
                                    </span>
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 12,
                                            color: "#999",
                                            marginTop: 1,
                                        }}
                                    >
                                        {m.desc}
                                    </span>
                                </span>
                            </label>
                        )
                    })}
                </fieldset>
            </section>

            {status && (
                <div
                    role="status"
                    aria-live="polite"
                    className="card"
                    style={{ fontSize: 13.5, color: "#444" }}
                >
                    {status}
                </div>
            )}
            {error && (
                <div role="alert" className="error-box">
                    {error}
                </div>
            )}
        </div>
    )
}

// 충돌 처리 모드(거부/건너뛰기/덮어쓰기) 라벨·설명.
const CONFLICT_MODES: { value: ImportMode; label: string; desc: string }[] = [
    {
        value: "reject",
        label: "거부",
        desc: "충돌 시 전체 가져오기 중단",
    },
    {
        value: "skip",
        label: "건너뛰기",
        desc: "기존 항목 유지, 새 항목만 추가",
    },
    {
        value: "replace",
        label: "덮어쓰기",
        desc: "같은 라벨은 백업 내용으로 교체",
    },
]
