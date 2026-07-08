"use client"
// vault 백업·복원 라우트. 기존 BackupPanel 컴포넌트를 단독 페이지로 mount 한다.
import Link from "next/link"
import { BackupPanel } from "../_components/BackupPanel"

export default function VaultBackupPage() {
    return (
        <section>
            <div
                className="sticky-header tight"
                style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
                <Link
                    className="btn-text"
                    href="/"
                    aria-label="대외비로"
                    style={{ color: "#666", fontWeight: 400 }}
                >
                    ←
                </Link>
                <div
                    style={{
                        fontSize: 17,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                    }}
                >
                    백업 · 복원
                </div>
            </div>

            <div style={{ paddingTop: 22 }}>
                <BackupPanel onImported={async () => undefined} />
            </div>
        </section>
    )
}
