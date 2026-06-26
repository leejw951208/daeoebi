// 대외비 PWA service worker. 콘텐츠 해시가 박힌 정적 자산만 캐시한다.
// /api/* 와 Next.js RSC·동적 요청은 절대 캐시하지 않는다(SW 가 라우팅에 끼어들지 않게 한다).
const CACHE_VERSION = "daeoebi-v7"
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

    // API 는 절대 캐시하지 않는다 — 항상 네트워크로 패스한다.
    // 금고 데이터(/api/secrets·/api/sites·/api/search·/api/auth 등)는 모두 동적·민감 데이터라
    // stale 응답이 나오면 등록 직후 목록 미반영 같은 버그가 생기고 보안상으로도 부적절하다.
    // (이전엔 /api/vault 만 제외했으나 실제 데이터 경로가 /api/vault 가 아니라 캐시되던 버그가 있었다.)
    if (url.pathname.startsWith("/api/")) return

    // POST 등 비-GET 은 패스
    if (event.request.method !== "GET") return

    // 같은 origin 만 처리
    if (url.origin !== self.location.origin) return

    // 내비게이션(HTML 문서)은 network-first. 캐시에 저장하지 않고, 오프라인일 때만 앱 셸("/")로 폴백한다.
    // (HTML/RSC 를 캐시하면 새 배포 후 stale 응답이 신선한 빌드와 충돌해 App Router 가 하드 내비게이션으로
    //  폴백하고, 그 순간 메모리의 VK 가 폐기돼 잠금화면이 다시 뜨는(재인증) 버그가 난다.)
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).catch(() =>
                caches.match("/").then((cached) => cached ?? Response.error()),
            ),
        )
        return
    }

    // 콘텐츠 해시가 박힌 불변 정적 자산만 cache-first 로 캐시한다(파일명에 해시가 있어 stale 위험이 없다).
    // RSC 페이로드·기타 동적 GET 은 SW 가 가로채지 않고 네트워크로 통과시킨다 — 라우팅 충돌을 원천 차단한다.
    const isImmutableAsset =
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/icons/") ||
        url.pathname === "/manifest.webmanifest"
    if (!isImmutableAsset) return

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
