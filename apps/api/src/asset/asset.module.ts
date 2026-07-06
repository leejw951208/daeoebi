// 자산(가계부) 도메인 모듈. 수입·지출·고정지출 컨트롤러와 서비스를 조립한다.
// 본문은 클라이언트 E2E 암호문이라 서버 크립토 의존이 없다. 보호는 AuthModule 의 전역 세션 가드가 담당한다.
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { CsrfMiddleware } from "../common/csrf.middleware"
import { IncomeController } from "./income.controller"
import { ExpenseController } from "./expense.controller"
import { RecurringController } from "./recurring.controller"
import { AssetCategoryController } from "./asset-category.controller"
import { SavingsGoalController } from "./savings-goal.controller"
import { IncomeService } from "./income.service"
import { ExpenseService } from "./expense.service"
import { RecurringService } from "./recurring.service"
import { AssetCategoryService } from "./asset-category.service"
import { SavingsGoalService } from "./savings-goal.service"

@Module({
    imports: [PrismaModule],
    controllers: [
        IncomeController,
        ExpenseController,
        RecurringController,
        AssetCategoryController,
        SavingsGoalController,
    ],
    providers: [
        IncomeService,
        ExpenseService,
        RecurringService,
        AssetCategoryService,
        SavingsGoalService,
    ],
})
export class AssetModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(CsrfMiddleware)
            .forRoutes(
                IncomeController,
                ExpenseController,
                RecurringController,
                AssetCategoryController,
                SavingsGoalController,
            )
    }
}
