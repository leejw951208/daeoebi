"use client"
// vault 백업·복원 라우트. 기존 BackupPanel 컴포넌트를 단독 페이지로 mount 한다.
import Link from "next/link"
import { BackupPanel } from "../BackupPanel"

export default function VaultBackupPage() {
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
                    <span className="eyebrow">Backup · Restore</span>
                    <h1>백업·복원</h1>
                </div>
                <Link className="btn secondary" href="/">
                    ← 보관함
                </Link>
            </header>

            <div style={{ marginTop: 16 }}>
                <BackupPanel onImported={async () => undefined} />
            </div>
        </section>
    )
}
