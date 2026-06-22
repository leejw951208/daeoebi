// PrismaClient를 NestJS 라이프사이클에 연결한다.
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "../generated/prisma/client"

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    constructor() {
        const adapter = new PrismaBetterSqlite3({
            url: process.env.DATABASE_URL || "file:./data/secrets-manager.db",
        })
        super({ adapter })
    }

    async onModuleInit(): Promise<void> {
        await this.$connect()
    }

    async onModuleDestroy(): Promise<void> {
        await this.$disconnect()
    }
}
