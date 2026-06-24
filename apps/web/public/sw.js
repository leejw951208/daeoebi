// 대외비 PWA service worker. 앱 셸 precache + /api 런타임 캐시. /api/vault 는 캐시 제외.
const CACHE_VERSION = "daeoebi-v2"
// 아이콘 PNG 는 사용자가 추후 추가하므로 precache 에 포함하지 않는다.
// addAll 은 단 하나의 404 로도 전체 install 이 실패하므로 핵심 셸만 등록한다.
const APP_SHELL = ["/", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)),
    )
})

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== CACHE_VERSION)
                        .map((k) => caches.delete(k)),
                ),
            ),
    )
    self.clients.claim()
})

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url)

    // Vault API 는 캐시 금지 (보안 상 stale 응답 차단)
    if (url.pathname.startsWith("/api/vault")) return

    // POST 등 비-GET 은 패스
    if (event.request.method !== "GET") return

    // 같은 origin 만 처리
    if (url.origin !== self.location.origin) return

    // /api/* 는 stale-while-revalidate. Cache-Control: no-store 를 명시한 응답은 캐시 저장 제외.
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(
            caches.open(CACHE_VERSION).then(async (cache) => {
                const cached = await cache.match(event.request)
                const fetchPromise = fetch(event.request)
                    .then((response) => {
                        const cc = response.headers.get("cache-control") ?? ""
                        const noStore = /no-store|private/i.test(cc)
                        if (response.ok && !noStore)
                            cache.put(event.request, response.clone())
                        return response
                    })
                    .catch(() => cached)
                return cached ?? fetchPromise
            }),
        )
        return
    }

    // 정적 자산은 cache-first
    event.respondWith(
        caches.match(event.request).then(
            (cached) =>
                cached ??
                fetch(event.request).then((response) => {
                    if (response.ok && response.type === "basic") {
                        const clone = response.clone()
                        caches
                            .open(CACHE_VERSION)
                            .then((cache) => cache.put(event.request, clone))
                    }
                    return response
                }),
        ),
    )
})
