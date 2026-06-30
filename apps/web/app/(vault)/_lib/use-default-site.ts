// 기본 사이트 해석 훅. 단일 사용자 평면 대외비를 위해 사이트가 없으면 1개를 생성하고 그 id 를 재사용한다.
// 서버엔 기본 사이트 자동 생성/표식이 없으므로(api-engineer 확정) 클라가 멱등하게 보장한다.
import { useCallback, useEffect, useState } from "react"
import { createSite, listSites } from "@/lib/vault-client"
import { pickDefaultSiteId } from "./default-site"

// 기본 사이트 라벨. 평면 목록 UX 에서 사용자에게 노출되지 않는다.
const DEFAULT_SITE_LABEL = "내 대외비"

// 단일 in-flight promise. strict mode 이중 effect·동시 마운트에서 createSite 중복 호출을 막는다.
let inflight: Promise<string> | null = null

// 사이트가 있으면 결정적으로 가장 오래된(원본) 사이트를, 없으면 1개 생성한 id 를 반환한다. 멱등.
// 중복 라벨 사이트가 여럿이어도 pickDefaultSiteId 가 항상 같은 원본을 고른다(표시 뒤집힘 방지).
async function ensureDefaultSite(): Promise<string> {
    if (inflight) return inflight
    inflight = (async () => {
        const sites = await listSites()
        const existing = pickDefaultSiteId(sites)
        if (existing !== null) return existing
        const created = await createSite({ label: DEFAULT_SITE_LABEL })
        return created.id
    })()
    try {
        return await inflight
    } catch (e) {
        // 실패 시 캐시를 비워 다음 호출이 재시도하도록 한다.
        inflight = null
        throw e
    }
}

type State =
    | { status: "loading" }
    | { status: "ready"; siteId: string }
    | { status: "error"; message: string }

export function useDefaultSite(): {
    state: State
    retry: () => void
} {
    const [state, setState] = useState<State>({ status: "loading" })
    const [nonce, setNonce] = useState(0)

    const retry = useCallback(() => {
        // 재시도는 캐시된 결과를 무시하고 새로 해석한다.
        inflight = null
        setState({ status: "loading" })
        setNonce((n) => n + 1)
    }, [])

    useEffect(() => {
        let cancelled = false
        ensureDefaultSite()
            .then((siteId) => {
                if (!cancelled) setState({ status: "ready", siteId })
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setState({
                        status: "error",
                        message:
                            e instanceof Error ? e.message : "사이트 확인 실패",
                    })
                }
            })
        return () => {
            cancelled = true
        }
    }, [nonce])

    return { state, retry }
}
