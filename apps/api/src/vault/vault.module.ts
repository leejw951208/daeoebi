// vault 도메인 모듈. 컨트롤러·서비스·세션·암호화·가드·CSRF 미들웨어를 한 곳에서 조립한다.
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { PrismaModule } from "../prisma/prisma.module"
import { VaultController } from "./vault.controller"
import { VaultService } from "./vault.service"
import { VaultCryptoService } from "./vault-crypto.service"
import { VaultSessionService } from "./vault-session.service"
import { VaultBackoffService } from "./vault-backoff.service"
import { VaultLockGuard } from "./vault-lock.guard"
import { VaultCsrfMiddleware } from "./vault-csrf.middleware"

@Module({
    imports: [PrismaModule],
    controllers: [VaultController],
    providers: [
        VaultService,
        VaultCryptoService,
        VaultSessionService,
        VaultBackoffService,
        { provide: APP_GUARD, useClass: VaultLockGuard },
    ],
    exports: [VaultService, VaultCryptoService, VaultSessionService],
})
export class VaultModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        // VaultController 단위로 적용해 모든 vault 라우트(다단계 포함)를 자동 매칭한다.
        // path 문자열 매칭은 path-to-regexp 버전에 따라 다단계 경로가 누락될 수 있어 사용하지 않는다.
        consumer.apply(VaultCsrfMiddleware).forRoutes(VaultController)
    }
}
