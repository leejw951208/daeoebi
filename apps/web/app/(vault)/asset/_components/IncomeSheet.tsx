"use client"
// 월 수입 설정 바텀시트. 금액 입력(₩ 천단위 표시)과 저장만 담당하는 표현 컴포넌트로,
// 실제 저장·암호화는 상위(AssetPage)가 처리한다.
import { formatAmount } from "../_lib/asset-categories"

interface Props {
    draft: string
    saving: boolean
    onChange: (digits: string) => void
    onSave: () => void
    onClose: () => void
}

export function IncomeSheet({
    draft,
    saving,
    onChange,
    onSave,
    onClose,
}: Props) {
    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="월 수입 설정"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                    월 수입 설정
                </div>
                <p
                    className="muted"
                    style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}
                >
                    매달 들어오는 월급을 입력하면 남는 돈이 자동으로 계산됩니다.
                </p>
                <div className="income-input">
                    <span aria-hidden="true">₩</span>
                    <input
                        inputMode="numeric"
                        value={
                            draft
                                ? formatAmount(
                                      Number(
                                          draft.replace(/[^\d]/g, "") || "0",
                                      ),
                                  )
                                : ""
                        }
                        onChange={(e) =>
                            onChange(
                                e.target.value
                                    .replace(/[^\d]/g, "")
                                    .slice(0, 12),
                            )
                        }
                        placeholder="0"
                        aria-label="월 수입"
                    />
                </div>
                <button
                    type="button"
                    className="btn"
                    style={{ width: "100%", marginTop: 18 }}
                    onClick={onSave}
                    disabled={saving}
                >
                    저장
                </button>
            </div>
        </div>
    )
}
