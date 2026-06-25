// Next.js 설정. 운영 보안 헤더(CSP 등)를 모든 응답에 적용한다.
import type { NextConfig } from "next"

// Pretendard 폰트는 jsdelivr CDN 에서 stylesheet + woff 로 로드된다(layout.tsx). style-src·font-src 에 허용한다.
const PRETENDARD_CDN = "https://cdn.jsdelivr.net"

// 개발(next dev)은 HMR/react-refresh 가 eval 을 사용하고, API 를 별도 오리진
// (NEXT_PUBLIC_API_BASE_URL, 예: http://localhost:4010/api)으로 호출하며 HMR 웹소켓을 연다.
// 운영 빌드는 same-origin(/api) + eval 없음이라 아래 완화는 불필요하므로 dev 에서만 적용한다.
const isDev = process.env.NODE_ENV !== "production"
// connect-src 는 경로가 아니라 오리진만 받는다(base URL 에 /api 가 붙어도 오리진만 추출).
const apiBaseRaw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4010"
let devApiOrigin = "http://localhost:4010"
try {
    devApiOrigin = new URL(apiBaseRaw, "http://localhost").origin
} catch {
    // 상대경로(/api) 등 파싱 불가 시 기본값 유지.
}
const devScriptSrc = isDev ? " 'unsafe-eval'" : ""
const devConnectSrc = isDev
    ? ` ${devApiOrigin} ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*`
    : ""

// Content-Security-Policy.
// 주의. Next.js App Router 는 부트스트랩 인라인 스크립트와 React 인라인 스타일을 사용하므로
// 'unsafe-inline' 이 필요하다. nonce 기반 강화는 미들웨어로 별도 적용할 수 있다(향후 과제).
const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    `font-src 'self' data: ${PRETENDARD_CDN}`,
    `style-src 'self' 'unsafe-inline' ${PRETENDARD_CDN}`,
    `script-src 'self' 'unsafe-inline'${devScriptSrc}`,
    // 운영은 API 가 same-origin(/api)이라 'self' 로 충분하고, dev 는 별도 오리진·웹소켓을 허용한다.
    `connect-src 'self'${devConnectSrc}`,
    "manifest-src 'self'",
    "worker-src 'self'",
].join("; ")

const securityHeaders = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "no-referrer" },
    {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
    },
    // WebAuthn(passkey)은 self 로 명시 허용하고 나머지 강력 권한은 차단한다.
    {
        key: "Permissions-Policy",
        value: [
            "publickey-credentials-get=(self)",
            "publickey-credentials-create=(self)",
            "camera=()",
            "microphone=()",
            "geolocation=()",
        ].join(", "),
    },
]

const nextConfig: NextConfig = {
    reactStrictMode: true,
    async headers() {
        return [{ source: "/:path*", headers: securityHeaders }]
    },
}

export default nextConfig
