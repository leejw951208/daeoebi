// NestJS 루트 모듈. 도메인 모듈을 조립한다. 전역 세션 가드는 AuthModule 이 제공한다.
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { PrismaModule } from "./prisma/prisma.module"
import { AuthModule } from "./auth/auth.module"
import { VaultModule } from "./vault/vault.module"
import { AssetModule } from "./asset/asset.module"

@Module({
    imports: [
        // NODE_ENV 별 파일을 우선 로드한다(개발=.env.development, 운영=.env.production).
        // 예시는 단일 .env.example 을 복사해 환경별 파일로 만든다.
        // 이미 설정된 변수(컨테이너 주입 등)는 덮어쓰지 않는다.
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: [
                `.env.${process.env.NODE_ENV ?? "development"}.local`,
                `.env.${process.env.NODE_ENV ?? "development"}`,
                ".env.local",
                ".env",
            ],
        }),
        PrismaModule,
        AuthModule,
        VaultModule,
        AssetModule,
    ],
})
export class AppModule {}
