// 저축 박스(SavingsBoxTxn) 목록·생성·삭제. 본문은 클라이언트 E2E 암호문이라 서버는 복호화 없이 패스스루한다.
// type·source·date 만 평문 메타로 다룬다(정렬·조회용). update 는 없다.
import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { CreateSavingsBoxTxnDto } from "./dto/savings-box.dto"
import { ASSET_ERRORS } from "./asset.types"

function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

interface SavingsBoxTxnRow {
    id: string
    type: string
    source: string
    date: string
    iv: Uint8Array
    ciphertext: Uint8Array
    authTag: Uint8Array
}

function toView(row: SavingsBoxTxnRow) {
    return {
        id: row.id,
        type: row.type,
        source: row.source,
        date: row.date,
        iv: toBase64url(row.iv),
        ciphertext: toBase64url(row.ciphertext),
        authTag: toBase64url(row.authTag),
    }
}

@Injectable()
export class SavingsBoxService {
    constructor(private readonly prisma: PrismaService) {}

    async list() {
        const rows = await this.prisma.savingsBoxTxn.findMany({
            // 같은 날짜는 생성 역순으로 안정 정렬(동일 date 순서 비결정성 방지).
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        })
        return rows.map(toView)
    }

    async create(dto: CreateSavingsBoxTxnDto) {
        const row = await this.prisma.savingsBoxTxn.create({
            data: {
                type: dto.type,
                source: dto.source,
                date: dto.date,
                iv: prismaBytes(fromBase64url(dto.iv)),
                ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
                authTag: prismaBytes(fromBase64url(dto.authTag)),
            },
        })
        return toView(row)
    }

    async remove(id: string): Promise<void> {
        try {
            await this.prisma.savingsBoxTxn.delete({ where: { id } })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    private isRecordNotFound(e: unknown): boolean {
        return (
            typeof e === "object" &&
            e !== null &&
            (e as { code?: string }).code === "P2025"
        )
    }

    private notFound(): NotFoundException {
        return new NotFoundException({
            code: ASSET_ERRORS.SAVINGS_BOX_NOT_FOUND,
            message: "저축 박스 내역을 찾을 수 없습니다.",
        })
    }
}
