// 보관함 CRUD·백업 모듈. 사이트·카테고리·비밀번호·검색·백업 컨트롤러와 서비스를 조립한다.
// 본문은 클라이언트 E2E 암호문이라 서버 크립토 의존이 없다. 보호는 AuthModule 의 전역 세션 가드가 담당한다.
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { SiteController } from "./site.controller"
import { CategoryController } from "./category.controller"
import { SecretController } from "./secret.controller"
import { SearchController } from "./search.controller"
import { BackupController } from "./backup.controller"
import { SiteService } from "./site.service"
import { CategoryService } from "./category.service"
import { SecretService } from "./secret.service"
import { SearchService } from "./search.service"
import { BackupService } from "./backup.service"
import { StoreCsrfMiddleware } from "./store-csrf.middleware"

@Module({
    imports: [PrismaModule],
    controllers: [
        SiteController,
        CategoryController,
        SecretController,
        SearchController,
        BackupController,
    ],
    providers: [
        SiteService,
        CategoryService,
        SecretService,
        SearchService,
        BackupService,
    ],
})
export class StoreModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(StoreCsrfMiddleware)
            .forRoutes(
                SiteController,
                CategoryController,
                SecretController,
                BackupController,
            )
    }
}
