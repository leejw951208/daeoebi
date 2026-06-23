// NestJS 진입점. 127.0.0.1:4000 바인딩과 CORS, 검증 파이프, 예외 필터를 설정한다.
import { NestFactory } from "@nestjs/core"
import { ValidationPipe, Logger } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"
import { AppModule } from "./app.module"
import { HttpExceptionFilter } from "./common/http-exception.filter"

async function bootstrap() {
    // DATABASE_URL 누락 시 명시적 한국어 에러로 즉시 종료한다.
    const databaseUrl = process.env.DATABASE_URL?.trim()
    if (!databaseUrl) {
        Logger.error(
            "DATABASE_URL 환경 변수가 설정되어 있지 않습니다. apps/api/.env.development.example 을 참고해 .env.development 파일을 만들어주세요.",
            "Bootstrap",
        )
        process.exit(1)
    }

    const app = await NestFactory.create(AppModule)
    app.getHttpAdapter().getInstance().disable("x-powered-by")
    app.use((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        )
        res.setHeader("X-Content-Type-Options", "nosniff")
        res.setHeader("Referrer-Policy", "no-referrer")
        next()
    })

    // 기본은 로컬 웹 오리진. 배포 시 CORS_ORIGIN 환경 변수로 내 도메인을 지정한다.
    app.enableCors({
        origin: process.env.CORS_ORIGIN ?? "http://127.0.0.1:3000",
        credentials: true,
    })

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )

    app.useGlobalFilters(new HttpExceptionFilter())

    // 기본은 로컬 전용 127.0.0.1 바인딩. 컨테이너에선 HOST=0.0.0.0 으로 덮어쓴다.
    const port = Number(process.env.PORT ?? 4000)
    const host = process.env.HOST ?? "127.0.0.1"
    await app.listen(port, host)
}

bootstrap()
