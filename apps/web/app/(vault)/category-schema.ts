// 카테고리별 폼 필드 메타데이터. 라벨/입력 타입/민감 여부를 한 곳에서 선언한다.
import type { VaultCategory } from "@/lib/vault-client"

export interface FieldSpec {
    name: string
    label: string
    type: "text" | "password" | "url"
    sensitive: boolean
    placeholder?: string
    maxLength?: number
}

export const CATEGORY_LABELS: Record<VaultCategory, string> = {
    BANK: "은행",
    CARD: "카드",
    SECURITIES: "증권",
    SHOPPING: "쇼핑",
    OTHER: "기타",
}

export const CATEGORY_FIELDS: Record<VaultCategory, FieldSpec[]> = {
    BANK: [
        { name: "bankName", label: "은행명", type: "text", sensitive: false },
        {
            name: "accountNumber",
            label: "계좌번호",
            type: "text",
            sensitive: true,
        },
        { name: "loginId", label: "로그인 ID", type: "text", sensitive: false },
        {
            name: "loginPassword",
            label: "로그인 비밀번호",
            type: "password",
            sensitive: true,
        },
        {
            name: "otpSeed",
            label: "OTP 시드",
            type: "password",
            sensitive: true,
        },
    ],
    CARD: [
        { name: "cardIssuer", label: "카드사", type: "text", sensitive: false },
        {
            name: "cardNumber",
            label: "카드번호",
            type: "text",
            sensitive: true,
            placeholder: "0000-0000-0000-0000",
        },
        {
            name: "cardExpiry",
            label: "유효기간",
            type: "text",
            sensitive: false,
            placeholder: "MM/YY",
            maxLength: 7,
        },
        {
            name: "cardCvc",
            label: "CVC",
            type: "password",
            sensitive: true,
            maxLength: 4,
        },
        {
            name: "cardPassword",
            label: "카드 비밀번호",
            type: "password",
            sensitive: true,
            maxLength: 16,
        },
    ],
    SECURITIES: [
        { name: "brokerage", label: "증권사", type: "text", sensitive: false },
        {
            name: "accountNumber",
            label: "계좌번호",
            type: "text",
            sensitive: true,
        },
        { name: "loginId", label: "로그인 ID", type: "text", sensitive: false },
        {
            name: "loginPassword",
            label: "로그인 비밀번호",
            type: "password",
            sensitive: true,
        },
        {
            name: "otpSeed",
            label: "OTP 시드",
            type: "password",
            sensitive: true,
        },
        {
            name: "certificatePassword",
            label: "공인인증서 비밀번호",
            type: "password",
            sensitive: true,
        },
    ],
    SHOPPING: [
        { name: "siteName", label: "사이트명", type: "text", sensitive: false },
        {
            name: "siteUrl",
            label: "URL",
            type: "url",
            sensitive: false,
            placeholder: "https://",
        },
        { name: "loginId", label: "로그인 ID", type: "text", sensitive: false },
        {
            name: "loginPassword",
            label: "로그인 비밀번호",
            type: "password",
            sensitive: true,
        },
    ],
    OTHER: [],
}
