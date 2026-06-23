// PIN 접속 인증 모듈. 컨트롤러·서비스·세션·가드·CSRF 미들웨어를 조립한다.
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { PinController } from "./pin.controller"
import { PinService } from "./pin.service"
import { PinSessionService } from "./pin-session.service"
import { PinGuard } from "./pin.guard"
import { PinCsrfMiddleware } from "./pin-csrf.middleware"

@Module({
    imports: [PrismaModule],
    controllers: [PinController],
    providers: [PinService, PinSessionService, PinGuard],
    exports: [PinSessionService, PinGuard],
})
export class PinModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(PinCsrfMiddleware).forRoutes(PinController)
    }
}
