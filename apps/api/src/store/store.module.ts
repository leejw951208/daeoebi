// 보관함 CRUD 모듈. 사이트·카테고리·비밀번호·검색 컨트롤러와 서비스를 조립한다.
// 비밀번호 본문 암호화는 VaultModule 의 crypto·session 을, PIN 보호는 PinModule 의 가드를 재사용한다.
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { VaultModule } from "../vault/vault.module"
import { PinModule } from "../pin/pin.module"
import { SiteController } from "./site.controller"
import { CategoryController } from "./category.controller"
import { SecretController } from "./secret.controller"
import { SearchController } from "./search.controller"
import { SiteService } from "./site.service"
import { CategoryService } from "./category.service"
import { SecretService } from "./secret.service"
import { SearchService } from "./search.service"
import { StoreCsrfMiddleware } from "./store-csrf.middleware"

@Module({
    imports: [PrismaModule, VaultModule, PinModule],
    controllers: [
        SiteController,
        CategoryController,
        SecretController,
        SearchController,
    ],
    providers: [SiteService, CategoryService, SecretService, SearchService],
})
export class StoreModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(StoreCsrfMiddleware)
            .forRoutes(
                SiteController,
                CategoryController,
                SecretController,
            )
    }
}
