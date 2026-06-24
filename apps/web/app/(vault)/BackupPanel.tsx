"use client"
// 백업/복원 패널. E2E 암호문 패스스루이므로 별도 마스터 입력이 없다. export 다운로드 + import 업로드 + 충돌 모드 선택.
import { ChangeEvent, useRef, useState } from "react"
import {
    exportStore,
    importStore,
    type ImportMode,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"

interface Props {
    onImported: () => Promise<void> | void
}

export function BackupPanel({ onImported }: Props) {
    const [status, setStatus] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [mode, setMode] = useState<ImportMode>("reject")
    const [pendingPayload, setPendingPayload] = useState<unknown>(null)
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
            a.download = `secrets-manager-backup-${new Date().toISOString().slice(0, 10)}.json`
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
            setPendingPayload(null)
            setPendingName(null)
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            try {
                // E2E 백업은 암호문 블롭이 담긴 JSON 이다. 파싱만 하고 복호화하지 않는다.
                setPendingPayload(JSON.parse(reader.result as string))
                setPendingName(file.name)
            } catch {
                setError("백업 파일이 올바른 JSON 형식이 아닙니다.")
                setPendingPayload(null)
                setPendingName(null)
            }
        }
        reader.onerror = () => {
            setError("파일을 읽지 못했습니다.")
            setPendingPayload(null)
            setPendingName(null)
        }
        reader.readAsText(file)
    }

    async function handleImport() {
        if (pendingPayload === null) {
            setError("복원할 파일을 먼저 선택하세요.")
            return
        }
        setBusy(true)
        setStatus(null)
        setError(null)
        try {
            const result = await importStore(pendingPayload, mode)
            const line = (label: string, c: typeof result.secrets) =>
                `${label} 추가 ${c.created} / 건너뜀 ${c.skipped} / 덮어쓰기 ${c.replaced}`
            setStatus(
                `복원 완료. ${line("비밀번호", result.secrets)}, ${line("카테고리", result.categories)}, ${line("사이트", result.sites)}.`,
            )
            setPendingPayload(null)
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
        <section
            className="card"
            style={{ marginTop: 16, display: "grid", gap: 12 }}
            aria-label="백업과 복원"
        >
            <h3 style={{ margin: 0 }}>백업·복원</h3>
            <p className="muted" style={{ margin: 0 }}>
                백업 파일에는 암호화된 데이터만 담깁니다. 복호화는 이 기기의
                보관함 키로만 가능합니다.
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                    type="button"
                    className="btn"
                    onClick={handleExport}
                    disabled={busy}
                >
                    백업 다운로드
                </button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
                <label htmlFor="import-file">백업 파일</label>
                <input
                    id="import-file"
                    ref={inputRef}
                    type="file"
                    className="field-control"
                    accept=".json,application/json"
                    onChange={handleFileChosen}
                    disabled={busy}
                />
                {pendingName && (
                    <span className="muted">선택됨. {pendingName}</span>
                )}

                <label htmlFor="import-mode">충돌 처리</label>
                <select
                    id="import-mode"
                    className="field-control"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ImportMode)}
                    disabled={busy}
                >
                    <option value="reject">
                        중단 (기본). 충돌이 있으면 복원하지 않음
                    </option>
                    <option value="skip">건너뛰기. 충돌 항목은 무시</option>
                    <option value="replace">
                        덮어쓰기. 충돌 항목을 새 내용으로 교체
                    </option>
                </select>

                <div>
                    <button
                        type="button"
                        className="btn"
                        onClick={handleImport}
                        disabled={busy || pendingPayload === null}
                    >
                        복원 실행
                    </button>
                </div>
            </div>

            {status && (
                <div role="status" aria-live="polite">
                    {status}
                </div>
            )}
            {error && (
                <div role="alert" className="error-box">
                    {error}
                </div>
            )}
        </section>
    )
}
