// 월 수입(Income) 싱글톤 조회·upsert. 금액은 클라이언트 E2E 암호문이라 서버는 복호화 없이 패스스루한다.
import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { UpsertIncomeDto } from "./dto/income.dto"

const SINGLETON = "singleton"

// Prisma Bytes 입력은 Uint8Array<ArrayBuffer> 를 기대하므로 복사해 변환한다.
function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

@Injectable()
export class IncomeService {
    constructor(private readonly prisma: PrismaService) {}

    // 미설정이면 null. 설정돼 있으면 암호문 블롭(base64url)을 반환한다.
    async get() {
        const row = await this.prisma.income.findUnique({
            where: { id: SINGLETON },
        })
        if (!row) return null
        return {
            iv: toBase64url(row.iv),
            ciphertext: toBase64url(row.ciphertext),
            authTag: toBase64url(row.authTag),
            updatedAt: row.updatedAt,
        }
    }

    async upsert(dto: UpsertIncomeDto) {
        const data = {
            iv: prismaBytes(fromBase64url(dto.iv)),
            ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
            authTag: prismaBytes(fromBase64url(dto.authTag)),
        }
        const row = await this.prisma.income.upsert({
            where: { id: SINGLETON },
            create: { id: SINGLETON, ...data },
            update: data,
        })
        return { ok: true as const, updatedAt: row.updatedAt }
    }
}
