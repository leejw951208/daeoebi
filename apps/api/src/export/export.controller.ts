// CSV 내보내기 엔드포인트. UTF-8 BOM을 포함한 텍스트를 스트리밍 응답한다.
import { Controller, Get, Query, Res } from "@nestjs/common"
import { Response } from "express"
import { PrismaService } from "../prisma/prisma.service"
import { parseIsoDate } from "../common/dates"
import { ExportQueryDto } from "./dto/export-query.dto"

const HEADERS = [
    "날짜",
    "이름",
    "카테고리",
    "예상금액",
    "실제금액",
    "기준",
    "상태",
    "결제수단",
    "메모",
]

function escapeCell(value: unknown): string {
    if (value === null || value === undefined) {
        return ""
    }
    let str = String(value)
    // CSV 인젝션 방지. =, +, -, @로 시작하는 셀은 엑셀에서 수식으로 해석되므로 앞에 작은따옴표를 붙인다.
    if (str.length > 0 && /^[=+\-@]/.test(str)) {
        str = `'${str}`
    }
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function ymd(date: Date): string {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, "0")
    const d = String(date.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

@Controller("export")
export class ExportController {
    constructor(private readonly prisma: PrismaService) {}

    @Get("csv")
    async exportCsv(@Query() query: ExportQueryDto, @Res() res: Response) {
        const occurrences = await this.prisma.expenseOccurrence.findMany({
            where: {
                dueDate: {
                    gte: parseIsoDate(query.from),
                    lte: parseIsoDate(query.to),
                },
            },
            include: { expense: true },
            orderBy: { dueDate: "asc" },
        })

        const filename = `secrets-manager-${query.from}_${query.to}.csv`

        res.setHeader("Content-Type", "text/csv; charset=utf-8")
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`,
        )
        res.write(`\uFEFF${HEADERS.join(",")}`)

        for (const occ of occurrences) {
            const basis = occ.actualAmount === null ? "예상" : "실제"
            const row = [
                ymd(occ.dueDate),
                occ.expense.name,
                occ.expense.category,
                occ.expectedAmount,
                occ.actualAmount ?? "",
                basis,
                occ.status,
                occ.expense.paymentMethod ?? "",
                occ.memo ?? "",
            ]
                .map(escapeCell)
                .join(",")
            res.write(`\r\n${row}`)
        }

        res.end()
    }
}
