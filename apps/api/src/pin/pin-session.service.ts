// PIN 로그인 세션. 단일 사용자라 인메모리 토큰 집합으로 충분하다. 프로세스 재시작 시 폐기된다.
import { Injectable } from "@nestjs/common"
import { randomBytes } from "node:crypto"

@Injectable()
export class PinSessionService {
    private readonly tokens = new Set<string>()

    issue(): string {
        const token = randomBytes(32).toString("base64url")
        this.tokens.add(token)
        return token
    }

    isValid(token: string | undefined): boolean {
        return token !== undefined && this.tokens.has(token)
    }

    revoke(token: string | undefined): void {
        if (token) this.tokens.delete(token)
    }
}
