// 마스터 인증·세션·암호화 비즈니스 로직. setup/unlock/lock/status 와 rekey(Secret 재암호화)를 담당한다.
// 비밀번호 CRUD 는 StoreModule 의 SecretService 가 본 세션 키를 재사용해 처리한다.
import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    InternalServerErrorException,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { VaultCryptoService } from "./vault-crypto.service"
import { VaultSessionService } from "./vault-session.service"
import { VaultBackoffService } from "./vault-backoff.service"
import {
    KDF_V1,
    MIN_UNLOCK_DURATION_MS,
    VAULT_ERRORS,
    VERIFY_PLAINTEXT,
} from "./vault.types"

function normalizeMaster(input: string): string {
    return input.normalize("NFKC").trim()
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

export interface StatusView {
    state: "setup-required" | "locked" | "unlocked"
    idleSecondsRemaining?: number
}

@Injectable()
export class VaultService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly crypto: VaultCryptoService,
        private readonly session: VaultSessionService,
        private readonly backoff: VaultBackoffService,
    ) {}

    async status(): Promise<StatusView> {
        const master = await this.prisma.vaultMaster.findUnique({
            where: { id: "singleton" },
        })
        if (!master) return { state: "setup-required" }
        if (this.session.isUnlocked()) {
            const remaining = this.session.idleSecondsRemaining()
            return {
                state: "unlocked",
                idleSecondsRemaining: remaining ?? undefined,
            }
        }
        return { state: "locked" }
    }

    async setup(rawMaster: string): Promise<void> {
        const existing = await this.prisma.vaultMaster.findUnique({
            where: { id: "singleton" },
        })
        if (existing) {
            throw new ConflictException({
                code: VAULT_ERRORS.SETUP_EXISTS,
                message: "마스터가 이미 설정되어 있습니다.",
            })
        }
        const master = normalizeMaster(rawMaster)
        if (master.length < 8) {
            throw new BadRequestException({
                code: VAULT_ERRORS.VALIDATION_FAILED,
                message: "정규화 후 마스터가 8자 미만입니다.",
            })
        }

        const salt = this.crypto.generateSalt()
        const key = await this.crypto.deriveKey(master, salt)
        const verify = this.crypto.seal(
            key,
            Buffer.from(VERIFY_PLAINTEXT, "utf8"),
        )

        await this.prisma.vaultMaster.create({
            data: {
                id: "singleton",
                kdfVersion: KDF_V1.version,
                kdfAlgorithm: KDF_V1.algorithm,
                kdfMemoryKiB: KDF_V1.memoryKiB,
                kdfIterations: KDF_V1.iterations,
                kdfParallelism: KDF_V1.parallelism,
                salt: prismaBytes(salt),
                verifyIv: prismaBytes(verify.iv),
                verifyCiphertext: prismaBytes(verify.ciphertext),
                verifyAuthTag: prismaBytes(verify.authTag),
            },
        })

        this.session.setKey(key)
        this.backoff.reset()
    }

    async unlock(rawMaster: string): Promise<void> {
        if (this.backoff.isBlocked()) {
            throw new HttpException(
                {
                    code: VAULT_ERRORS.RATE_LIMITED,
                    message: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
                    retryAfterSeconds: this.backoff.retryAfterSeconds(),
                },
                HttpStatus.TOO_MANY_REQUESTS,
            )
        }

        const started = Date.now()
        const master = normalizeMaster(rawMaster)

        const record = await this.prisma.vaultMaster.findUnique({
            where: { id: "singleton" },
        })
        if (!record) {
            await this.padDelay(started)
            throw new BadRequestException({
                code: VAULT_ERRORS.VALIDATION_FAILED,
                message: "마스터가 설정되지 않았습니다.",
            })
        }

        const key = await this.crypto.deriveKey(
            master,
            Buffer.from(record.salt),
            {
                version: record.kdfVersion,
                algorithm: "argon2id",
                memoryKiB: record.kdfMemoryKiB,
                iterations: record.kdfIterations,
                parallelism: record.kdfParallelism,
                saltLength: record.salt.length,
            },
        )

        const verifyResult = this.crypto.open(key, {
            iv: Buffer.from(record.verifyIv),
            ciphertext: Buffer.from(record.verifyCiphertext),
            authTag: Buffer.from(record.verifyAuthTag),
        })

        if (
            !verifyResult ||
            verifyResult.toString("utf8") !== VERIFY_PLAINTEXT
        ) {
            key.fill(0)
            this.backoff.recordFailure()
            await this.padDelay(started)
            throw new UnauthorizedException({
                code: VAULT_ERRORS.MASTER_INVALID,
                message: "마스터가 일치하지 않습니다.",
            })
        }

        this.session.setKey(key)
        this.backoff.reset()
        await this.padDelay(started)
    }

    async lock(): Promise<void> {
        if (this.session.isLocking()) {
            throw new HttpException(
                {
                    code: VAULT_ERRORS.VAULT_LOCKING,
                    message: "잠금 처리 중입니다.",
                },
                423,
            )
        }
        await this.session.lock()
    }

    // 마스터 또는 KDF 파라미터 변경 시 모든 Secret 본문을 새 키로 재암호화한다.
    // 단일 트랜잭션 안에서 검증·복호화·재암호화·VaultMaster 갱신을 끝내고 새 세션 키를 발행한다.
    async rekey(
        rawCurrentMaster: string,
        rawNewMaster?: string,
        newKdfVersion?: number,
    ): Promise<{ rotated: number; kdfVersion: number }> {
        this.requireKey()

        const currentMaster = normalizeMaster(rawCurrentMaster)
        const targetMaster =
            rawNewMaster !== undefined
                ? normalizeMaster(rawNewMaster)
                : currentMaster

        if (targetMaster.length < 8) {
            throw new BadRequestException({
                code: VAULT_ERRORS.VALIDATION_FAILED,
                message: "정규화 후 새 마스터가 8자 미만입니다.",
            })
        }

        const master = await this.prisma.vaultMaster.findUnique({
            where: { id: "singleton" },
        })
        if (!master) {
            throw new ServiceUnavailableException(
                "마스터가 설정되지 않았습니다.",
            )
        }

        const currentKey = await this.crypto.deriveKey(
            currentMaster,
            Buffer.from(master.salt),
            {
                version: master.kdfVersion,
                algorithm: "argon2id",
                memoryKiB: master.kdfMemoryKiB,
                iterations: master.kdfIterations,
                parallelism: master.kdfParallelism,
                saltLength: master.salt.length,
            },
        )
        const verifyResult = this.crypto.open(currentKey, {
            iv: Buffer.from(master.verifyIv),
            ciphertext: Buffer.from(master.verifyCiphertext),
            authTag: Buffer.from(master.verifyAuthTag),
        })
        if (
            !verifyResult ||
            verifyResult.toString("utf8") !== VERIFY_PLAINTEXT
        ) {
            currentKey.fill(0)
            throw new UnauthorizedException({
                code: VAULT_ERRORS.MASTER_INVALID,
                message: "마스터가 일치하지 않습니다.",
            })
        }

        const newKdfVersionValue = newKdfVersion ?? KDF_V1.version
        const newSalt = this.crypto.generateSalt()
        const newKey = await this.crypto.deriveKey(targetMaster, newSalt)
        const newVerify = this.crypto.seal(
            newKey,
            Buffer.from(VERIFY_PLAINTEXT, "utf8"),
        )

        let rotated = 0
        try {
            await this.prisma.$transaction(async (tx) => {
                const secrets = await tx.secret.findMany()
                for (const secret of secrets) {
                    const plain = this.crypto.open(currentKey, {
                        iv: Buffer.from(secret.iv),
                        ciphertext: Buffer.from(secret.ciphertext),
                        authTag: Buffer.from(secret.authTag),
                    })
                    if (!plain) {
                        throw new InternalServerErrorException({
                            code: "AEAD_FAILED",
                            message: "복호화에 실패했습니다.",
                        })
                    }
                    const sealed = this.crypto.seal(newKey, plain)
                    await tx.secret.update({
                        where: { id: secret.id },
                        data: {
                            iv: prismaBytes(sealed.iv),
                            ciphertext: prismaBytes(sealed.ciphertext),
                            authTag: prismaBytes(sealed.authTag),
                            kdfVersion: newKdfVersionValue,
                        },
                    })
                    rotated += 1
                }

                await tx.vaultMaster.update({
                    where: { id: "singleton" },
                    data: {
                        kdfVersion: newKdfVersionValue,
                        kdfAlgorithm: KDF_V1.algorithm,
                        kdfMemoryKiB: KDF_V1.memoryKiB,
                        kdfIterations: KDF_V1.iterations,
                        kdfParallelism: KDF_V1.parallelism,
                        salt: prismaBytes(newSalt),
                        verifyIv: prismaBytes(newVerify.iv),
                        verifyCiphertext: prismaBytes(newVerify.ciphertext),
                        verifyAuthTag: prismaBytes(newVerify.authTag),
                    },
                })
            })
        } finally {
            currentKey.fill(0)
        }

        this.session.setKey(newKey)

        return { rotated, kdfVersion: newKdfVersionValue }
    }

    private requireKey(): Buffer {
        const key = this.session.getKey()
        if (!key) {
            throw new UnauthorizedException({
                code: VAULT_ERRORS.VAULT_LOCKED,
                message: "vault 가 잠겨 있습니다.",
            })
        }
        return key
    }

    // unlock 응답 총 소요를 MIN_UNLOCK_DURATION_MS 이상으로 패딩한다.
    // 마스터 미설정/실패/성공 분기의 시간 차이를 일정하게 가려 타이밍 누설을 막는다.
    private async padDelay(startedAt: number): Promise<void> {
        const elapsed = Date.now() - startedAt
        const remaining = MIN_UNLOCK_DURATION_MS - elapsed
        if (remaining > 0) await delay(remaining)
    }
}
