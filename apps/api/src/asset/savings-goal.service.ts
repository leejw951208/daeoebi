// 저축 목표(SavingsGoal) 싱글톤 CRUD. 본문은 클라이언트 E2E 암호문 패스스루(서버 복호화 없음).
import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { SaveSavingsGoalDto } from "./dto/savings-goal.dto"

function prismaBytes(v: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(v)
}
interface Row {
    id: string
    name: string
    iv: Uint8Array
    ciphertext: Uint8Array
    authTag: Uint8Array
}
function toView(row: Row) {
    return {
        id: row.id,
        name: row.name,
        iv: toBase64url(row.iv),
        ciphertext: toBase64url(row.ciphertext),
        authTag: toBase64url(row.authTag),
    }
}

@Injectable()
export class SavingsGoalService {
    constructor(private readonly prisma: PrismaService) {}

    async get() {
        const row = await this.prisma.savingsGoal.findFirst({
            orderBy: { createdAt: "asc" },
        })
        return row ? toView(row) : null
    }

    async upsert(dto: SaveSavingsGoalDto) {
        const existing = await this.prisma.savingsGoal.findFirst({
            orderBy: { createdAt: "asc" },
            select: { id: true },
        })
        const data = {
            name: dto.name,
            iv: prismaBytes(fromBase64url(dto.iv)),
            ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
            authTag: prismaBytes(fromBase64url(dto.authTag)),
        }
        const row = existing
            ? await this.prisma.savingsGoal.update({
                  where: { id: existing.id },
                  data,
              })
            : await this.prisma.savingsGoal.create({ data })
        return toView(row)
    }
}
