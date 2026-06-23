// PIN 접속 인증. Argon2id 해시와 영속 backoff(5회/60초)를 관리한다.
// PIN 은 접속 인증 전용이며 비밀번호 암호화 키로는 절대 사용하지 않는다.
import {
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common"
import * as argon2 from "argon2"
import { PrismaService } from "../prisma/prisma.service"
import {
    MIN_LOGIN_DURATION_MS,
    PIN_BACKOFF_MS,
    PIN_ERRORS,
    PIN_MAX_FAILURES,
    PIN_SINGLETON_ID,
} from "./pin.types"

export type PinStatus = {
    state: "setup-required" | "ready"
    lockedSeconds?: number
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

@Injectable()
export class PinService {
    constructor(private readonly prisma: PrismaService) {}

    async status(): Promise<PinStatus> {
        const cred = await this.prisma.pinCredential.findUnique({
            where: { id: PIN_SINGLETON_ID },
        })
        if (!cred) return { state: "setup-required" }
        const remaining = cred.lockUntil
            ? Math.ceil((cred.lockUntil.getTime() - Date.now()) / 1000)
            : 0
        return remaining > 0
            ? { state: "ready", lockedSeconds: remaining }
            : { state: "ready" }
    }

    async setup(pin: string): Promise<void> {
        const existing = await this.prisma.pinCredential.findUnique({
            where: { id: PIN_SINGLETON_ID },
        })
        if (existing) {
            throw new ConflictException({
                code: PIN_ERRORS.SETUP_EXISTS,
                message: "PIN 이 이미 설정되어 있습니다.",
            })
        }
        const pinHash = await argon2.hash(pin, { type: argon2.argon2id })
        await this.prisma.pinCredential.create({
            data: { id: PIN_SINGLETON_ID, pinHash },
        })
    }

    // 로그인 검증. backoff·타이밍 누설 차단을 적용하며, 실패 시 예외를 던진다.
    async verify(pin: string): Promise<void> {
        const startedAt = Date.now()
        const pad = async (): Promise<void> => {
            const elapsed = Date.now() - startedAt
            if (elapsed < MIN_LOGIN_DURATION_MS) {
                await delay(MIN_LOGIN_DURATION_MS - elapsed)
            }
        }

        const cred = await this.prisma.pinCredential.findUnique({
            where: { id: PIN_SINGLETON_ID },
        })
        if (!cred) {
            await pad()
            throw new UnauthorizedException({
                code: PIN_ERRORS.PIN_INVALID,
                message: "PIN 이 설정되어 있지 않습니다.",
            })
        }

        if (cred.lockUntil && cred.lockUntil.getTime() > Date.now()) {
            const retryAfterSeconds = Math.ceil(
                (cred.lockUntil.getTime() - Date.now()) / 1000,
            )
            await pad()
            throw new HttpException(
                {
                    code: PIN_ERRORS.RATE_LIMITED,
                    message: "잠시 후 다시 시도하세요.",
                    retryAfterSeconds,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            )
        }

        const ok = await argon2.verify(cred.pinHash, pin)
        if (!ok) {
            const failCount = cred.failCount + 1
            const lockUntil =
                failCount >= PIN_MAX_FAILURES
                    ? new Date(Date.now() + PIN_BACKOFF_MS)
                    : null
            await this.prisma.pinCredential.update({
                where: { id: PIN_SINGLETON_ID },
                data: { failCount, lockUntil },
            })
            await pad()
            throw new UnauthorizedException({
                code: PIN_ERRORS.PIN_INVALID,
                message: "PIN 이 올바르지 않습니다.",
            })
        }

        if (cred.failCount !== 0 || cred.lockUntil) {
            await this.prisma.pinCredential.update({
                where: { id: PIN_SINGLETON_ID },
                data: { failCount: 0, lockUntil: null },
            })
        }
        await pad()
    }
}
