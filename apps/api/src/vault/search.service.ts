// 라벨 검색. 사이트·비밀번호 라벨(평문)에 대해 부분 일치한다. 본문은 검색 대상이 아니다.
// 응답의 categories 는 레거시 호환용 빈 배열이다(비밀번호 분류 기능 제거됨).
import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

const LIMIT = 50

@Injectable()
export class SearchService {
    constructor(private readonly prisma: PrismaService) {}

    async search(query: string) {
        const q = query.trim()
        if (!q) return { sites: [], categories: [], secrets: [] }
        const contains = { contains: q, mode: "insensitive" as const }

        const [sites, secrets] = await Promise.all([
            this.prisma.site.findMany({
                where: { label: contains },
                orderBy: { label: "asc" },
                take: LIMIT,
                select: { id: true, label: true, icon: true },
            }),
            this.prisma.secret.findMany({
                where: { label: contains },
                orderBy: { label: "asc" },
                take: LIMIT,
                select: {
                    id: true,
                    siteId: true,
                    label: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
        ])
        return { sites, categories: [], secrets }
    }
}
