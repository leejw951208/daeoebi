"use client"
// vault 백업/복원 패널. export 다운로드와 import 파일 업로드 + 충돌 모드 선택을 제공한다.
import { ChangeEvent, useRef, useState } from "react"
import { exportVault, importVault } from "@/lib/vault-client"

type ImportMode = "reject" | "skip" | "replace"

interface Props {
    onImported: () => Promise<void> | void
}

export function BackupPanel({ onImported }: Props) {
    const [status, setStatus] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [mode, setMode] = useState<ImportMode>("reject")
    const [pendingMaster, setPendingMaster] = useState("")
    const [pendingContainer, setPendingContainer] = useState<string | null>(
        null,
    )
    const inputRef = useRef<HTMLInputElement | null>(null)

    async function handleExport() {
        setBusy(true)
        setStatus(null)
        setError(null)
        try {
            const blob = await exportVault()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `secrets-manager-vault-${new Date().toISOString().slice(0, 10)}.lkvault`
            a.click()
            URL.revokeObjectURL(url)
            setStatus("백업 파일을 다운로드했습니다.")
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setBusy(false)
        }
    }

    function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
        setError(null)
        setStatus(null)
        const file = e.target.files?.[0]
        if (!file) {
            setPendingContainer(null)
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            const buf = reader.result as ArrayBuffer
            const bytes = new Uint8Array(buf)
            let binary = ""
            for (let i = 0; i < bytes.byteLength; i += 1) {
                binary += String.fromCharCode(bytes[i])
            }
            setPendingContainer(btoa(binary))
        }
        reader.onerror = () => {
            setError("파일을 읽지 못했습니다.")
            setPendingContainer(null)
        }
        reader.readAsArrayBuffer(file)
    }

    async function handleImport() {
        if (!pendingContainer) {
            setError("복원할 파일을 먼저 선택하세요.")
            return
        }
        if (pendingMaster.length < 8) {
            setError("컨테이너의 마스터 패스워드를 입력하세요.")
            return
        }
        setBusy(true)
        setStatus(null)
        setError(null)
        try {
            const result = await importVault(
                pendingContainer,
                pendingMaster,
                mode,
            )
            setStatus(
                `복원 완료. 추가 ${result.imported}건 / 건너뜀 ${result.skipped}건 / 덮어쓰기 ${result.replaced}건.`,
            )
            setPendingMaster("")
            setPendingContainer(null)
            if (inputRef.current) inputRef.current.value = ""
            await onImported()
        } catch (e) {
            setError((e as Error).message)
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
                    accept=".lkvault,application/octet-stream"
                    onChange={handleFileChosen}
                    disabled={busy}
                />

                <label htmlFor="import-master">컨테이너 마스터 패스워드</label>
                <input
                    id="import-master"
                    type="password"
                    className="field-control"
                    autoComplete="off"
                    value={pendingMaster}
                    onChange={(e) => setPendingMaster(e.target.value)}
                    minLength={8}
                    maxLength={256}
                    disabled={busy}
                />

                <label htmlFor="import-mode">충돌 처리</label>
                <select
                    id="import-mode"
                    className="field-control"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ImportMode)}
                    disabled={busy}
                >
                    <option value="reject">
                        중단 (기본). 같은 라벨이 있으면 409
                    </option>
                    <option value="skip">건너뛰기. 같은 라벨은 무시</option>
                    <option value="replace">
                        덮어쓰기. 같은 라벨을 새 내용으로 교체
                    </option>
                </select>

                <div>
                    <button
                        type="button"
                        className="btn"
                        onClick={handleImport}
                        disabled={busy}
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
