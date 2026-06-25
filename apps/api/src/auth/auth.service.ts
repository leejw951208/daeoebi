// passkey 인증 비즈니스 로직. WebAuthn 등록/로그인 세레모니와 PRF 래핑 블롭 보관을 담당한다.
// 서버는 VK·PRF 출력·복구코드를 평문으로 보지 않는다. 암호문 블롭만 저장·반환한다(계약서 §1, §8).
import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from "@nestjs/common"
import { createHash, timingSafeEqual } from "node:crypto"
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
    type GenerateAuthenticationOptionsOpts,
    type GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server"
import type {
    AuthenticationResponseJSON,
    AuthenticatorTransportFuture,
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
} from "@simplewebauthn/server"
import { PrismaService } from "../prisma/prisma.service"
import { ChallengeService } from "./challenge.service"
import { SessionService } from "./session.service"
import { BackoffService } from "./backoff.service"
import { fromBase64url, isBase64url, toBase64url } from "./base64url"
import { computeVerifier, RECOVERY_CODE_BYTES } from "./recovery-code"
import {
    AUTH_ERRORS,
    getBootstrapToken,
    EXPECTED_ORIGINS,
    OPTIONS_MAX_PER_WINDOW,
    OPTIONS_WINDOW_MS,
    RP_ID,
    RP_NAME,
    SINGLETON_USER_NAME,
} from "./auth.types"
import type { RegisterVerifyDto } from "./dto/auth.dto"

// Prisma Bytes 입력은 Uint8Array<ArrayBuffer> 를 기대하므로 복사해 변환한다.
function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

export interface StatusView {
    registered: boolean
    authenticated: boolean
}

// recovery/wrap 노출 레이트리밋 윈도우(H-1). 무인증 break-glass 경로의 오프라인 무차별 대입 시도를 늦춘다.
const RECOVERY_WINDOW_MS = 60 * 1000
const RECOVERY_MAX_PER_WINDOW = 10

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name)
    // recovery 호출 타임스탬프(슬라이딩 윈도우). 단일 사용자라 글로벌 1개면 충분.
    private recoveryHits: number[] = []
    // 옵션(챌린지 생성) 호출 타임스탬프(M-3 가용성 보호).
    private optionsHits: number[] = []

    constructor(
        private readonly prisma: PrismaService,
        private readonly challenge: ChallengeService,
        private readonly session: SessionService,
        private readonly backoff: BackoffService,
    ) {}

    async status(authenticated: boolean): Promise<StatusView> {
        const count = await this.prisma.webauthnCredential.count()
        return { registered: count > 0, authenticated }
    }

    // 등록 옵션 생성. PRF 확장 enable, 이미 등록된 credential 은 excludeCredentials 로 중복 방지.
    // C-1: 이미 등록된 보관함(credential ≥ 1)에 대한 기기 추가는 유효 세션을 요구한다.
    // 복구 재등록(isRecovery)은 분실 기기 자격증명을 교체하는 흐름이라, 같은 인증기 재사용을 허용하기 위해
    // excludeCredentials 를 비운다(중복 등록 방지 제외).
    async registerOptions(
        authenticated: boolean,
        isRecovery: boolean,
    ): Promise<{
        options: PublicKeyCredentialCreationOptionsJSON
    }> {
        const existing = await this.prisma.webauthnCredential.findMany({
            select: { credentialId: true, transports: true },
        })

        this.assertRegisterAllowed(existing.length === 0, authenticated)
        this.assertOptionsRate()

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userName: SINGLETON_USER_NAME,
            attestationType: "none",
            authenticatorSelection: {
                residentKey: "required",
                userVerification: "required",
            },
            excludeCredentials: isRecovery
                ? []
                : existing.map((c) => ({
                      id: toBase64url(c.credentialId),
                      transports: c.transports as AuthenticatorTransportFuture[],
                  })),
            // PRF 확장 enable. 등록 단계에선 eval 없이 지원 여부만 요청한다.
            // DOM 표준 타입에 prf 가 아직 없어 라이브러리 입력 타입으로 단언한다.
            extensions: {
                prf: {},
            } as GenerateRegistrationOptionsOpts["extensions"],
        })

        this.challenge.set("register", options.challenge)
        return { options }
    }

    // 등록 검증. 성공 시 자격증명 + PRF 래핑 블롭 저장. 첫 등록이면 RecoveryWrap 도 생성.
    // C-1: 기기 추가(credential ≥ 1)는 유효 세션을 요구한다.
    async registerVerify(
        dto: RegisterVerifyDto,
        authenticated: boolean,
        isRecovery: boolean,
    ): Promise<void> {
        const credentialCount = await this.prisma.webauthnCredential.count()
        const isFirstRegistration = credentialCount === 0

        this.assertRegisterAllowed(isFirstRegistration, authenticated)

        // 첫 등록(credential 0개)은 부트스트랩 토큰 게이트를 통과해야 한다(외부 선점 차단).
        // 기기 추가는 세션/복구세션으로 이미 인가됐으므로 토큰을 요구하지 않는다.
        if (isFirstRegistration) {
            this.assertBootstrapToken(dto.bootstrapToken)
        }

        const expectedChallenge = this.challenge.consume("register")
        if (!expectedChallenge) {
            throw new BadRequestException({
                code: AUTH_ERRORS.CHALLENGE_INVALID,
                message: "등록 챌린지가 만료되었거나 유효하지 않습니다.",
            })
        }

        // 첫 등록에는 복구 래핑이 필수다(VK 의 유일한 백업 경로).
        if (isFirstRegistration && !dto.recovery) {
            throw new BadRequestException({
                code: AUTH_ERRORS.RECOVERY_REQUIRED,
                message: "첫 등록에는 복구코드 래핑이 필요합니다.",
            })
        }

        let verification
        try {
            verification = await verifyRegistrationResponse({
                response: dto.response as unknown as RegistrationResponseJSON,
                expectedChallenge,
                expectedOrigin: EXPECTED_ORIGINS,
                expectedRPID: RP_ID,
                requireUserVerification: true,
            })
        } catch {
            throw new BadRequestException({
                code: AUTH_ERRORS.VERIFICATION_FAILED,
                message: "passkey 등록 검증에 실패했습니다.",
            })
        }

        if (!verification.verified || !verification.registrationInfo) {
            throw new BadRequestException({
                code: AUTH_ERRORS.VERIFICATION_FAILED,
                message: "passkey 등록 검증에 실패했습니다.",
            })
        }

        const info = verification.registrationInfo
        const credential = info.credential

        // 새 자격증명과(첫 등록이면) 복구 래핑을 한 트랜잭션에서 커밋한다.
        await this.prisma.$transaction(async (tx) => {
            // 복구 재등록은 분실 기기 자격증명을 무효화하고 새 passkey 로 교체한다(보안: 분실 기기 차단).
            if (isRecovery) {
                await tx.webauthnCredential.deleteMany({})
            }
            await tx.webauthnCredential.create({
                data: {
                    credentialId: prismaBytes(fromBase64url(credential.id)),
                    publicKey: prismaBytes(credential.publicKey),
                    counter: BigInt(credential.counter),
                    transports: credential.transports ?? [],
                    deviceType: info.credentialDeviceType,
                    backedUp: info.credentialBackedUp,
                    prfSalt: prismaBytes(fromBase64url(dto.prfSalt)),
                    wrappedVkPrf: prismaBytes(fromBase64url(dto.wrappedVkPrf)),
                    nickname: dto.nickname ?? null,
                    lastUsedAt: new Date(),
                },
            })

            if (dto.recovery) {
                const rcSalt = prismaBytes(fromBase64url(dto.recovery.rcSalt))
                const wrappedVkRc = prismaBytes(
                    fromBase64url(dto.recovery.wrappedVkRc),
                )
                const verifier = prismaBytes(
                    fromBase64url(dto.recovery.verifier),
                )
                await tx.recoveryWrap.upsert({
                    where: { id: "singleton" },
                    create: { id: "singleton", rcSalt, wrappedVkRc, verifier },
                    update: { rcSalt, wrappedVkRc, verifier },
                })
            }
        })

        this.backoff.reset()
    }

    // 로그인 옵션 생성. 등록된 각 credential 의 prfSalt 로 PRF eval(evalByCredential)을 구성한다.
    async loginOptions(): Promise<{
        options: PublicKeyCredentialRequestOptionsJSON
    }> {
        this.assertOptionsRate()
        const credentials = await this.prisma.webauthnCredential.findMany({
            select: { credentialId: true, transports: true, prfSalt: true },
        })
        if (credentials.length === 0) {
            throw new NotFoundException({
                code: AUTH_ERRORS.NOT_REGISTERED,
                message: "등록된 passkey 가 없습니다.",
            })
        }

        const allowCredentials = credentials.map((c) => ({
            id: toBase64url(c.credentialId),
            transports: c.transports as AuthenticatorTransportFuture[],
        }))

        // 각 credential 의 prfSalt 를 first 로 매핑한다. 단일 credential 이면 단일 eval.
        const evalByCredential: Record<string, { first: string }> = {}
        for (const c of credentials) {
            evalByCredential[toBase64url(c.credentialId)] = {
                first: toBase64url(c.prfSalt),
            }
        }

        const extensions = {
            prf: { evalByCredential },
        } as GenerateAuthenticationOptionsOpts["extensions"]

        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            allowCredentials,
            userVerification: "required",
            extensions,
        })

        this.challenge.set("login", options.challenge)
        return { options }
    }

    // 로그인 검증. 성공 시 해당 credential 의 PRF 래핑 블롭과 prfSalt 를 반환한다.
    async loginVerify(
        rawResponse: Record<string, unknown>,
    ): Promise<{ wrappedVkPrf: string; prfSalt: string }> {
        if (this.backoff.isBlocked()) {
            throw new HttpException(
                {
                    code: AUTH_ERRORS.RATE_LIMITED,
                    message: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
                    retryAfterSeconds: this.backoff.retryAfterSeconds(),
                },
                HttpStatus.TOO_MANY_REQUESTS,
            )
        }

        const response = rawResponse as unknown as AuthenticationResponseJSON
        const rawId = response?.id
        if (typeof rawId !== "string" || !isBase64url(rawId)) {
            this.backoff.recordFailure()
            throw new BadRequestException({
                code: AUTH_ERRORS.VALIDATION_FAILED,
                message: "응답에 유효한 credential id 가 없습니다.",
            })
        }

        const expectedChallenge = this.challenge.consume("login")
        if (!expectedChallenge) {
            this.backoff.recordFailure()
            throw new BadRequestException({
                code: AUTH_ERRORS.CHALLENGE_INVALID,
                message: "로그인 챌린지가 만료되었거나 유효하지 않습니다.",
            })
        }

        const stored = await this.prisma.webauthnCredential.findUnique({
            where: { credentialId: prismaBytes(fromBase64url(rawId)) },
        })
        if (!stored) {
            this.backoff.recordFailure()
            throw new UnauthorizedException({
                code: AUTH_ERRORS.CREDENTIAL_NOT_FOUND,
                message: "등록되지 않은 자격증명입니다.",
            })
        }

        let verification
        try {
            verification = await verifyAuthenticationResponse({
                response,
                expectedChallenge,
                expectedOrigin: EXPECTED_ORIGINS,
                expectedRPID: RP_ID,
                requireUserVerification: true,
                credential: {
                    id: toBase64url(stored.credentialId),
                    publicKey: new Uint8Array(stored.publicKey),
                    counter: Number(stored.counter),
                    transports:
                        stored.transports as AuthenticatorTransportFuture[],
                },
            })
        } catch {
            this.backoff.recordFailure()
            throw new UnauthorizedException({
                code: AUTH_ERRORS.VERIFICATION_FAILED,
                message: "passkey 인증 검증에 실패했습니다.",
            })
        }

        if (!verification.verified) {
            this.backoff.recordFailure()
            throw new UnauthorizedException({
                code: AUTH_ERRORS.VERIFICATION_FAILED,
                message: "passkey 인증 검증에 실패했습니다.",
            })
        }

        // H-2: 라이브러리는 counter 롤백 시 throw 하지만(둘 중 하나라도 > 0),
        // 둘 다 0(많은 passkey)인 경우는 검사하지 않는다. 비증가 시 경보를 남겨 복제 authenticator 의심을 기록한다.
        const newCounter = verification.authenticationInfo.newCounter
        if (newCounter !== 0 && newCounter <= Number(stored.counter)) {
            this.logger.warn(
                `WebAuthn counter 비증가 감지(credentialId 행 ${stored.id}): new=${newCounter} stored=${Number(stored.counter)}. 복제 authenticator 가능성.`,
            )
        }

        await this.prisma.webauthnCredential.update({
            where: { id: stored.id },
            data: {
                counter: BigInt(newCounter),
                lastUsedAt: new Date(),
            },
        })

        this.backoff.reset()
        return {
            wrappedVkPrf: toBase64url(stored.wrappedVkPrf),
            prfSalt: toBase64url(stored.prfSalt),
        }
    }

    // 복구 검증(H-1 재설계). 복구코드 평문을 break-glass 시점에만 일시 수신해 verifier 를 상수시간 비교한다.
    // 성공 시에만 wrap 블롭을 반환한다(무인증 노출 차단). 백오프·슬라이딩 윈도우로 무차별 대입을 늦춘다.
    // 서버는 복구코드 평문/HKDF 키/VK 를 저장하지 않는다. verifier(=SHA-256(code))만 보유한다.
    async recoveryVerify(
        recoveryCode: string,
    ): Promise<{ rcSalt: string; wrappedVkRc: string }> {
        if (this.backoff.isBlocked()) {
            throw new HttpException(
                {
                    code: AUTH_ERRORS.RATE_LIMITED,
                    message: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
                    retryAfterSeconds: this.backoff.retryAfterSeconds(),
                },
                HttpStatus.TOO_MANY_REQUESTS,
            )
        }
        this.assertRecoveryRate()

        const wrap = await this.prisma.recoveryWrap.findUnique({
            where: { id: "singleton" },
        })
        if (!wrap) {
            throw new NotFoundException({
                code: AUTH_ERRORS.RECOVERY_NOT_FOUND,
                message: "복구 래핑이 없습니다.",
            })
        }

        // recoveryCode 는 20바이트의 base64url(서버는 Base32 미구현). 디코딩 후 SHA-256 으로만 비교한다.
        const recoveryBytes = fromBase64url(recoveryCode)
        if (recoveryBytes.length !== RECOVERY_CODE_BYTES) {
            this.backoff.recordFailure()
            throw new UnauthorizedException({
                code: AUTH_ERRORS.VERIFICATION_FAILED,
                message: "복구코드가 일치하지 않습니다.",
            })
        }
        const provided = computeVerifier(recoveryBytes)
        const stored = Buffer.from(wrap.verifier)
        // 길이 불일치 시 timingSafeEqual 이 throw 하므로 사전 길이 검사로 분기한다.
        const ok =
            provided.length === stored.length &&
            timingSafeEqual(provided, stored)
        if (!ok) {
            this.backoff.recordFailure()
            throw new UnauthorizedException({
                code: AUTH_ERRORS.VERIFICATION_FAILED,
                message: "복구코드가 일치하지 않습니다.",
            })
        }

        this.backoff.reset()
        return {
            rcSalt: toBase64url(wrap.rcSalt),
            wrappedVkRc: toBase64url(wrap.wrappedVkRc),
        }
    }

    // C-1 게이트: 최초 등록(credential 0개)이 아니면서 세션이 없으면 등록을 거부한다.
    private assertRegisterAllowed(
        isFirstRegistration: boolean,
        authenticated: boolean,
    ): void {
        if (isFirstRegistration || authenticated) return
        throw new UnauthorizedException({
            code: AUTH_ERRORS.SESSION_REQUIRED,
            message:
                "기기 추가 등록에는 유효한 세션이 필요합니다. 먼저 기존 passkey 로 로그인하세요.",
        })
    }

    // 첫 등록 게이트: 클라이언트가 제출한 부트스트랩 토큰을 서버 BOOTSTRAP_TOKEN 과 상수시간 비교한다.
    // 보안: 토큰 값 자체는 로그/예외 메시지/에러에 절대 싣지 않는다.
    // 무차별 대입 방어로 login/recovery 와 동일한 글로벌 백오프 카운터를 공유한다(단일 사용자 모델).
    private assertBootstrapToken(provided: string | undefined): void {
        if (this.backoff.isBlocked()) {
            throw new HttpException(
                {
                    code: AUTH_ERRORS.RATE_LIMITED,
                    message: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
                    retryAfterSeconds: this.backoff.retryAfterSeconds(),
                },
                HttpStatus.TOO_MANY_REQUESTS,
            )
        }
        // 서버 토큰 미설정이면 첫 등록을 차단한다(fail-closed).
        // 운영자 설정 누락이지 공격 추측이 아니므로 백오프 카운터는 올리지 않는다.
        const bootstrapToken = getBootstrapToken()
        if (!bootstrapToken) {
            throw new UnauthorizedException({
                code: AUTH_ERRORS.BOOTSTRAP_REQUIRED,
                message:
                    "첫 등록 토큰이 서버에 설정되지 않았습니다. 관리자에게 문의하세요.",
            })
        }
        if (!provided) {
            this.backoff.recordFailure()
            throw new UnauthorizedException({
                code: AUTH_ERRORS.BOOTSTRAP_REQUIRED,
                message: "첫 등록에는 부트스트랩 토큰이 필요합니다.",
            })
        }
        // 길이 누출/길이 불일치 throw 를 피하려 양쪽을 SHA-256(32바이트)으로 고정한 뒤 비교한다.
        const providedHash = createHash("sha256")
            .update(provided, "utf8")
            .digest()
        const expectedHash = createHash("sha256")
            .update(bootstrapToken, "utf8")
            .digest()
        if (!timingSafeEqual(providedHash, expectedHash)) {
            this.backoff.recordFailure()
            throw new UnauthorizedException({
                code: AUTH_ERRORS.BOOTSTRAP_INVALID,
                message: "부트스트랩 토큰이 올바르지 않습니다.",
            })
        }
    }

    // H-1 레이트리밋: 윈도우 내 호출 횟수를 초과하면 429 로 거부한다.
    private assertRecoveryRate(): void {
        const now = Date.now()
        this.recoveryHits = this.recoveryHits.filter(
            (t) => now - t < RECOVERY_WINDOW_MS,
        )
        if (this.recoveryHits.length >= RECOVERY_MAX_PER_WINDOW) {
            const oldest = this.recoveryHits[0]
            const retryAfterSeconds = Math.ceil(
                (RECOVERY_WINDOW_MS - (now - oldest)) / 1000,
            )
            throw new HttpException(
                {
                    code: AUTH_ERRORS.RATE_LIMITED,
                    message: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
                    retryAfterSeconds,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            )
        }
        this.recoveryHits.push(now)
    }

    // M-3 레이트리밋: 옵션(챌린지 생성) 호출이 윈도우 한도를 넘으면 429 로 거부한다(가용성 보호).
    private assertOptionsRate(): void {
        const now = Date.now()
        this.optionsHits = this.optionsHits.filter(
            (t) => now - t < OPTIONS_WINDOW_MS,
        )
        if (this.optionsHits.length >= OPTIONS_MAX_PER_WINDOW) {
            const oldest = this.optionsHits[0]
            const retryAfterSeconds = Math.ceil(
                (OPTIONS_WINDOW_MS - (now - oldest)) / 1000,
            )
            throw new HttpException(
                {
                    code: AUTH_ERRORS.RATE_LIMITED,
                    message: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
                    retryAfterSeconds,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            )
        }
        this.optionsHits.push(now)
    }
}
