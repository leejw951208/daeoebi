// NestJS 루트 모듈. 도메인 모듈을 조립하고 전역 Guard를 적용한다.
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { APP_GUARD } from "@nestjs/core"
import { PrismaModule } from "./prisma/prisma.module"
import { VaultModule } from "./vault/vault.module"
import { PinModule } from "./pin/pin.module"
import { StoreModule } from "./store/store.module"
import { AuthGuard } from "./auth/auth.guard"

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        VaultModule,
        PinModule,
        StoreModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
    ],
})
export class AppModule {}
